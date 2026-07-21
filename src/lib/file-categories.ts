import { VFSNode } from '../../types';

export const CATEGORIES = {
  IMAGES: 'Images',
  VIDEOS: 'Videos',
  DOCUMENTS: 'Documents',
  OTHER: 'Other'
} as const;

export type Category = typeof CATEGORIES[keyof typeof CATEGORIES];

export function getFileCategory(filename: string, mimeType?: string): Category {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType?.toLowerCase() || '';

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return CATEGORIES.IMAGES;
  }
  if (mime.startsWith('video/') || ['mp4', 'mkv', 'avi', 'mov', 'webm', 'ogg'].includes(ext)) {
    return CATEGORIES.VIDEOS;
  }
  if (mime === 'application/pdf' || mime === 'application/msword' || mime.includes('openxmlformats-officedocument') || mime.startsWith('text/') || ['pdf', 'docx', 'xlsx', 'pptx', 'ipynb', 'txt', 'csv'].includes(ext)) {
    return CATEGORIES.DOCUMENTS;
  }
  
  return CATEGORIES.OTHER;
}

export function calculateStorageBreakdown(nodes: VFSNode[]) {
  const breakdown = {
    images: 0,
    videos: 0,
    documents: 0,
    other: 0,
    total: 0
  };

  nodes.forEach(node => {
    if (node.type === 'file') {
      const size = node.size || 0;
      breakdown.total += size;
      const category = getFileCategory(node.name, node.mimeType);
      
      switch(category) {
        case CATEGORIES.IMAGES: breakdown.images += size; break;
        case CATEGORIES.VIDEOS: breakdown.videos += size; break;
        case CATEGORIES.DOCUMENTS: breakdown.documents += size; break;
        case CATEGORIES.OTHER: breakdown.other += size; break;
      }
    }
  });

  return breakdown;
}
