/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — Broadcast Coordinator Service
 * Milestone 2.2
 *
 * Implements leader election across multiple browser tabs using BroadcastChannel
 * to serialize metadata writes and prevent ETag conflicts.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { BroadcastMessage, MetadataOperation } from '../../types';

const CHANNEL_NAME = 'lukman_cloud_vfs_channel';
const HEARTBEAT_INTERVAL_MS = 5000;
const ELECTION_WAIT_MS = 150;
const LEADER_TIMEOUT_MS = 12000;

export type CoordinatorState = 'follower' | 'candidate' | 'leader';

type MessageHandler = (msg: BroadcastMessage) => void;

class BroadcastCoordinatorService {
  private channel: BroadcastChannel | null = null;
  public tabId: string;
  private startupTimestamp: number;
  
  public state: CoordinatorState = 'follower';
  private leaderTabId: string | null = null;
  
  private heartbeatIntervalHandle: ReturnType<typeof setInterval> | null = null;
  private electionTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private leaderDeathTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  private activeWriteRequests: Map<string, { resolve: (res: any) => void; reject: (err: any) => void }> = new Map();
  private handlers: Set<MessageHandler> = new Set();

  constructor() {
    this.tabId = crypto.randomUUID();
    this.startupTimestamp = Date.now();
  }

  /**
   * Initializes the coordinator and starts the leader election process.
   */
  public initialize() {
    if (this.channel) return;
    
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = this.handleMessage.bind(this);
    
    this.startElection();
  }

  public terminate() {
    this.stopHeartbeat();
    this.clearLeaderDeathTimeout();
    if (this.electionTimeoutHandle) clearTimeout(this.electionTimeoutHandle);
    
    if (this.state === 'leader') {
      this.sendMessage({ type: 'leader_abdicate', tabId: this.tabId });
    }
    
    this.channel?.close();
    this.channel = null;
  }

  public isLeader(): boolean {
    return this.state === 'leader';
  }

  public getLeaderId(): string | null {
    return this.leaderTabId;
  }

  public onMessage(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  public sendMessage(msg: BroadcastMessage) {
    this.channel?.postMessage(msg);
  }

  // ── Leader Election ────────────────────────────────────────────────────────

  private startElection() {
    this.state = 'candidate';
    this.leaderTabId = null;
    this.sendMessage({
      type: 'leader_election',
      tabId: this.tabId,
      timestamp: this.startupTimestamp
    });

    if (this.electionTimeoutHandle) clearTimeout(this.electionTimeoutHandle);
    
    this.electionTimeoutHandle = setTimeout(() => {
      if (this.state === 'candidate') {
        // We won the election if we haven't yielded to an older timestamp
        this.becomeLeader();
      }
    }, ELECTION_WAIT_MS);
  }

  private becomeLeader() {
    this.state = 'leader';
    this.leaderTabId = this.tabId;
    this.clearLeaderDeathTimeout();
    
    this.sendMessage({ type: 'leader_announce', tabId: this.tabId });
    this.startHeartbeat();
    console.log(`[BroadcastCoordinator] Tab ${this.tabId} elected as LEADER.`);
  }

  private yieldToLeader(leaderId: string) {
    this.state = 'follower';
    this.leaderTabId = leaderId;
    
    if (this.electionTimeoutHandle) clearTimeout(this.electionTimeoutHandle);
    this.stopHeartbeat();
    this.resetLeaderDeathTimeout();
    
    console.log(`[BroadcastCoordinator] Tab ${this.tabId} yielding to LEADER ${leaderId}.`);
  }

  // ── Heartbeat & Timeouts ───────────────────────────────────────────────────

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatIntervalHandle = setInterval(() => {
      this.sendMessage({
        type: 'leader_heartbeat',
        tabId: this.tabId,
        timestamp: Date.now()
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatIntervalHandle) {
      clearInterval(this.heartbeatIntervalHandle);
      this.heartbeatIntervalHandle = null;
    }
  }

  private resetLeaderDeathTimeout() {
    this.clearLeaderDeathTimeout();
    this.leaderDeathTimeoutHandle = setTimeout(() => {
      console.warn('[BroadcastCoordinator] Leader timed out. Triggering re-election.');
      this.startElection();
    }, LEADER_TIMEOUT_MS);
  }

  private clearLeaderDeathTimeout() {
    if (this.leaderDeathTimeoutHandle) {
      clearTimeout(this.leaderDeathTimeoutHandle);
      this.leaderDeathTimeoutHandle = null;
    }
  }

  // ── Message Handling ───────────────────────────────────────────────────────

  private handleMessage(event: MessageEvent<BroadcastMessage>) {
    const msg = event.data;

    switch (msg.type) {
      case 'leader_election':
        if (msg.tabId === this.tabId) break;
        // Yield if their startup timestamp is older (smaller), or if tie, smaller tabId wins
        if (
          msg.timestamp < this.startupTimestamp ||
          (msg.timestamp === this.startupTimestamp && msg.tabId < this.tabId)
        ) {
          if (this.state === 'candidate' || this.state === 'leader') {
            this.yieldToLeader(msg.tabId);
          }
        } else if (this.state === 'leader') {
          // Remind them who's boss
          this.sendMessage({ type: 'leader_announce', tabId: this.tabId });
        }
        break;

      case 'leader_announce':
      case 'leader_heartbeat':
        if (msg.tabId !== this.tabId) {
          if (this.state === 'leader' && msg.type === 'leader_announce') {
            // Split brain scenario - fallback to election
            this.startElection();
          } else {
            this.yieldToLeader(msg.tabId);
          }
        }
        break;

      case 'leader_abdicate':
        if (msg.tabId === this.leaderTabId) {
          console.log('[BroadcastCoordinator] Leader abdicated. Triggering re-election.');
          this.startElection();
        }
        break;

      case 'metadata_write_complete':
        const req = this.activeWriteRequests.get(msg.requestId);
        if (req) {
          if (msg.success) req.resolve(true);
          else req.reject(new Error(msg.error || 'Write failed'));
          this.activeWriteRequests.delete(msg.requestId);
        }
        break;
    }

    // Dispatch to registered handlers
    for (const handler of this.handlers) {
      handler(msg);
    }
  }

  // ── RPC Protocol ───────────────────────────────────────────────────────────

  /**
   * Dispatches a write request to the leader.
   * If this tab IS the leader, it should just process it locally.
   */
  public async dispatchWriteRequest(operation: MetadataOperation): Promise<void> {
    if (this.state === 'leader') {
      throw new Error('dispatchWriteRequest called on LEADER. Leader must process locally.');
    }
    if (!this.leaderTabId) {
      throw new Error('No leader elected yet.');
    }

    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.activeWriteRequests.set(requestId, { resolve, reject });
      
      this.sendMessage({
        type: 'metadata_write_request',
        tabId: this.tabId,
        requestId,
        operation
      });

      // Timeout just in case
      setTimeout(() => {
        if (this.activeWriteRequests.has(requestId)) {
          this.activeWriteRequests.delete(requestId);
          reject(new Error('Write request timed out waiting for leader.'));
        }
      }, 15000);
    });
  }
}

export const broadcastCoordinator = new BroadcastCoordinatorService();
