import Dexie, { Table } from 'dexie';

export interface EventRecord {
  id?: number;
  title: string;
  location: string;
  date: string;
  time: string;
  description: string;
  attendeeCount: number;
  symbol: string;
  decimals: number;
  imageUrl: string;
  mintAddress: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface PoolRecord {
  id?: number;
  eventId: string;
  mintAddress: string;
  poolAddress: string;
  merkleRoot?: string;
  stateTreeAddress?: string;
  transactionId: string;
  compressedAmount?: number;
  compressionTxId?: string;
  compressedAt?: string;
  createdAt: string;
}

export interface ClaimRecord {
  id?: number;
  eventId: string;
  walletAddress: string;
  status: 'pending' | 'confirmed' | 'failed';
  transactionId?: string;
  errorMessage?: string;
  createdAt: string;
}

export class MyDatabase extends Dexie {
  events!: Table<EventRecord>;
  pools!: Table<PoolRecord>;
  claims!: Table<ClaimRecord>;

  constructor() {
    super('CompressionDemoDatabase');
    this.version(1).stores({
      events: '++id, title, location, date, time, description, attendeeCount, symbol, decimals, imageUrl, mintAddress, transactionId, createdAt',
      pools: '++id, eventId, mintAddress, poolAddress, merkleRoot, stateTreeAddress, transactionId, compressedAmount, compressionTxId, compressedAt, createdAt',
      claims: '++id, eventId, walletAddress, status, transactionId, errorMessage, createdAt',
    });
  }
}

const getDatabase = async (): Promise<MyDatabase> => {
  const db = new MyDatabase();
  await db.open();
  return db;
};

export const eventService = {
  saveEvent: async (eventData: EventRecord): Promise<number> => {
    try {
      const db = await getDatabase();
      const id = await db.events.add(eventData);
      return id;
    } catch (error) {
      console.error('Error saving event:', error);
      throw error;
    }
  },

  getEventById: async (eventId: string): Promise<EventRecord | null> => {
    try {
      const db = await getDatabase();
      const event = await db.events.where('id').equals(parseInt(eventId)).first();
      return event || null;
    } catch (error) {
      console.error('Error getting event by ID:', error);
      return null;
    }
  },

  getAllEvents: async (): Promise<EventRecord[]> => {
    try {
      const db = await getDatabase();
      const events = await db.events.toArray();
      return events;
    } catch (error) {
      console.error('Error getting all events:', error);
      return [];
    }
  }
};

export const poolService = {
  savePool: async (poolData: PoolRecord): Promise<number> => {
    try {
      const db = await getDatabase();
      const id = await db.pools.add(poolData);
      return id;
    } catch (error) {
      console.error('Error saving pool:', error);
      throw error;
    }
  },
  
  getPoolByEventId: async (eventId: string): Promise<PoolRecord | null> => {
    try {
      const db = await getDatabase();
      const pool = await db.pools.where('eventId').equals(eventId).first();
      return pool || null;
    } catch (error) {
      console.error('Error getting pool by event ID:', error);
      return null;
    }
  },
  
  getPoolByMintAddress: async (mintAddress: string): Promise<PoolRecord | null> => {
    try {
      const db = await getDatabase();
      const pool = await db.pools.where('mintAddress').equals(mintAddress).first();
      return pool || null;
    } catch (error) {
      console.error('Error getting pool by mint address:', error);
      return null;
    }
  },
  
  updatePool: async (eventId: string, updateData: Partial<PoolRecord>): Promise<boolean> => {
    try {
      const db = await getDatabase();
      const existingPool = await db.pools.where('eventId').equals(eventId).first();
      
      if (existingPool) {
        await db.pools.update(existingPool.id!, updateData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating pool:', error);
      return false;
    }
  }
};

export const claimService = {
  saveClaim: async (claimData: ClaimRecord): Promise<number> => {
    try {
      const db = await getDatabase();
      const id = await db.claims.add(claimData);
      return id;
    } catch (error) {
      console.error('Error saving claim:', error);
      throw error;
    }
  },

  getClaimById: async (claimId: string): Promise<ClaimRecord | null> => {
    try {
      const db = await getDatabase();
      const claim = await db.claims.where('id').equals(parseInt(claimId)).first();
      return claim || null;
    } catch (error) {
      console.error('Error getting claim by ID:', error);
      return null;
    }
  },

  getClaimsByEventId: async (eventId: string): Promise<ClaimRecord[]> => {
    try {
      const db = await getDatabase();
      const claims = await db.claims.where('eventId').equals(eventId).toArray();
      return claims;
    } catch (error) {
      console.error('Error getting claims by event ID:', error);
      return [];
    }
  },

  getClaimsByWallet: async (walletAddress: string): Promise<ClaimRecord[]> => {
    try {
      const db = await getDatabase();
      const claims = await db.claims.where('walletAddress').equals(walletAddress).toArray();
      return claims;
    } catch (error) {
      console.error('Error getting claims by wallet address:', error);
      return [];
    }
  },

  hasWalletClaimedEvent: async (eventId: string, walletAddress: string): Promise<boolean> => {
    try {
      const db = await getDatabase();
      const claim = await db.claims
        .where({ eventId, walletAddress })
        .first();
      return !!claim;
    } catch (error) {
      console.error('Error checking if wallet has claimed event:', error);
      return false;
    }
  },

  updateClaimStatus: async (claimId: number, status: 'pending' | 'confirmed' | 'failed', transactionId?: string, errorMessage?: string): Promise<boolean> => {
    try {
      const db = await getDatabase();
      await db.claims.update(claimId, { status, transactionId, errorMessage });
      return true;
    } catch (error) {
      console.error('Error updating claim status:', error);
      return false;
    }
  }
};
