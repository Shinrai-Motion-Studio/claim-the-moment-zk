
// Re-export all compression-related functionality from the modular structure
export * from './compression';

// Re-export the specific functions for backward compatibility
export { 
  createTokenPool, 
  claimCompressedToken 
} from './compression/poolOperations';
export { 
  createToken 
} from './compression/tokenOperations';
