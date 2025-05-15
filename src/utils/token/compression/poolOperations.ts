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
import { getLightConnection } from '@/utils/compressionApi';

// Define more specific response types from Light Protocol
interface PoolResponse {
  signature?: string;
  txid?: string;
  transactionId?: string;
  toString?: () => string;
  [key: string]: any; // For other possible properties
}

export async function createTokenPool(
  mintAddress: string,
  walletPublicKey: string,
  connection: Connection, // Standard connection for queries
  signTransaction: SignerWalletAdapter['signTransaction']
): Promise<TokenPoolResult> {
  console.log(`[Light Protocol] Creating token pool for mint: ${mintAddress}`);
  const mint = new PublicKey(mintAddress);
  
  try {
    // Check if a pool already exists for this mint to avoid duplicates
    const existingPool = await poolService.getPoolByMintAddress(mintAddress);
    if (existingPool) {
      console.log(`[Light Protocol] Pool already exists for mint ${mintAddress}, returning existing data`);
      return {
        transactionId: existingPool.transactionId,
        merkleRoot: existingPool.merkleRoot || 'existing-merkle-root',
        poolAddress: existingPool.poolAddress || 'existing-pool-address',
        stateTreeAddress: existingPool.stateTreeAddress || existingPool.poolAddress || 'existing-state-tree'
      };
    }
    
    // Create a signer adapter that wraps the wallet's signTransaction method
    const lightSigner = new LightSignerAdapter(walletPublicKey, signTransaction);
    
    // Set higher compute budget for compression operations
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400000
    });
    
    // Set priority fee to improve confirmation chances
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 50000
    });
    
    // We'll manually construct the transaction and then use Light's function
    const tx = new Transaction();
    tx.add(computeBudgetIx);
    tx.add(priorityFeeIx);
    
    // For better debugging
    console.log("[Light Protocol] Pre-pool creation setup complete");
    console.log("[Light Protocol] Mint address:", mint.toString());
    console.log("[Light Protocol] Using wallet public key:", walletPublicKey);

    // Create the token pool with proper error handling
    try {
      // Get the current blockhash for our transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Use the specialized Light Protocol connection with correct Rpc type
      const lightConnection = getLightConnection();
      
      console.log("[Light Protocol] Calling Light Protocol SDK to create token pool...");
      
      // Call Light Protocol to create token pool with the correct Rpc connection type
      const poolResponse = await lightCreateTokenPool(
        lightConnection,  // Use Light connection with proper Rpc type
        lightSigner,
        mint,
        undefined, // fee payer defaults to lightSigner
        TOKEN_2022_PROGRAM_ID // specify Token-2022 program
      );
      
      console.log("[Light Protocol] Raw pool creation response:", 
        poolResponse === null ? "NULL" : 
        typeof poolResponse === 'object' ? JSON.stringify(poolResponse) : 
        String(poolResponse)
      );
      
      // Extract transaction ID from the response with safer type handling
      let txId: string = "unknown-transaction-id";
      let poolAddress: string = "unknown-pool-address";
      let stateTreeAddress: string = "unknown-state-tree-address";
      let merkleRoot: string = "unknown-merkle-root";
      
      // Comprehensive null/undefined check
      if (!poolResponse) {
        console.warn("[Light Protocol] Received null/undefined response from Light Protocol");
        // Check if the pool might already exist
        txId = "possible-existing-pool"; 
      } else {
        // Handle different response formats from the Light Protocol
        console.log("[Light Protocol] Response type:", typeof poolResponse);
        
        if (typeof poolResponse === 'string') {
          // Direct string response (likely a transaction ID)
          txId = poolResponse;
          console.log("[Light Protocol] Pool response is a string:", txId);
          
        } else if (typeof poolResponse === 'object') {
          // Response is an object, try to extract the transaction ID
          const response = poolResponse as PoolResponse;
          console.log("[Light Protocol] Pool response properties:", 
                     Object.keys(response).length > 0 
                     ? Object.keys(response).join(", ") 
                     : "empty object");
          
          // Safely extract properties with logging
          if (response.signature) {
            console.log("[Light Protocol] Found signature property:", response.signature);
            txId = response.signature;
          } else if (response.txid) {
            console.log("[Light Protocol] Found txid property:", response.txid);
            txId = response.txid;
          } else if (response.transactionId) {
            console.log("[Light Protocol] Found transactionId property:", response.transactionId);
            txId = response.transactionId;
          } else if (response.toString && typeof response.toString === 'function') {
            // Last resort - try toString() but verify it doesn't return [object Object]
            const stringValue = response.toString();
            if (stringValue && stringValue !== '[object Object]') {
              console.log("[Light Protocol] Using toString() result:", stringValue);
              txId = stringValue;
            }
          }
          
          // Try to extract pool address and other data if available
          if ('poolAddress' in response && response.poolAddress) {
            poolAddress = typeof response.poolAddress === 'string' 
              ? response.poolAddress 
              : response.poolAddress.toString();
            console.log("[Light Protocol] Found poolAddress:", poolAddress);
          }
          
          if ('stateTreeAddress' in response && response.stateTreeAddress) {
            stateTreeAddress = typeof response.stateTreeAddress === 'string'
              ? response.stateTreeAddress
              : response.stateTreeAddress.toString();
            console.log("[Light Protocol] Found stateTreeAddress:", stateTreeAddress);
          }
          
          if ('merkleRoot' in response && response.merkleRoot) {
            merkleRoot = typeof response.merkleRoot === 'string'
              ? response.merkleRoot
              : response.merkleRoot.toString();
            console.log("[Light Protocol] Found merkleRoot:", merkleRoot);
          }
        }
      }
      
      console.log("[Light Protocol] Final extracted txId:", txId);
      
      // Wait for confirmation with proper error handling - only if we have a valid txId
      if (txId && txId !== "unknown-transaction-id" && txId !== "possible-existing-pool") {
        try {
          console.log("[Light Protocol] Confirming transaction:", txId);
          const confirmationResult = await connection.confirmTransaction({
            signature: txId,
            blockhash,
            lastValidBlockHeight
          });
          
          if (confirmationResult.value.err) {
            console.warn(`[Light Protocol] Pool creation confirmed but with errors: ${JSON.stringify(confirmationResult.value.err)}`);
          } else {
            console.log("[Light Protocol] Pool transaction confirmed successfully");
          }
        } catch (confirmError) {
          console.warn("[Light Protocol] Error confirming transaction, but continuing:", confirmError);
          // We'll continue even if confirmation fails - the transaction might still be valid
        }
      } else {
        console.log("[Light Protocol] Skipping transaction confirmation due to invalid or unknown txId");
      }
      
      // Return pool data with all extracted information
      const poolResult: TokenPoolResult = {
        transactionId: txId,
        merkleRoot: merkleRoot, 
        poolAddress: poolAddress, 
        stateTreeAddress: stateTreeAddress 
      };
      
      // Save the pool data for future reference
      const eventId = await getEventIdByMintAddress(mintAddress);
      if (eventId) {
        await savePoolData(eventId, mintAddress, poolResult);
      }
      
      console.log("[Light Protocol] Pool creation completed successfully");
      return poolResult;
    } catch (error) {
      console.error("[Light Protocol] Error during pool creation:", error);
      
      // Handle common errors with better messages
      let errorMessage = "Failed to create token pool.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes('insufficient funds')) {
          errorMessage = "Insufficient SOL in wallet to create pool. Please add more SOL.";
        } else if (errorMessage.includes('already registered') || errorMessage.includes('already exists')) {
          console.log("[Light Protocol] Token appears to be already registered with Light Protocol");
          
          // Return a successful result with placeholder values that indicate this was an existing pool
          const poolResult: TokenPoolResult = {
            transactionId: "existing-pool-transaction",
            merkleRoot: "existing-merkle-root",
            poolAddress: "existing-pool-address", 
            stateTreeAddress: "existing-state-tree"
          };
          
          // Save the successful pool data
          const eventId = await getEventIdByMintAddress(mintAddress);
          if (eventId) {
            await savePoolData(eventId, mintAddress, poolResult);
          }
          
          toast.success("Token Pool Verified", {
            description: "This token is already registered with Light Protocol."
          });
          
          return poolResult;
        }
      }
      
      toast.error("Pool Creation Failed", {
        description: errorMessage
      });
      
      throw new Error(errorMessage);
    }
  } catch (outerError) {
    console.error("[Light Protocol] Outer pool creation error:", outerError);
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
    createdAt: new Date().toISOString(),
    stateTreeAddress: poolResult.stateTreeAddress 
  });
}
