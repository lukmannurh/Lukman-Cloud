import { vfsSupabase } from './vfs.supabase.service';
import { vfsService as vfsMemory } from './vfs.memory.service';

/**
 * VFS Router
 * Uses the Supabase Postgres edition in production to enforce Rigid Multi-Tenant Isolation
 * Uses the memory-based edition in tests to validate standard Virtual File System logic without network mocks.
 */
export const vfsService = import.meta.env.MODE === 'test' ? vfsMemory : vfsSupabase;
