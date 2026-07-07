/**
 * Type guard unit tests (Milestone 1.2 / Task 1.3)
 * Validates: isVFSFile, isVFSFolder, isGoogleDriveRef, isTelegramRef,
 *            validateTelegramRef, validateFolderDocument
 */

import { describe, it, expect } from 'vitest';
import {
  isVFSFile,
  isVFSFolder,
  isGoogleDriveRef,
  isTelegramRef,
  validateTelegramRef,
  validateFolderDocument,
} from '../types';
import type { VFSFile, VFSFolder, GoogleDriveRef, TelegramRef, FolderDocument } from '../types';

// ── Test Fixtures ─────────────────────────────────────────────────────────────

const mockGoogleDriveRef: GoogleDriveRef = {
  provider: 'google_drive',
  driveFileId: 'drive-file-id-001',
  mimeType: 'application/pdf',
  md5Checksum: 'abc123',
};

const mockTelegramRef: TelegramRef = {
  provider: 'telegram',
  channelId: '-1001234567890',
  originalFilename: 'document.pdf',
  sha256Hash: 'sha256hashvalue',
  totalParts: 2,
  chunks: [
    { partIndex: 0, messageId: 1001, chunkSize: 1024 * 1024 * 1024 },
    { partIndex: 1, messageId: 1002, chunkSize: 512 * 1024 * 1024 },
  ],
};

const mockFile: VFSFile = {
  id: 'file-uuid-001',
  type: 'file',
  name: 'document.pdf',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
  starred: false,
  mimeType: 'application/pdf',
  size: 1536 * 1024 * 1024,
  uploadStatus: 'complete',
  ref: mockTelegramRef,
};

const mockFolder: VFSFolder = {
  id: 'folder-uuid-001',
  type: 'folder',
  name: 'My Documents',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
  starred: false,
  folderId: 'folder-uuid-001',
  folderDocumentDriveId: 'drive-folder-doc-id-001',
};

const mockFolderDocument: FolderDocument = {
  schemaVersion: 1,
  folderId: 'root',
  parentFolderId: null,
  folderName: 'Root',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
  etag: 'etag-value-001',
  selfDriveId: 'drive-root-doc-id',
  entries: [mockFile, mockFolder],
};

// ── Type Guard Tests ──────────────────────────────────────────────────────────

describe('isVFSFile', () => {
  it('returns true for VFSFile', () => {
    expect(isVFSFile(mockFile)).toBe(true);
  });
  it('returns false for VFSFolder', () => {
    expect(isVFSFile(mockFolder)).toBe(false);
  });
});

describe('isVFSFolder', () => {
  it('returns true for VFSFolder', () => {
    expect(isVFSFolder(mockFolder)).toBe(true);
  });
  it('returns false for VFSFile', () => {
    expect(isVFSFolder(mockFile)).toBe(false);
  });
});

describe('isGoogleDriveRef', () => {
  it('returns true for GoogleDriveRef', () => {
    expect(isGoogleDriveRef(mockGoogleDriveRef)).toBe(true);
  });
  it('returns false for TelegramRef', () => {
    expect(isGoogleDriveRef(mockTelegramRef)).toBe(false);
  });
});

describe('isTelegramRef', () => {
  it('returns true for TelegramRef', () => {
    expect(isTelegramRef(mockTelegramRef)).toBe(true);
  });
  it('returns false for GoogleDriveRef', () => {
    expect(isTelegramRef(mockGoogleDriveRef)).toBe(false);
  });
});

// ── TelegramRef Invariant Tests ───────────────────────────────────────────────

describe('validateTelegramRef', () => {
  it('passes for a valid ref with correct invariants', () => {
    const result = validateTelegramRef(mockTelegramRef);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('fails INV-01 when totalParts != chunks.length', () => {
    const invalidRef: TelegramRef = { ...mockTelegramRef, totalParts: 5 };
    const result = validateTelegramRef(invalidRef);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('INV-01'))).toBe(true);
  });

  it('fails INV-02 when partIndex is out of order', () => {
    const invalidRef: TelegramRef = {
      ...mockTelegramRef,
      chunks: [
        { partIndex: 1, messageId: 1001, chunkSize: 1024 }, // wrong: should be 0
        { partIndex: 0, messageId: 1002, chunkSize: 1024 }, // wrong: should be 1
      ],
    };
    const result = validateTelegramRef(invalidRef);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('INV-02'))).toBe(true);
  });
});

// ── FolderDocument Validation Tests ──────────────────────────────────────────

describe('validateFolderDocument', () => {
  it('passes for a valid root folder document', () => {
    const result = validateFolderDocument(mockFolderDocument);
    expect(result.valid).toBe(true);
  });

  it('fails when non-root folder has null parentFolderId', () => {
    const invalidDoc: FolderDocument = {
      ...mockFolderDocument,
      folderId: 'some-uuid-v4',
      parentFolderId: null, // must not be null for non-root
    };
    const result = validateFolderDocument(invalidDoc);
    expect(result.valid).toBe(false);
  });

  it('fails when root folder has non-null parentFolderId', () => {
    const invalidDoc: FolderDocument = {
      ...mockFolderDocument,
      folderId: 'root',
      parentFolderId: 'some-uuid', // root must have null parentFolderId
    };
    const result = validateFolderDocument(invalidDoc);
    expect(result.valid).toBe(false);
  });

  it('fails when etag is empty', () => {
    const invalidDoc: FolderDocument = { ...mockFolderDocument, etag: '' };
    const result = validateFolderDocument(invalidDoc);
    expect(result.valid).toBe(false);
  });

  it('fails when selfDriveId is empty', () => {
    const invalidDoc: FolderDocument = { ...mockFolderDocument, selfDriveId: '' };
    const result = validateFolderDocument(invalidDoc);
    expect(result.valid).toBe(false);
  });
});
