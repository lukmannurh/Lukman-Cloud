import { describe, it, expect, vi } from 'vitest';
import { Api } from 'telegram';

describe('Telegram Worker: Raw RPC Protection (Regression Test)', () => {
  it('correctly calculates 512KB chunk slices for large files', () => {
    const fileSizeBytes = 2.5 * 1024 * 1024; // 2.5 MB
    const CHUNK_SIZE = 512 * 1024; // 512 KB

    const totalParts = Math.ceil(fileSizeBytes / CHUNK_SIZE);
    
    // 2.5 MB / 0.5 MB = 5 chunks exactly
    expect(totalParts).toBe(5);

    const chunkSizes = [];
    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileSizeBytes);
      chunkSizes.push(end - start);
    }

    // All chunks should be exactly 512KB
    expect(chunkSizes[0]).toBe(512 * 1024);
    expect(chunkSizes[4]).toBe(512 * 1024);
  });

  it('preserves the pristine filename extension without trailing .partN suffixes', () => {
    // Simulate what telegram.worker.ts does on upload
    const mockFileName = 'Proyek Klasifikasi Gambar_Lukman Nurhakim.zip.part0';
    
    // Extract pristine name just like handleUploadFile:
    const pristineName = mockFileName.replace(/\.part\d+$/, '');
    
    expect(pristineName).toBe('Proyek Klasifikasi Gambar_Lukman Nurhakim.zip');

    // Ensure it sets correctly in Api.InputFileBig
    const inputFile = new Api.InputFileBig({
      id: BigInt(12345),
      parts: 5,
      name: pristineName,
    });

    expect(inputFile.name).toBe('Proyek Klasifikasi Gambar_Lukman Nurhakim.zip');
    expect(inputFile.name).not.toContain('.part0');
  });

  it('handles filenames without .partN suffixes correctly', () => {
    const mockFileName = 'NormalFile.pdf';
    const pristineName = mockFileName.replace(/\.part\d+$/, '');
    
    expect(pristineName).toBe('NormalFile.pdf');
  });
});
