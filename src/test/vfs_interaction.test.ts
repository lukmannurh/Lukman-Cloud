import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vfsService } from '../lib/services/vfs.service';
import * as vaultService from '../lib/services/storage.service';
import { VFSNode } from '../types';

describe('VFS UI Interaction flows', () => {
  let mockRegistry: any[] = [];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRegistry = [];
    
    vi.spyOn(vaultService, 'retrieveCredential').mockImplementation(async (key) => {
      if (key === 'vfs_registry' && mockRegistry.length > 0) {
        return JSON.stringify(mockRegistry);
      }
      return null;
    });

    vi.spyOn(vaultService, 'storeCredential').mockImplementation(async (key, value) => {
      if (key === 'vfs_registry') {
        mockRegistry = JSON.parse(value);
      }
    });
    
    // Force reset the memory cache (using any to bypass private)
    (vfsService as any).memoryCache = null;
    await vfsService.loadRegistry();
  });

  it('allows creating virtual folders inside root', async () => {
    const rootContents = await vfsService.getDirectoryContents('root');
    expect(rootContents.length).toBe(0);

    const newFolder = await vfsService.createFolder('My Documents', 'root');
    expect(newFolder.name).toBe('My Documents');
    expect(newFolder.path).toBe('/My Documents');
    expect(newFolder.parentId).toBe('root');
    
    const updatedContents = await vfsService.getDirectoryContents('root');
    expect(updatedContents.length).toBe(1);
    expect(updatedContents[0].id).toBe(newFolder.id);
  });

  it('can recursively fetch all folders for the move picker', async () => {
    const rootChild = await vfsService.createFolder('Projects', 'root');
    const nestedChild = await vfsService.createFolder('Secret Project', rootChild.id);
    const deepChild = await vfsService.createFolder('Assets', nestedChild.id);

    const allFolders = await vfsService.getAllFolders();
    
    // allFolders should contain root + 3 children = 4
    expect(allFolders.length).toBe(4);
    
    const paths = allFolders.map(f => f.path).sort();
    expect(paths).toEqual([
      '/',
      '/Projects',
      '/Projects/Secret Project',
      '/Projects/Secret Project/Assets'
    ].sort());
  });

  it('handles simulated drag-and-drop reassignment', async () => {
    // Setup 2 folders and 1 file
    const sourceFolder = await vfsService.createFolder('Source', 'root');
    const targetFolder = await vfsService.createFolder('Target', 'root');

    const fileNode = await vfsService.addFile({
      id: 'file-123',
      name: 'report.pdf',
      parentId: sourceFolder.id,
      path: '',
      size: 1024,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    });

    expect(fileNode.parentId).toBe(sourceFolder.id);
    expect(fileNode.path).toBe('/Source/report.pdf');

    // Simulate Drop Event (moveNode)
    const movedNode = await vfsService.moveNode(fileNode.id, targetFolder.id);

    expect(movedNode.parentId).toBe(targetFolder.id);
    expect(movedNode.path).toBe('/Target/report.pdf');

    const targetContents = await vfsService.getDirectoryContents(targetFolder.id);
    expect(targetContents.length).toBe(1);
    expect(targetContents[0].id).toBe(fileNode.id);

    const sourceContents = await vfsService.getDirectoryContents(sourceFolder.id);
    expect(sourceContents.length).toBe(0);
  });

  it('safely deletes nodes and isolates children during cascade', async () => {
    const parentFolder = await vfsService.createFolder('Parent', 'root');
    await vfsService.createFolder('Child', parentFolder.id);
    await vfsService.addFile({
      id: 'file-xyz',
      name: 'test.txt',
      parentId: parentFolder.id,
      path: '',
      size: 500,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    });

    // Verify they exist
    let all = await (vfsService as any).loadRegistry();
    // root (1) + parent (1) + child (1) + file (1) = 4
    expect(all.length).toBe(4);

    // Delete Parent
    const deletedNodes = await vfsService.deleteNode(parentFolder.id);
    
    // It should have deleted the parent, child, and file = 3 nodes
    expect(deletedNodes.length).toBe(3);
    
    // Ensure they are gone from the registry
    all = await (vfsService as any).loadRegistry();
    expect(all.length).toBe(1); // Only root remains
    expect(all[0].id).toBe('root');
  });
});
