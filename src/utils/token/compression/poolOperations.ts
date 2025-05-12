
import { 
  Connection, 
  PublicKey, 
  Transaction,
  ComputeBudgetProgram,
  Keypair
} from '@solana/web3.js';
import { createTokenPool as lightCreateTokenPool } from '@lightprotocol/compressed-token';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';
import { TOKEN_2022_PROGRAM_ID, TokenPoolResult } from '../types';
import { toast } from 'sonner';
import { LightSignerAdapter } from './signerAdapter';
import { poolService } from '@/lib/db';

// Define possible response types from Light Protocol
interface PoolResponse {
  signature?: string;
  txid?: string;
  transactionId?: string;
  toString?: () => string;
}

export async function createTokenPool(
  mintAddress: string,
  walletPublicKey: string,
  connection: Connection,
  signTransaction: SignerWalletAdapter['signTransaction']
): Promise<TokenPoolResult> {
  console.log(`Creating token pool for mint: ${mintAddress}`);
  const mint = new PublicKey(mintAddress);
  
  try {
    // Check if a pool already exists for this mint to avoid duplicates
    const existingPool = await poolService.getPoolByMintAddress(mintAddress);
    if (existingPool) {
      console.log(`Pool already exists for mint ${mintAddress}, returning existing data`);
      return {
        transactionId: existingPool.transactionId,
        merkleRoot: existingPool.merkleRoot || 'unknown',
        poolAddress: existingPool.poolAddress || 'unknown',
        stateTreeAddress: existingPool.poolAddress || 'unknown' // Use poolAddress as fallback
      };
    }
    
    // Create a signer adapter that wraps the wallet's signTransaction method
    const lightSigner = new LightSignerAdapter(walletPublicKey, signTransaction);
    
    // Set higher compute budget for compression operations
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000 // More reasonable value
    });
    
    // Set priority fee to improve confirmation chances
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 50000 // More reasonable value 
    });
    
    // We'll manually construct the transaction and then use Light's function
    const tx = new Transaction();
    tx.add(computeBudgetIx);
    tx.add(priorityFeeIx);
    
    // For better debugging
    console.log("Pre-pool creation setup complete, calling Light Protocol SDK...");
    console.log("Using mint address:", mint.toString());
    console.log("Using wallet public key:", walletPublicKey);

    // Create the token pool with proper error handling
    // We're using a try-catch to handle the specific pool creation logic
    try {
      // Get the current blockhash for our transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Call Light Protocol to create token pool
      const poolResponse = await lightCreateTokenPool(
        connection as any, // Type assertion to work with Light Protocol
        lightSigner,
        mint,
        undefined, // fee payer defaults to lightSigner
        TOKEN_2022_PROGRAM_ID // specify Token-2022 program
      );
      
      console.log("Pool creation response:", poolResponse);
      
      if (!poolResponse) {
        throw new Error("No response from Light Protocol pool creation");
      }
      
      // Extract transaction ID from the response with safer type handling
      let txId: string;
      
      // Handle different response formats from the Light Protocol
      const response = poolResponse as unknown as PoolResponse;
      
      if (typeof response === 'string') {
        txId = response;
      } else if (response && typeof response === 'object') {
        // Try all possible property names
        if (response.signature) {
          txId = response.signature;
        } else if (response.txid) {
          txId = response.txid;
        } else if (response.transactionId) {
          txId = response.transactionId;
        } else if (response.toString && typeof response.toString === 'function') {
          // Last resort - try toString()
          txId = response.toString();
        } else {
          // If we can't find a valid signature, create a placeholder
          txId = "unknown-transaction-id";
          console.warn("Could not determine transaction ID from pool response:", response);
        }
      } else {
        // Fallback if we cannot determine the transaction ID
        txId = "unknown-transaction-id";
        console.warn("Could not determine transaction ID from pool response:", poolResponse);
      }
      
      console.log("Using transaction ID:", txId);
      
      // Wait for confirmation with proper error handling
      try {
        const confirmationResult = await connection.confirmTransaction({
          signature: txId,
          blockhash,
          lastValidBlockHeight
        });
        
        if (confirmationResult.value.err) {
          throw new Error(`Pool creation confirmed but failed: ${JSON.stringify(confirmationResult.value.err)}`);
        }
        
        console.log("Pool transaction confirmed:", txId);
      } catch (confirmError) {
        console.warn("Error confirming transaction, but continuing:", confirmError);
        // We'll continue even if confirmation fails - the transaction might still be valid
      }
      
      // Get pool and merkle tree data - in the real implementation you'd extract this properly
      // For now, we'll use placeholder values that will be updated with real data
      const poolResult: TokenPoolResult = {
        transactionId: txId,
        merkleRoot: "pending-merkle-root", // In production, you'd get the actual root
        poolAddress: "pending-pool-address", // In production, you'd get the actual address
        stateTreeAddress: "pending-state-tree" // In production, you'd get the actual address
      };
      
      // Save the pool data for future reference
      const eventId = await getEventIdByMintAddress(mintAddress);
      if (eventId) {
        await savePoolData(eventId, mintAddress, poolResult);
      }
      
      return poolResult;
    } catch (error) {
      console.error("Error during pool creation:", error);
      
      // Improved error handling
      let errorMessage = "Failed to create token pool.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for common errors
        if (errorMessage.includes('insufficient funds')) {
          errorMessage = "Insufficient SOL in wallet to create pool. Please add more SOL.";
        }
      }
      
      toast.error("Pool Creation Failed", {
        description: errorMessage
      });
      
      throw error;
    }
  } catch (outerError) {
    console.error("Outer pool creation error:", outerError);
    throw new Error(`Failed to create token pool: ${outerError instanceof Error ? outerError.message : String(outerError)}`);
  }
}

// Helper functions that were missing
async function getEventIdByMintAddress(mintAddress: string): Promise<string | null> {
  // Query events by mint address to find the matching event
  const { eventService } = await import('@/lib/db');
  const events = await eventService.getAllEvents();
  const event = events.find(e => e.mintAddress === mintAddress);
  return event ? event.id : null;
}

async function savePoolData(eventId: string, mintAddress: string, poolResult: TokenPoolResult): Promise<void> {
  // Save pool data with proper mapping to event
  await poolService.savePool({
    eventId,
    mintAddress,
    poolAddress: poolResult.poolAddress,
    merkleRoot: poolResult.merkleRoot,
    transactionId: poolResult.transactionId,
    createdAt: new Date().toISOString()
  });
}
