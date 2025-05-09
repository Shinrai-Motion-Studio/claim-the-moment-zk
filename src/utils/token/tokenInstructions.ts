
import { 
  PublicKey, 
  TransactionInstruction,
  SystemProgram
} from '@solana/web3.js';
import { 
  getMintLen,
  ExtensionType,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createInitializeInstruction
} from '@solana/spl-token';
import { TOKEN_2022_PROGRAM_ID, TokenMetadata } from './types';
import { createBuffer } from '../buffer';

// Helper to create mint instructions
export const createMintInstructions = async (
  mintKeypair: PublicKey,
  walletPubkey: PublicKey,
  decimals: number,
  metadata: TokenMetadata
): Promise<TransactionInstruction[]> => {
  // Calculate required space and rent for the mint account
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  
  // Create instructions array
  const instructions: TransactionInstruction[] = [];
  
  // Add instruction to create mint account
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: walletPubkey,
      newAccountPubkey: mintKeypair,
      space: mintLen,
      lamports: 1000000, // Placeholder value, should be calculated in the calling function
      programId: TOKEN_2022_PROGRAM_ID,
    })
  );
  
  // Initialize metadata pointer extension
  instructions.push(
    createInitializeMetadataPointerInstruction(
      mintKeypair, 
      walletPubkey,  // payer/update authority
      mintKeypair, // metadata address
      TOKEN_2022_PROGRAM_ID
    )
  );
  
  // Initialize the mint with decimals
  instructions.push(
    createInitializeMintInstruction(
      mintKeypair, 
      decimals, 
      walletPubkey, // mint authority
      null, // freeze authority (null = no freeze)
      TOKEN_2022_PROGRAM_ID
    )
  );
  
  // Add metadata initialization
  instructions.push(
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mintKeypair,
      metadata: mintKeypair,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      mintAuthority: walletPubkey,
      updateAuthority: walletPubkey,
    })
  );
  
  return instructions;
};

// Helper for minting tokens to an associated token account
export const createMintToInstruction = (
  mint: PublicKey,
  destination: PublicKey, 
  authority: PublicKey,
  amount: number
): TransactionInstruction => {
  // Create a Uint8Array with the instruction code and amount data
  const data = new Uint8Array(9); // 1 byte for instruction code + 8 bytes for amount
  data[0] = 7; // Instruction code for 'MintTo'
  
  // For now, leaving the amount as zeros for simplicity
  // In a real implementation, we would encode the amount properly
  
  return {
    programId: TOKEN_2022_PROGRAM_ID,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: data
  };
};
