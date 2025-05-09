
import { 
  Connection, 
  PublicKey,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';
import { TOKEN_2022_PROGRAM_ID, TokenPoolResult } from '../types';
import { CompressedTokenProgram } from './programs';
import { createBuffer } from '../../buffer';

// Create a token pool for Light Protocol compression
export const createTokenPool = async (
  mintAddress: string,
  walletAddress: string,
  connection: Connection,
  signTransaction: SignerWalletAdapter['signTransaction']
): Promise<TokenPoolResult> => {
  console.log('Creating token pool for mint:', mintAddress);
  
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const walletPubkey = new PublicKey(walletAddress);
    
    // Create the token pool instruction
    const poolInstructionData = CompressedTokenProgram.createTokenPoolInstruction({ 
      mint: mintPubkey,
      payer: walletPubkey,
      programId: TOKEN_2022_PROGRAM_ID
    });
    
    // Create a proper TransactionInstruction object
    // Use type assertion here to resolve the TypeScript error
    const poolInstruction = new TransactionInstruction({
      programId: poolInstructionData.programId,
      keys: poolInstructionData.keys,
      data: poolInstructionData.data as Buffer
    });
    
    // Create and sign the transaction
    const tx = new Transaction().add(poolInstruction);
    tx.feePayer = walletPubkey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    const signedTx = await signTransaction(tx);
    const txId = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(txId, 'confirmed');
    
    console.log('Token pool created with tx:', txId);

    // Return the transaction ID and a placeholder merkle root
    // In a real implementation, we would get the merkle root from the transaction result
    return {
      transactionId: txId,
      merkleRoot: `merkle-root-${Date.now()}`
    };
  } catch (error) {
    console.error('Error creating token pool:', error);
    throw new Error(`Failed to create token pool: ${error instanceof Error ? error.message : String(error)}`);
  }
};
