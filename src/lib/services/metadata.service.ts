/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lukman Cloud — VFS Metadata Service
 * Milestone 2.2
 *
 * Implements the Directory-Split VFS Metadata model.
 * Enforces schema invariants (INV-01 through INV-08) prior to any write.
 * Handles ETag-based optimistic locking and BroadcastChannel coordination.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { FolderDocument, validateFolderDocument, VFSEntry } from '../../types';
import { readAppDataFile, writeAppDataFile } from '../googleAuth';
import { broadcastCoordinator } from './broadcast-coordinator.service';

export class MetadataService {
  
  /**
   * Fetches a FolderDocument from Google Drive and validates its reliability.
   */
  public async fetchFolder(accessToken: string, driveFileId: string): Promise<FolderDocument> {
    // Dynamically resolve the root folder file ID if 'root' is requested
    let actualDriveFileId = driveFileId;
    if (driveFileId === 'root') {
      const { findAppDataFileByName } = await import('../googleAuth');
      const rootId = await findAppDataFileByName(accessToken, 'folder_root.json');
      if (rootId) {
        actualDriveFileId = rootId;
      } else {
        throw new Error('Root folder not found on Google Drive. Initiating fallback template.');
      }
    }

    const { content, etag } = await readAppDataFile(accessToken, actualDriveFileId);
    
    const doc = content as FolderDocument;
    doc.etag = etag || doc.etag;

    // Validate INV-01 through INV-08 invariants immediately upon read
    const validation = validateFolderDocument(doc);
    if (!validation.valid) {
      console.error(`[MetadataService] reliability violation in folder ${doc.folderId}:`, validation.violations);
      throw new Error(`Folder metadata corrupted: ${validation.violations[0]}`);
    }

    return doc;
  }

  /**
   * Saves a FolderDocument to Google Drive appDataFolder.
   * If not leader, dispatches the write to the leader via BroadcastChannel.
   * If 412 Precondition Failed occurs, automatically merges and retries.
   */
  public async saveFolder(
    accessToken: string, 
    doc: FolderDocument, 
    isNew: boolean = false
  ): Promise<FolderDocument> {
    
    // Relax ETag Validation on Initial Creation
    if (!doc.etag || doc.etag.trim() === '') {
      doc.etag = 'initial';
      isNew = true;
    }

    // 1. Enforce Invariants
    doc.modifiedAt = new Date().toISOString();
    const validation = validateFolderDocument(doc);
    if (!validation.valid) {
      throw new Error(`Cannot save folder due to invariant violation: ${validation.violations[0]}`);
    }

    // 2. Execution (Direct Write to Google Drive - Bypassing BroadcastChannel for absolute isolation)
    return this.executeWriteWithRetry(accessToken, doc, isNew);
  }

  /**
   * Internal ETag-based optimistic locking and retry loop.
   */
  private async executeWriteWithRetry(
    accessToken: string, 
    doc: FolderDocument, 
    isNew: boolean,
    attempts: number = 3
  ): Promise<FolderDocument> {
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const result = await writeAppDataFile(
          accessToken,
          `folder_${doc.folderId}.json`,
          doc,
          isNew ? null : doc.etag,
          isNew ? null : doc.selfDriveId
        );

        // Update local document with new ETag from Google Drive
        doc.etag = result.etag;
        if (isNew) {
          doc.selfDriveId = result.fileId;
        }

        // Broadcast success so followers can invalidate cache
        broadcastCoordinator.sendMessage({
          type: 'metadata_changed',
          folderId: doc.folderId,
          newEtag: result.etag
        });

        return doc;

      } catch (error: any) {
        if (error.message.includes('ETag mismatch') || error.message.includes('412')) {
          console.warn(`[MetadataService] 412 Precondition Failed on attempt ${attempt} for folder ${doc.folderId}`);
          
          if (attempt === attempts) {
            throw new Error(`Failed to save folder ${doc.folderId} after ${attempts} attempts due to concurrent modifications.`);
          }

          // Merge Strategy:
          // 1. Fetch latest remote folder
          // 2. Union the entries by ID (keeping the one with the newest modifiedAt)
          // 3. Update our doc's ETag and retry
          console.log(`[MetadataService] Merging remote changes...`);
          const latestDoc = await this.fetchFolder(accessToken, doc.selfDriveId);
          doc = this.mergeFolderDocuments(latestDoc, doc);

        } else {
          // Non-ETag error, bubble up
          throw error;
        }
      }
    }

    throw new Error('Unreachable');
  }

  /**
   * Resolves conflicts by merging two FolderDocuments.
   * Remote = the version currently in Drive.
   * Local = our pending version.
   */
  private mergeFolderDocuments(remote: FolderDocument, local: FolderDocument): FolderDocument {
    const mergedEntries = new Map<string, VFSEntry>();

    // Add all remote entries
    for (const entry of remote.entries) {
      mergedEntries.set(entry.id, entry);
    }

    // Upsert local entries if they are newer
    for (const localEntry of local.entries) {
      const remoteEntry = mergedEntries.get(localEntry.id);
      if (!remoteEntry) {
        // It's a brand new file added locally
        mergedEntries.set(localEntry.id, localEntry);
      } else {
        // Conflict on same file ID - compare modifiedAt
        const remoteTime = new Date(remoteEntry.modifiedAt).getTime();
        const localTime = new Date(localEntry.modifiedAt).getTime();
        if (localTime >= remoteTime) {
          mergedEntries.set(localEntry.id, localEntry);
        }
      }
    }

    return {
      ...local, // Keep local metadata (name, etc)
      etag: remote.etag, // VERY IMPORTANT: take the remote ETag so our next PATCH succeeds
      entries: Array.from(mergedEntries.values()),
    };
  }

}

export const metadataService = new MetadataService();
