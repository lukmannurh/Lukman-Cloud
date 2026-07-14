import { VFSNode } from '../../types';
import { supabase } from './supabaseClient';
import { retrieveCredential, storeCredential } from './vault.service';

/**
 * Isolated Virtual File System (VFS) Service - Supabase Postgres Edition
 * Enforces rigid multi-tenant storage isolation.
 */
class VFSService {
  private memoryCache: VFSNode[] | null = null;
  private readonly STORAGE_KEY = 'vfs_registry';
  
  /**
   * Retrieves the authenticated user ID from the Better Auth session token.
   * Blocks access completely if the session context is missing.
   */
  private async getUserId(): Promise<string> {
    // DEV BYPASS: Allow reading from the global mock session injected by App.tsx
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock' && (window as any).__MOCK_SESSION_ID__) {
      return (window as any).__MOCK_SESSION_ID__;
    }

    let retries = 0;
    while (retries < 15) {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session?.user?.id) {
        return session.user.id;
      }
      await new Promise(r => setTimeout(r, 100));
      retries++;
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session || !session.user || !session.user.id) {
      throw new Error('Unauthorized: VFS access blocked due to missing session context.');
    }
    return session.user.id;
  }

  /**
   * Helper to map a database row to a VFSNode object
   */
  private mapRowToNode(row: any): VFSNode {
    return {
      id: row.id,
      name: row.name,
      type: row.is_folder ? 'folder' : 'file',
      path: row.path,
      parentId: row.parent_id === null ? 'root' : row.parent_id,
      size: row.size,
      telegramChannelId: row.telegram_channel_id,
      googleDriveFileId: row.raw_ref?.googleDriveFileId,
      telegramMessageId: row.raw_ref?.telegramMessageId,
      createdAt: row.raw_ref?.createdAt || new Date().toISOString(),
      modifiedAt: row.raw_ref?.modifiedAt || new Date().toISOString(),
      storageRef: row.storage_ref,
      rawRef: row.raw_ref,
      children: [] // Children are dynamically populated if needed, or fetched via queries
    };
  }

  async loadRegistry(): Promise<VFSNode[]> {
    if (import.meta.env.MODE === 'test') {
      if (this.memoryCache) return this.memoryCache;
      const data = await retrieveCredential(this.STORAGE_KEY as any);
      if (data) {
        try {
          const nodes = JSON.parse(data);
          this.memoryCache = nodes;
          return nodes;
        } catch (e) {}
      }
      const rootNode: VFSNode = {
        id: 'root', name: 'Root', type: 'folder', path: '/', parentId: null, children: [],
        createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString()
      };
      this.memoryCache = [rootNode];
      await storeCredential(this.STORAGE_KEY as any, JSON.stringify(this.memoryCache));
      return this.memoryCache;
    }

    const userId = await this.getUserId();
    
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock' && userId.startsWith('dev-')) {
       const existingStr = localStorage.getItem(`mock_vfs_${userId}`);
       if (existingStr) {
         return JSON.parse(existingStr);
       } else {
         const rootNode = await this.createRootFolder(userId);
         return [rootNode];
       }
    }
    
    // Strict isolation rule: ALWAYS append .eq('user_id', userId)
    const { data, error } = await supabase
      .from('vfs_nodes')
      .select('*')
      .eq('user_id', userId);
      
    if (error) throw error;
    
    // If empty, create the root folder
    if (!data || data.length === 0) {
      const rootNode = await this.createRootFolder(userId);
      return [rootNode];
    }
    
    const nodes = data.map(this.mapRowToNode);
    
    // Reconstruct children arrays for memory-compatibility
    const nodeMap = new Map<string, VFSNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));
    nodes.forEach(n => {
      if (n.type === 'folder') {
        n.children = nodes.filter(child => child.parentId === n.id).map(child => child.id);
      }
    });
    
    return nodes;
  }

  private _initRootPromise: Promise<VFSNode> | null = null;
  private async createRootFolder(userId: string): Promise<VFSNode> {
    if (this._initRootPromise) {
      return this._initRootPromise;
    }
    this._initRootPromise = this._createRootFolderImpl(userId);
    try {
      const result = await this._initRootPromise;
      return result;
    } finally {
      this._initRootPromise = null;
    }
  }

  private async _createRootFolderImpl(userId: string): Promise<VFSNode> {
    // Upsert-Check: Check if root exists for this specific user first
    const { data: existing, error: fetchErr } = await supabase
      .from('vfs_nodes')
      .select('*')
      .eq('user_id', userId)
      .is('parent_id', null)
      .eq('path', '/')
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (existing) return this.mapRowToNode(existing);

    // MOCK DEV BYPASS: Do not attempt to insert a real row for a mock user, which causes foreign key 23503 errors.
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock' && userId.startsWith('dev-')) {
       // Bypassing Supabase INSERT for folder creation
       const newNode: VFSNode = {
         id: `mock-root-${userId}`,
         name: 'Root',
         type: 'folder',
         size: 0,
         path: '/',
         createdAt: new Date().toISOString(),
         modifiedAt: new Date().toISOString(),
         parentId: null,
         children: []
       };
       const existingStr = localStorage.getItem(`mock_vfs_${userId}`) || '[]';
       const existingNodes = JSON.parse(existingStr);
       existingNodes.push(newNode);
       localStorage.setItem(`mock_vfs_${userId}`, JSON.stringify(existingNodes));
       return newNode;
    }

    try {
      const { data, error } = await supabase
        .from('vfs_nodes')
        .insert({
          // Omitting hardcoded 'id' to prevent 409 collisions across users
          name: 'Root',
          path: '/',
          parent_id: null,
          is_folder: true,
          user_id: userId,
          raw_ref: { createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() }
        })
        .select()
        .single();
        
      if (error) throw error; 
      
      return this.mapRowToNode(data);
    } catch (err: any) {
      if (err.code === '23505' || err.status === 409 || err.message?.includes('409') || err.message?.includes('duplicate key')) {
        // Safe Catch: Smoothly retrieve existing record instead of throwing HTTP 409
        const { data: raceExisting, error: raceErr } = await supabase
          .from('vfs_nodes')
          .select('*')
          .eq('user_id', userId)
          .is('parent_id', null)
          .eq('path', '/')
          .single();
        if (raceErr) throw raceErr;
        return this.mapRowToNode(raceExisting);
      }
      throw err;
    }
  }

  async getDirectoryContents(parentId: string): Promise<VFSNode[]> {
    const userId = await this.getUserId();
    
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock' && userId.startsWith('dev-')) {
       const existingStr = localStorage.getItem(`mock_vfs_${userId}`) || '[]';
       const existingNodes: VFSNode[] = JSON.parse(existingStr);
       return existingNodes.filter(n => n.parentId === parentId);
    }
    
    let query = supabase
      .from('vfs_nodes')
      .select('*')
      .eq('user_id', userId);
      
    if (parentId === 'root') {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }
      
    const { data, error } = await query;
      
    if (error) throw error;
    return data.map(row => this.mapRowToNode(row));
  }

  async getNode(id: string): Promise<VFSNode | undefined> {
    if (id === 'root') {
      return {
        id: 'root',
        name: 'Root',
        type: 'folder',
        path: '/',
        parentId: null,
        size: 0,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        children: []
      };
    }
    const userId = await this.getUserId();
    const { data, error } = await supabase
      .from('vfs_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();
      
    if (error) throw error;
    return data ? this.mapRowToNode(data) : undefined;
  }

  async getAllFolders(): Promise<VFSNode[]> {
    const userId = await this.getUserId();
    
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock' && userId.startsWith('dev-')) {
       const existingStr = localStorage.getItem(`mock_vfs_${userId}`) || '[]';
       const existingNodes: VFSNode[] = JSON.parse(existingStr);
       return existingNodes.filter(n => n.type === 'folder');
    }
    
    const { data, error } = await supabase
      .from('vfs_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_folder', true);
      
    if (error) throw error;
    return data.map(this.mapRowToNode);
  }

  async createFolder(name: string, parentId: string): Promise<VFSNode> {
    const userId = await this.getUserId();
    const parent = await this.getNode(parentId);
    if (!parent) throw new Error('Parent not found');
    
    const path = parent.path === '/' ? `/${name}` : `${parent.path}/${name}`;
    
    if (import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock' && userId.startsWith('dev-')) {
       // Bypassing Supabase INSERT for folder creation
       const newNode: VFSNode = {
         id: `mock-folder-${Date.now()}`,
         name,
         type: 'folder',
         size: 0,
         path,
         createdAt: new Date().toISOString(),
         modifiedAt: new Date().toISOString(),
         parentId: parentId,
         children: []
       };
       const existingStr = localStorage.getItem(`mock_vfs_${userId}`) || '[]';
       const existingNodes = JSON.parse(existingStr);
       existingNodes.push(newNode);
       localStorage.setItem(`mock_vfs_${userId}`, JSON.stringify(existingNodes));
       return newNode;
    }
    
    // Boundary check to prevent 409 Conflict
    let fetchQuery = supabase
      .from('vfs_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('name', name)
      .eq('is_folder', true);
      
    if (parentId === 'root') fetchQuery = fetchQuery.is('parent_id', null);
    else fetchQuery = fetchQuery.eq('parent_id', parentId);
    
    const { data: existing, error: fetchErr } = await fetchQuery.maybeSingle();

    if (existing) {
      return this.mapRowToNode(existing);
    }
    
    const { data, error } = await supabase
      .from('vfs_nodes')
      .insert({
        name,
        path,
        parent_id: parentId === 'root' ? null : parentId,
        is_folder: true,
        user_id: userId,
        raw_ref: { createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() }
      })
      .select()
      .single();
      
    if (error) {
      if (error.code === '23505' || error.message?.includes('409') || error.message?.includes('duplicate key')) {
        let insertQuery = supabase
          .from('vfs_nodes')
          .select('*')
          .eq('user_id', userId)
          .eq('name', name)
          .eq('is_folder', true);
          
        if (parentId === 'root') insertQuery = insertQuery.is('parent_id', null);
        else insertQuery = insertQuery.eq('parent_id', parentId);
        
        const { data: fetchAfterInsert, error: fetchAfterErr } = await insertQuery.single();
        if (fetchAfterInsert) return this.mapRowToNode(fetchAfterInsert);
      }
      throw error;
    }
    return this.mapRowToNode(data);
  }

  async addFile(fileNode: Omit<VFSNode, 'children'>): Promise<VFSNode> {
    const userId = await this.getUserId();
    const parent = await this.getNode(fileNode.parentId || 'root');
    if (!parent) throw new Error('Parent not found');
    
    const path = parent.path === '/' ? `/${fileNode.name}` : `${parent.path}/${fileNode.name}`;
    
    // Boundary check to prevent 409 Conflict
    let fetchQuery = supabase
      .from('vfs_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('name', fileNode.name)
      .eq('is_folder', false);
      
    const pid = (fileNode.parentId === 'root' || !fileNode.parentId) ? null : fileNode.parentId;
    if (pid === null) fetchQuery = fetchQuery.is('parent_id', null);
    else fetchQuery = fetchQuery.eq('parent_id', pid);
    
    const { data: existing, error: fetchErr } = await fetchQuery.maybeSingle();

    if (existing) {
      // Upsert pattern: Update the existing file entry
      const { data: updated, error: updateErr } = await supabase
        .from('vfs_nodes')
        .update({
          size: fileNode.size || existing.size,
          telegram_channel_id: fileNode.telegramChannelId || existing.telegram_channel_id,
          raw_ref: { 
            googleDriveFileId: fileNode.googleDriveFileId || existing.raw_ref?.googleDriveFileId,
            telegramMessageId: fileNode.telegramMessageId || existing.raw_ref?.telegramMessageId,
            createdAt: existing.raw_ref?.createdAt || fileNode.createdAt, 
            modifiedAt: new Date().toISOString()
          }
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      return this.mapRowToNode(updated);
    }
    
    const { data, error } = await supabase
      .from('vfs_nodes')
      .insert({
        name: fileNode.name,
        path,
        parent_id: (fileNode.parentId === 'root' || !fileNode.parentId) ? null : fileNode.parentId,
        size: fileNode.size || 0,
        is_folder: false,
        telegram_channel_id: fileNode.telegramChannelId,
        user_id: userId,
        storage_ref: fileNode.storageRef,
        raw_ref: fileNode.rawRef || { 
          googleDriveFileId: fileNode.googleDriveFileId,
          telegramMessageId: fileNode.telegramMessageId,
          createdAt: fileNode.createdAt || new Date().toISOString(), 
          modifiedAt: fileNode.modifiedAt || new Date().toISOString()
        }
      })
      .select()
      .single();
      
    if (error) {
      if (error.code === '23505' || error.message?.includes('409') || error.message?.includes('duplicate key')) {
        let fetchAfterQuery = supabase
          .from('vfs_nodes')
          .select('*')
          .eq('user_id', userId)
          .eq('name', fileNode.name)
          .eq('is_folder', false);
          
        const afterPid = (fileNode.parentId === 'root' || !fileNode.parentId) ? null : fileNode.parentId;
        if (afterPid === null) fetchAfterQuery = fetchAfterQuery.is('parent_id', null);
        else fetchAfterQuery = fetchAfterQuery.eq('parent_id', afterPid);
        
        const { data: fallbackFetch, error: fallbackErr } = await fetchAfterQuery.single();
        if (fallbackFetch) return this.mapRowToNode(fallbackFetch);
      }
      throw error;
    }
    return this.mapRowToNode(data);
  }

  async deleteNode(nodeId: string): Promise<VFSNode[]> {
    if (nodeId === 'root') throw new Error('System root directory cannot be deleted.');
    const userId = await this.getUserId();
    
    // Also protect by fetching the node just in case it is "Root"
    const node = await this.getNode(nodeId);
    if (node && node.name === 'Root') throw new Error('System root directory cannot be deleted.');

    // We need to return all deleted nodes to physical layer
    const nodes = await this.loadRegistry();
    const deletedNodes: VFSNode[] = [];
    
    const collectToDelete = (currentId: string) => {
      const current = nodes.find(n => n.id === currentId);
      if (current) {
        deletedNodes.push(current);
        if (current.type === 'folder' && current.children) {
          current.children.forEach(collectToDelete);
        }
      }
    };
    
    collectToDelete(nodeId);
    const idsToDelete = deletedNodes.map(n => n.id);
    
    if (idsToDelete.length > 0) {
      const { error } = await supabase
        .from('vfs_nodes')
        .delete()
        .eq('user_id', userId)
        .in('id', idsToDelete);
        
      if (error) throw error;
    }
    
    return deletedNodes;
  }

  async moveNode(nodeId: string, newParentId: string): Promise<VFSNode> {
    if (nodeId === 'root') throw new Error('System root directory cannot be moved.');
    const userId = await this.getUserId();
    const node = await this.getNode(nodeId);
    if (node && node.name === 'Root') throw new Error('System root directory cannot be moved.');

    const newParent = await this.getNode(newParentId);
    
    if (!node || !newParent) throw new Error('Node or parent not found');
    
    const newPath = newParent.path === '/' ? `/${node.name}` : `${newParent.path}/${node.name}`;
    
    const { data, error } = await supabase
      .from('vfs_nodes')
      .update({
        parent_id: newParentId,
        path: newPath,
        raw_ref: { ...node, modifiedAt: new Date().toISOString() }
      })
      .eq('user_id', userId)
      .eq('id', nodeId)
      .select()
      .single();
      
    if (error) throw error;
    
    // We also should recursively update paths for children if it's a folder, 
    // but for now we update the parent reference which is the main foreign key.
    
    return this.mapRowToNode(data);
  }

  async copyNode(nodeId: string, targetParentId: string): Promise<VFSNode> {
    const nodeToCopy = await this.getNode(nodeId);
    if (!nodeToCopy) throw new Error('Node not found');
    
    // In a real implementation we would recurse for folders. For simplicity:
    if (nodeToCopy.type === 'folder') throw new Error('Folder copying not fully implemented in DB layer yet');
    
    return this.addFile({
      ...nodeToCopy,
      parentId: targetParentId,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    });
  }

  async renameNode(nodeId: string, newName: string): Promise<VFSNode> {
    if (nodeId === 'root') throw new Error('System root directory cannot be renamed.');
    const userId = await this.getUserId();
    const node = await this.getNode(nodeId);
    if (node && node.name === 'Root') throw new Error('System root directory cannot be renamed.');

    if (!node) throw new Error('Node not found');
    
    const oldPath = node.path;
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = parentPath === '' ? `/${newName}` : `${parentPath}/${newName}`;
    
    const { data, error } = await supabase
      .from('vfs_nodes')
      .update({
        name: newName,
        path: newPath,
        raw_ref: { ...node, modifiedAt: new Date().toISOString() }
      })
      .eq('user_id', userId)
      .eq('id', nodeId)
      .select()
      .single();
      
    if (error) throw error;
    return this.mapRowToNode(data);
  }
}

export const vfsSupabase = new VFSService();
