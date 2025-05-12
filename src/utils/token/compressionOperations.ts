
// Re-export all compression-related functionality from the modular structure
export * from './compression';

// Re-export the specific functions for backward compatibility
export { 
  createTokenPool 
} from './compression/poolOperations';

// Export the claim token functionality
export { 
  claimCompressedToken 
} from './compression/claimOperations';

// Export token creation functionality
export { 
  compress,
  decompress
} from './compression/tokenOperations';
