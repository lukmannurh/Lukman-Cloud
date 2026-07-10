import { VFSNode } from '../../types';
import { retrieveCredential, storeCredential } from './vault.service';

/**
 * Isolated Virtual File System (VFS) Service
 * Manages the internal metadata hierarchy independently of any cloud provider's physical structure.
 * Stored securely within the encrypted vault.
 */
class VFSService {
  private memoryCache: VFSNode[] | null = null;
  private readonly STORAGE_KEY = 'vfs_registry';

  /**
   * Initialize and load the VFS registry from the encrypted vault.
   */
  async loadRegistry(): Promise<VFSNode[]> {
    if (this.memoryCache) return this.memoryCache;

    const data = await retrieveCredential(this.STORAGE_KEY as any);
    if (data) {
      try {
        const nodes: VFSNode[] = JSON.parse(data);
        this.memoryCache = nodes;
        return nodes;
      } catch (e) {
        console.error('[VFSService] Failed to parse VFS registry', e);
      }
    }

    // Initialize root folder if empty
    const rootNode: VFSNode = {
      id: 'root',
      name: 'Root',
      type: 'folder',
      path: '/',
      parentId: null,
      children: [],
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };
    
    this.memoryCache = [rootNode];
    await this.saveRegistry();
    return this.memoryCache;
  }

  /**
   * Save the current VFS state to the encrypted vault.
   */
  private async saveRegistry(): Promise<void> {
    if (!this.memoryCache) return;
    await storeCredential(this.STORAGE_KEY as any, JSON.stringify(this.memoryCache));
  }

  async getDirectoryContents(parentId: string = 'root'): Promise<VFSNode[]> {
    const nodes = await this.loadRegistry();
    return nodes.filter(n => n.parentId === parentId);
  }

  async getNode(id: string): Promise<VFSNode | undefined> {
    const nodes = await this.loadRegistry();
    return nodes.find(n => n.id === id);
  }

  async getAllFolders(): Promise<VFSNode[]> {
    const nodes = await this.loadRegistry();
    return nodes.filter(n => n.type === 'folder');
  }

  async createFolder(name: string, parentId: string = 'root'): Promise<VFSNode> {
    const nodes = await this.loadRegistry();
    const parent = nodes.find(n => n.id === parentId);
    if (!parent || parent.type !== 'folder') {
      throw new Error(`Parent folder ${parentId} not found or is not a folder.`);
    }

    const newFolder: VFSNode = {
      id: crypto.randomUUID(),
      name,
      type: 'folder',
      path: parent.path === '/' ? `/${name}` : `${parent.path}/${name}`,
      parentId,
      children: [],
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };

    parent.children?.push(newFolder.id);
    nodes.push(newFolder);
    await this.saveRegistry();
    return newFolder;
  }

  async addFile(fileNode: Omit<VFSNode, 'children'>): Promise<VFSNode> {
    const nodes = await this.loadRegistry();
    const parent = nodes.find(n => n.id === fileNode.parentId);
    if (!parent || parent.type !== 'folder') {
      throw new Error(`Parent folder ${fileNode.parentId} not found or is not a folder.`);
    }

    const newNode: VFSNode = {
      ...fileNode,
      type: 'file',
      path: parent.path === '/' ? `/${fileNode.name}` : `${parent.path}/${fileNode.name}`,
    };

    parent.children?.push(newNode.id);
    nodes.push(newNode);
    await this.saveRegistry();
    return newNode;
  }

