
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SendOptions,
} from '@solana/web3.js';
import { createRpc } from '@lightprotocol/stateless.js';
import { toast } from 'sonner';

// Use Helius RPC endpoints for Light Protocol support
const NETWORK = 'devnet';
const HELIUS_API_KEY = '9aeaaaaa-ac88-42a4-8f49-7b0c23cee762'; // Devnet test key
const RPC_URL = `https://${NETWORK}.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Light Protocol specific endpoints
const LIGHT_COMPRESSION_ENDPOINT = RPC_URL;
const LIGHT_PROVER_ENDPOINT = RPC_URL;

/**
 * Get a Solana connection using Helius RPC with Light Protocol support
 */
export const getSolanaConnection = (): Connection => {
  console.log(`[Light Protocol] Creating standard connection to ${NETWORK}`);
  
  // Create connection with proper configuration for browser
  return new Connection(RPC_URL, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
    wsEndpoint: `wss://${NETWORK}.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  });
};

/**
 * Get Light Protocol specific connection with compression support
 * Uses createRpc from Light Protocol SDK for proper compression setup
 */
export const getLightConnection = (): Connection => {
  console.log('[Light Protocol] Creating specialized Light Protocol connection');
  
  try {
    // Use Light Protocol's createRpc function for proper setup
    const connection = createRpc(
      RPC_URL,               // Standard RPC
      LIGHT_COMPRESSION_ENDPOINT,  // Compression endpoint
      LIGHT_PROVER_ENDPOINT        // Prover endpoint
    );
    
    console.log('[Light Protocol] Light connection created successfully');
    return connection;
  } catch (error) {
    console.error('[Light Protocol] Error creating Light connection:', error);
    
    // Fallback to standard connection if Light's createRpc fails
    console.warn('[Light Protocol] Falling back to standard connection');
    return getSolanaConnection();
  }
};

/**
 * Get a Light Protocol RPC connection (alias for getLightConnection)
 */
export const getLightRpc = getLightConnection;

/**
 * Send transaction with automatic error handling and improved debugging
 */
export const sendAndConfirmTransaction = async (
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  options?: SendOptions
): Promise<string> => {
  try {
    console.log('[Light Protocol] Sending transaction with',
               transaction.instructions.length,
               'instructions');
    
    // Log instruction programs for debugging
    transaction.instructions.forEach((ix, i) => {
      console.log(`[Light Protocol] Instruction ${i}: Program ${ix.programId.toString()}`);
    });
    
    // Send the transaction with standard options
    const signature = await connection.sendTransaction(transaction, signers, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
      ...options
    });
    
    console.log(`[Light Protocol] Transaction sent with ID: ${signature}`);
    
    // Wait for confirmation with improved error handling
    console.log('[Light Protocol] Waiting for confirmation...');
    
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: transaction.recentBlockhash || (await connection.getLatestBlockhash()).blockhash,
      lastValidBlockHeight: (await connection.getBlockHeight()) + 150
    }, 'confirmed');
    
    if (confirmation.value.err) {
      console.error(`[Light Protocol] Transaction confirmed with error: ${JSON.stringify(confirmation.value.err)}`);
      throw new Error(`Transaction error: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    console.log('[Light Protocol] Transaction confirmed successfully');
    return signature;
  } catch (error) {
    console.error('[Light Protocol] Error sending/confirming transaction:', error);
    
    // Improved error reporting
    if (error instanceof Error) {
      let errorMessage = error.message;
      
      // Extract more informative message if possible
      if (errorMessage.includes('Transaction simulation failed')) {
        errorMessage = 'Transaction simulation failed. This could be due to account sizing issues or insufficient SOL.';
      }
      
      toast.error('Transaction Failed', { 
        description: errorMessage 
      });
    }
    
    throw error;
  }
};

/**
 * Verify if a user has claimed a token for an event
 */
export const verifyTokenClaim = async (
  eventId: string,
  walletAddress: string
): Promise<boolean> => {
  // Import claimService from db to avoid circular imports
  const { claimService } = await import('@/lib/db');
  
  // Check if this wallet has claimed a token for this event
  return await claimService.hasWalletClaimedEvent(eventId, walletAddress);
};

// Export for convenience
export const getDevnetConnection = getSolanaConnection;
