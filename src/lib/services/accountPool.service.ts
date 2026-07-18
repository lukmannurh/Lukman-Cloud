import { PooledAccount } from '../../types';
import { retrieveCredential, storeCredential } from './storage.service';

export class AccountPoolService {
  /**
   * Retrieves the current pool of accounts from the storage.
   * Bootstraps the old single 'google_oauth_tokens' format into a pool if needed.
   */
  public async getPool(): Promise<PooledAccount[]> {
    const poolStr = await retrieveCredential('pooled_accounts');
    if (poolStr) {
      return JSON.parse(poolStr) as PooledAccount[];
    }

    // Bootstrap fallback for backward compatibility
    const oldTokenStr = await retrieveCredential('google_oauth_tokens');
    if (oldTokenStr) {
      const oldToken = JSON.parse(oldTokenStr);
      const migratedAccount: PooledAccount = {
        id: crypto.randomUUID(),
        email: 'Migrated Account', // We don't have the email from the old token
        accessToken: oldToken.accessToken,
        expiresAt: oldToken.expiresAt || Date.now() + 3600 * 1000,
        usedQuota: 0,
        totalQuota: 0
      };
      
      const newPool = [migratedAccount];
      await this.savePool(newPool);
      return newPool;
    }

    return [];
  }

  /**
   * Saves the pool to the storage.
   */
  public async savePool(pool: PooledAccount[]): Promise<void> {
    await storeCredential('pooled_accounts', JSON.stringify(pool));
  }

  /**
   * Adds or updates an account in the pool. Matches by email to prevent duplicates.
   */
  public addOrUpdateAccount(existing: PooledAccount[], account: PooledAccount): PooledAccount[] {
    const idx = existing.findIndex(a => a.email === account.email);
    const newPool = [...existing];
    
    if (idx !== -1) {
      // Preserve the stable ID and quota stats, just update token/expiry
      newPool[idx] = {
        ...newPool[idx],
        accessToken: account.accessToken,
        expiresAt: account.expiresAt
      };
    } else {
      newPool.push(account);
    }
    
    return newPool;
  }

  /**
   * Removes an account from the pool by ID.
   */
  public removeAccount(existing: PooledAccount[], id: string): PooledAccount[] {
    return existing.filter(a => a.id !== id);
  }
}

export const accountPoolService = new AccountPoolService();