  /**
   * Deletes a node. If it's a folder, this recursively deletes all children from the virtual index.
   * NOTE: The actual physical deletion from the cloud provider must be handled separately by iterating the returned nodes.
   * @returns Array of deleted VFSNodes (so the caller can run physical deletion on them).
   */
  async deleteNode(nodeId: string): Promise<VFSNode[]> {
    const nodes = await this.loadRegistry();
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return [];

    const node = nodes[nodeIndex];
    const deletedNodes: VFSNode[] = [];

    const recursivelyDelete = (currentId: string) => {
      const idx = this.memoryCache!.findIndex(n => n.id === currentId);
      if (idx !== -1) {
        const current = this.memoryCache![idx];
        if (current.type === 'folder' && current.children) {
          [...current.children].forEach(childId => recursivelyDelete(childId));
        }
        deletedNodes.push(current);
        this.memoryCache!.splice(idx, 1);
      }
    };

    recursivelyDelete(nodeId);

    // Remove from parent's children array
    if (node.parentId) {
      const parent = this.memoryCache!.find(n => n.id === node.parentId);
      if (parent && parent.children) {
        parent.children = parent.children.filter(id => id !== nodeId);
      }
    }

    await this.saveRegistry();
    return deletedNodes;
  }

  async moveNode(nodeId: string, newParentId: string): Promise<VFSNode> {
    const nodes = await this.loadRegistry();
    const node = nodes.find(n => n.id === nodeId);
    const newParent = nodes.find(n => n.id === newParentId);

    if (!node) throw new Error(`Node ${nodeId} not found.`);
    if (!newParent || newParent.type !== 'folder') throw new Error(`Target ${newParentId} is not a valid folder.`);

    // Remove from old parent
    if (node.parentId) {
      const oldParent = nodes.find(n => n.id === node.parentId);
      if (oldParent && oldParent.children) {
        oldParent.children = oldParent.children.filter(id => id !== nodeId);
      }
    }

    // Add to new parent
    node.parentId = newParentId;
    node.path = newParent.path === '/' ? `/${node.name}` : `${newParent.path}/${node.name}`;
    newParent.children?.push(node.id);
    node.modifiedAt = new Date().toISOString();

    // Re-calculate paths for all children if it's a folder (not implemented fully for deep trees here, but good for Phase 1)
    
    await this.saveRegistry();
    return node;
  }

  async copyNode(nodeId: string, targetParentId: string): Promise<VFSNode> {
    const nodes = await this.loadRegistry();
    const nodeToCopy = nodes.find(n => n.id === nodeId);
    const targetParent = nodes.find(n => n.id === targetParentId);

    if (!nodeToCopy) throw new Error(`Node ${nodeId} not found.`);
    if (!targetParent || targetParent.type !== 'folder') throw new Error(`Target ${targetParentId} is not a valid folder.`);

    const newId = crypto.randomUUID();
    const newNode: VFSNode = {
      ...nodeToCopy,
      id: newId,
      parentId: targetParentId,
      path: targetParent.path === '/' ? `/${nodeToCopy.name}` : `${targetParent.path}/${nodeToCopy.name}`,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      children: nodeToCopy.type === 'folder' ? [] : undefined
    };

    targetParent.children?.push(newId);
    nodes.push(newNode);

    await this.saveRegistry();
    return newNode;
  }

  async renameNode(nodeId: string, newName: string): Promise<VFSNode> {
    const nodes = await this.loadRegistry();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found.`);

    const oldPath = node.path;
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = parentPath === '' ? `/${newName}` : `${parentPath}/${newName}`;

    node.name = newName;
    node.path = newPath;
    node.modifiedAt = new Date().toISOString();

    if (node.type === 'folder') {
      const updateChildrenPaths = (parentId: string, currentPath: string) => {
        const parent = nodes.find(n => n.id === parentId);
        if (parent && parent.children) {
          parent.children.forEach(childId => {
            const child = nodes.find(n => n.id === childId);
            if (child) {
              child.path = `${currentPath}/${child.name}`;
              if (child.type === 'folder') {
                updateChildrenPaths(child.id, child.path);
              }
            }
          });
        }
      };
      updateChildrenPaths(node.id, newPath);
    }

    await this.saveRegistry();
    return node;
  }
}

export const vfsService = new VFSService();
