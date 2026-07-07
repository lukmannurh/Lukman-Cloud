import { describe, it, expect } from 'vitest';
import { allocationService } from '../lib/services/allocation.service';
import { PooledAccount } from '../types';

describe('AllocationService: Smart Capacity Routing Matrix', () => {
  it('routes payload to the account with the most free space', () => {
    const mockAccounts: PooledAccount[] = [
      {
        id: 'account-a',
        email: 'a@example.com',
        accessToken: 'token-a',
        expiresAt: Date.now() + 3600,
        usedQuota: 8 * 1024 * 1024 * 1024, // 8 GB used
        totalQuota: 10 * 1024 * 1024 * 1024 // 10 GB total -> 2 GB free
      },
      {
        id: 'account-b',
        email: 'b@example.com',
        accessToken: 'token-b',
        expiresAt: Date.now() + 3600,
        usedQuota: 5 * 1024 * 1024 * 1024, // 5 GB used
        totalQuota: 15 * 1024 * 1024 * 1024 // 15 GB total -> 10 GB free
      }
    ];

    const fileSizeBytes = 1 * 1024 * 1024 * 1024; // 1 GB file

    const bestAccount = allocationService.selectBestAccount(mockAccounts, fileSizeBytes);
    
    expect(bestAccount).not.toBeNull();
    expect(bestAccount?.id).toBe('account-b');
  });

  it('prioritizes an unlimited account if present', () => {
    const mockAccounts: PooledAccount[] = [
      {
        id: 'account-a',
        email: 'a@example.com',
        accessToken: 'token-a',
        expiresAt: Date.now() + 3600,
        usedQuota: 0,
        totalQuota: 10 * 1024 * 1024 * 1024 // 10 GB total -> 10 GB free
      },
      {
        id: 'account-unlimited',
        email: 'u@example.com',
        accessToken: 'token-u',
        expiresAt: Date.now() + 3600,
        usedQuota: 50 * 1024 * 1024 * 1024,
        totalQuota: 0 // 0 means unlimited
      }
    ];

    const fileSizeBytes = 1 * 1024 * 1024 * 1024; // 1 GB file
    const bestAccount = allocationService.selectBestAccount(mockAccounts, fileSizeBytes);
    
    expect(bestAccount).not.toBeNull();
    expect(bestAccount?.id).toBe('account-unlimited');
  });

  it('returns null if no account has sufficient space', () => {
    const mockAccounts: PooledAccount[] = [
      {
        id: 'account-a',
        email: 'a@example.com',
        accessToken: 'token-a',
        expiresAt: Date.now() + 3600,
        usedQuota: 9.8 * 1024 * 1024 * 1024,
        totalQuota: 10 * 1024 * 1024 * 1024 // 200 MB free
      }
    ];

    const fileSizeBytes = 1 * 1024 * 1024 * 1024; // 1 GB file
    const bestAccount = allocationService.selectBestAccount(mockAccounts, fileSizeBytes);
    
    // Safety buffer is 500MB, so 200MB is definitely not enough.
    expect(bestAccount).toBeNull();
  });
});
