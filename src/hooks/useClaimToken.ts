
import { useState } from 'react';
import { useQrScanner } from './useQrScanner';
import { useEventData } from './useEventData';
import { useTokenClaiming } from './useTokenClaiming';
import { useWallet } from '@solana/wallet-adapter-react';

export const useClaimToken = (initialEventId: string | undefined) => {
  const [eventId, setEventId] = useState<string | undefined>(initialEventId);
  const { connected } = useWallet();
  
  const {
    isScanning,
    manualEntryMode,
    manualEventId,
    scanError,
    handleScan,
    handleError,
    handleManualSubmit,
    setManualEventId,
    toggleManualEntryMode,
    startScanning,
    stopScanning
  } = useQrScanner();
  
  const {
    eventData,
    isVerifying
  } = useEventData(eventId);
  
  const {
    isClaiming,
    hasClaimed,
    handleClaimToken
  } = useTokenClaiming(eventId);

  // Enhanced scan handler that updates the eventId
  const handleEnhancedScan = (data: any) => {
    handleScan(data);
    if (data && data.text) {
      try {
        let extractedId;
        
        // Try to extract the event ID from different formats
        if (data.text.includes('/claim/')) {
          // Format: https://domain.com/claim/abc123
          const url = new URL(data.text);
          extractedId = url.pathname.split('/claim/')[1];
        } else if (data.text.startsWith('{')) {
          // Format: JSON object with eventId property
          try {
            const jsonData = JSON.parse(data.text);
            extractedId = jsonData.eventId;
          } catch (e) {
            console.error('Failed to parse JSON from QR code:', e);
          }
        } else {
          // Format: Direct event ID string
          extractedId = data.text;
        }
        
        if (extractedId) {
          console.log('Setting event ID from scan:', extractedId);
          setEventId(extractedId);
        }
      } catch (error) {
        console.error('Error processing QR scan data:', error);
      }
    }
  };

  // Enhanced manual submit that updates the eventId
  const handleEnhancedManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualEventId.trim()) {
      setEventId(manualEventId.trim());
    }
    handleManualSubmit(e);
  };

  return {
    isScanning,
    isClaiming,
    isVerifying,
    eventData,
    hasClaimed,
    manualEntryMode,
    manualEventId,
    connected,
    eventId,
    scanError,
    handleScan: handleEnhancedScan,
    handleError,
    handleClaimToken,
    handleManualSubmit: handleEnhancedManualSubmit,
    setManualEventId,
    toggleManualEntryMode,
    startScanning,
    stopScanning
  };
};
