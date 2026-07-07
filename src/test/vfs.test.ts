import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vfsService } from '../lib/services/vfs.service';
import * as vaultService from '../lib/services/vault.service';

describe('Virtual File System (VFS)', () => {
  let mockRegistry: any[] = [];

  beforeEach(() => {
    mockRegistry = [];
    
    // Mock the vault service retrieve/store
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

    // Reset VFS service internal memory cache
    (vfsService as any).memoryCache = null;
  });

  it('initializes a root folder if registry is empty', async () => {
    const rootNodes = await vfsService.getDirectoryContents('root');
    expect(rootNodes.length).toBe(0); // Root has no children initially
    
    const root = await vfsService.getNode('root');
    expect(root).toBeDefined();
    expect(root?.type).toBe('folder');
    expect(root?.path).toBe('/');
  });

  it('validates Folder Creation (vfsService.createFolder appends a new folder node)', async () => {
    const root = await vfsService.getNode('root');
    
    const newFolder = await vfsService.createFolder('Projects', 'root');
    expect(newFolder.name).toBe('Projects');
    expect(newFolder.parentId).toBe('root');
    expect(newFolder.type).toBe('folder');
    
    // Check if it appears in root directory contents
    const rootContents = await vfsService.getDirectoryContents('root');
    expect(rootContents.length).toBe(1);
    expect(rootContents[0].id).toBe(newFolder.id);

    // Verify root node's children array is updated
    const updatedRoot = await vfsService.getNode('root');
    expect(updatedRoot?.children).toContain(newFolder.id);
  });

  it('validates Path Traversal (navigating into a child folder updates scope)', async () => {
    // Create folders: Root -> Docs -> Personal
    const docs = await vfsService.createFolder('Docs', 'root');
    const personal = await vfsService.createFolder('Personal', docs.id);

    // Add file inside Docs
    await vfsService.addFile({
      id: 'file-1',
      name: 'notes.txt',
      type: 'file',
      path: '',
      parentId: docs.id,
      createdAt: '',
      modifiedAt: ''
    });

    // Fetch Docs contents
    const docsContents = await vfsService.getDirectoryContents(docs.id);
    
    // Assert scope traversal accuracy
    expect(docsContents.length).toBe(2);
    const types = docsContents.map(n => n.type);
    expect(types).toContain('folder'); // Personal
    expect(types).toContain('file'); // notes.txt

    // Ensure they reference the correct parent
    expect(docsContents[0].parentId).toBe(docs.id);
    expect(docsContents[1].parentId).toBe(docs.id);
  });

  it('validates Isolated Node Deletion (removes tracking reference without touching unrelated files)', async () => {
    // Setup: Root -> [Folder A, Folder B]
    const folderA = await vfsService.createFolder('Folder A', 'root');
    const folderB = await vfsService.createFolder('Folder B', 'root');

    // Add files
    const file1 = await vfsService.addFile({
      id: 'file-1',
      name: 'target.txt',
      type: 'file',
      path: '',
      parentId: folderA.id,
      createdAt: '',
      modifiedAt: ''
    });
    const file2 = await vfsService.addFile({
      id: 'file-2',
      name: 'safe.txt',
      type: 'file',
      path: '',
      parentId: folderA.id,
      createdAt: '',
      modifiedAt: ''
    });

    // Delete file1
    const deletedNodes = await vfsService.deleteNode(file1.id);
    
    // Assert returned deleted array
    expect(deletedNodes.length).toBe(1);
    expect(deletedNodes[0].id).toBe(file1.id);

    // Assert file1 is gone from Vault/VFS map
    const nodeCheck = await vfsService.getNode(file1.id);
    expect(nodeCheck).toBeUndefined();

    // Assert adjacent files are completely untouched
    const adjacentCheck = await vfsService.getNode(file2.id);
    expect(adjacentCheck).toBeDefined();
    expect(adjacentCheck?.name).toBe('safe.txt');

    // Assert unrelated folders are untouched
    const folderCheck = await vfsService.getNode(folderB.id);
    expect(folderCheck).toBeDefined();

    // Assert parent's children array no longer contains file1
    const parentA = await vfsService.getNode(folderA.id);
    expect(parentA?.children).not.toContain(file1.id);
    expect(parentA?.children).toContain(file2.id);
  });
});
