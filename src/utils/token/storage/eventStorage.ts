
import { eventService } from '@/lib/db';
import { EventDetails } from '@/utils/types';

/**
 * Saves event data to the database
 */
export const saveEventData = async (
  eventId: string,
  mintAddress: string,
  eventDetails: EventDetails,
  creatorAddress: string,
  transactionId: string
): Promise<void> => {
  try {
    await eventService.saveEvent({
      id: eventId, // Using string ID
      mintAddress: mintAddress,
      ...eventDetails,
      createdAt: new Date().toISOString(),
      creator: creatorAddress,
      transactionId: transactionId
    });
    console.log('Event data saved successfully with ID:', eventId);
  } catch (error) {
    console.error('Error saving event data:', error);
    throw new Error(`Failed to save event data: ${error instanceof Error ? error.message : String(error)}`);
  }
};
