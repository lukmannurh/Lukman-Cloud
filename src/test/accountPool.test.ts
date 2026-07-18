import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountPoolService } from '../lib/services/accountPool.service';

// Mock the storage service
vi.mock('../lib/services/storage.service', () => {
  return {
    retrieveCredential: vi.fn(),
    storeCredential: vi.fn(),
  };
});

import { retrieveCredential, storeCredential } from '../lib/services/storage.service';

describe('AccountPoolService: Token Migration Fallback', () => {
  let service: AccountPoolService;

  beforeEach(() => {
    service = new AccountPoolService();
    vi.clearAllMocks();
  });

  it('successfully bootstraps a legacy single token into a new pool array', async () => {
    const mockLegacyToken = {
      accessToken: 'legacy_token_123',
      expiresAt: 1234567890
    };

    // Mock retrieveCredential to return null for pooled_accounts, but return legacy token
    (retrieveCredential as any).mockImplementation(async (key: string) => {
      if (key === 'pooled_accounts') return null;
      if (key === 'google_oauth_tokens') return JSON.stringify(mockLegacyToken);
      return null;
    });

    const pool = await service.getPool();

    expect(pool).toHaveLength(1);
    expect(pool[0].accessToken).toBe('legacy_token_123');
    expect(pool[0].expiresAt).toBe(1234567890);
    expect(pool[0].email).toBe('Migrated Account');

    // It should also save the newly constructed pool
    expect(storeCredential).toHaveBeenCalledWith('pooled_accounts', expect.any(String));
    const storedCall = (storeCredential as any).mock.calls[0][1];
    const storedPool = JSON.parse(storedCall);
    expect(storedPool).toHaveLength(1);
    expect(storedPool[0].accessToken).toBe('legacy_token_123');
  });

  it('loads pooled_accounts directly if it exists', async () => {
    const mockPool = [{
      id: 'test-id',
      email: 'test@example.com',
      accessToken: 'token',
      expiresAt: 123,
      usedQuota: 0,
      totalQuota: 100
    }];

    (retrieveCredential as any).mockImplementation(async (key: string) => {
      if (key === 'pooled_accounts') return JSON.stringify(mockPool);
      return null;
    });

    const pool = await service.getPool();
    expect(pool).toHaveLength(1);
    expect(pool[0].id).toBe('test-id');
    expect(storeCredential).not.toHaveBeenCalled();
  });
});
