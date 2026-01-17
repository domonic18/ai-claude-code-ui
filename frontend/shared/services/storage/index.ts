/**
 * Storage Services
 *
 * Unified storage service layer for localStorage, sessionStorage, and memory.
 * Provides a consistent API with TTL support, prefix isolation, and error handling.
 */

export { BaseStorageService } from './storageService';

export { LocalStorageService } from './localStorage';
export { SessionStorageService } from './sessionStorage';
export { MemoryStorageService } from './memoryStorage';

export type {
  IStorageService,
  StorageValue,
  StorageItem,
  StorageConfig,
  StorageError,
  StorageErrorType
} from './types';

// Re-export for convenience
export { default as LocalStorage } from './localStorage';
export { default as SessionStorage } from './sessionStorage';
export { default as MemoryStorage } from './memoryStorage';
