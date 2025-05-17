
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction 
} from '@solana/web3.js';
import { TransactionSigner } from '../types';
import { CompressedTokenProgram } from './programs';
import { createBuffer } from '../../buffer';
import { getLightConnection } from '@/utils/compressionApi';

/**
 * Compress tokens to the state tree
 * This function is used to compress tokens from SPL to the compressed format
 */
export const compress = async (
  connection: Connection,
  payer: Keypair | TransactionSigner,
  mint: PublicKey,
  amount: number,
  owner: Keypair | TransactionSigner,
  sourceTokenAccount: PublicKey,
  recipient: PublicKey
) => {
  try {
    console.log(`Compressing ${amount} tokens of mint ${mint.toBase58()} from ${sourceTokenAccount.toBase58()} to ${recipient.toBase58()}`);
    
    // Get Light Protocol connection with proper Rpc type
    const lightConnection = getLightConnection();
    
    // In a real implementation, we would use the Light Protocol compress function directly
    // For this demo, we're using a simplified version with placeholder code
    
    // Create the compress instruction (simplified for the demo)
    const compressParams = {
      mint: mint,
      amount: amount,
      owner: owner.publicKey,
      source: sourceTokenAccount,
      destinationOwner: recipient
    };
    
    // Get the instruction data
    const compressInstructionData = CompressedTokenProgram.compress(compressParams);
    
    // Create a proper TransactionInstruction object
    const compressInstruction = new TransactionInstruction({
      programId: compressInstructionData.programId,
      keys: compressInstructionData.keys,
      data: compressInstructionData.data as Buffer
    });
    
    // Build transaction
    const tx = new Transaction();
    tx.add(compressInstruction);
    
    // Send and confirm transaction
    // In reality, signing would depend on whether owner is a Keypair or TransactionSigner
    let txid;
    if ('signTransaction' in owner) {
      tx.feePayer = owner.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signedTx = await owner.signTransaction(tx);
      txid = await connection.sendRawTransaction(signedTx.serialize());
    } else {
      txid = await sendAndConfirmTransaction(connection, tx, [payer as Keypair]);
    }
    
    return txid;
  } catch (error) {
    console.error('Error compressing tokens:', error);
    throw error;
  }
};

/**
 * Decompress tokens from the state tree
 * This function is used to decompress tokens from compressed format to SPL
 */
export const decompress = async (
  connection: Connection,
  payer: Keypair | TransactionSigner,
  mint: PublicKey,
  amount: number,
  owner: Keypair | TransactionSigner,
  destinationTokenAccount: PublicKey
) => {
  try {
    // Get Light Protocol connection with proper Rpc type
    const lightConnection = getLightConnection();
    
    // In a real implementation, this would interact with Light Protocol's decompression functions
    console.log(`Decompressing ${amount} tokens of mint ${mint.toBase58()} to ${destinationTokenAccount.toBase58()}`);
    
    // This is just a placeholder for the actual implementation
    // In a real app, we would create and send a transaction to decompress tokens
    
    return 'simulated-transaction-id';
  } catch (error) {
    console.error('Error decompressing tokens:', error);
    throw error;
  }
};

// Export the transfer function as an alias to keep compatibility with existing code
// This helps with making the transition to the new airdrop pattern smoother
export { transfer } from '@lightprotocol/compressed-token';
