
import { useParams } from 'react-router-dom';
import { useClaimToken } from '@/hooks/useClaimToken';
import QRScanner from '@/components/claim/QRScanner';
import ClaimTokenCard from '@/components/claim/ClaimTokenCard';
import WelcomeHeader from '@/components/claim/WelcomeHeader';
import WalletConnectAlert from '@/components/claim/WalletConnectAlert';
import ClaimContainer from '@/components/claim/ClaimContainer';
import { useWallet } from '@solana/wallet-adapter-react';

const ClaimPage = () => {
  const { eventId } = useParams<{ eventId?: string }>();
  const { connected } = useWallet();
  
  const {
    isScanning,
    isClaiming,
    isVerifying,
    eventData,
    hasClaimed,
    manualEntryMode,
    manualEventId,
    handleScan,
    handleError,
    handleClaimToken,
    handleManualSubmit,
    setManualEventId,
    toggleManualEntryMode,
    startScanning,
    stopScanning
  } = useClaimToken(eventId);

  return (
    <ClaimContainer>
      <WelcomeHeader />

      {!connected && <WalletConnectAlert />}

      {!eventId ? (
        <QRScanner
          isScanning={isScanning}
          manualEntryMode={manualEntryMode}
          onScan={handleScan}
          onError={handleError}
          onStartScanning={startScanning}
          onToggleManual={toggleManualEntryMode}
          manualEventId={manualEventId}
          onManualChange={(e) => setManualEventId(e.target.value)}
          onManualSubmit={handleManualSubmit}
        />
      ) : (
        <ClaimTokenCard
          eventData={eventData}
          isVerifying={isVerifying}
          isClaiming={isClaiming}
          hasClaimed={hasClaimed}
          walletConnected={connected}
          onClaimToken={handleClaimToken}
        />
      )}
    </ClaimContainer>
  );
};

export default ClaimPage;
