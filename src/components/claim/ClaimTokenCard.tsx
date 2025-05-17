
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, Loader2, Wallet } from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';

interface EventData {
  title: string;
  organizer: string;
  date: string;
  location: string;
  mintAddress: string;
  stateTreeAddress: string;
}

interface ClaimTokenCardProps {
  eventData: EventData | null;
  isVerifying: boolean;
  isClaiming: boolean;
  hasClaimed: boolean | null;
  walletConnected: boolean;
  onClaimToken: () => Promise<void>;
}

const ClaimTokenCard = ({
  eventData,
  isVerifying,
  isClaiming,
  hasClaimed,
  walletConnected,
  onClaimToken
}: ClaimTokenCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim Your Token</CardTitle>
        <CardDescription>
          {walletConnected 
            ? "Click below to claim your event token" 
            : "Connect your wallet and claim your event token"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {eventData && (
          <div className="space-y-2 border rounded-md p-4 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <p className="text-sm text-muted-foreground">Event:</p>
              <p className="text-sm font-medium text-right">{eventData.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <p className="text-sm text-muted-foreground">Organizer:</p>
              <p className="text-sm font-medium text-right">{eventData.organizer}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <p className="text-sm text-muted-foreground">Date:</p>
              <p className="text-sm font-medium text-right">{eventData.date}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <p className="text-sm text-muted-foreground">Location:</p>
              <p className="text-sm font-medium text-right">{eventData.location}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <p className="text-sm text-muted-foreground">Token:</p>
              <p className="text-sm font-medium text-right truncate" title={eventData.mintAddress}>
                {eventData.mintAddress ? `${eventData.mintAddress.substring(0, 4)}...${eventData.mintAddress.substring(eventData.mintAddress.length - 4)}` : 'Unknown'}
              </p>
            </div>
          </div>
        )}
        
        {isVerifying ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : hasClaimed ? (
          <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-900">
            <Check className="h-4 w-4 text-green-500" />
            <AlertTitle>Already Claimed</AlertTitle>
            <AlertDescription>
              You have already claimed this event token!
            </AlertDescription>
          </Alert>
        ) : null}
        
        {!walletConnected && (
          <div className="mt-4 mb-2">
            <WalletButton className="w-full" />
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={onClaimToken}
          className="solana-gradient-bg w-full"
          disabled={isClaiming || !walletConnected || hasClaimed === true}
          title={!walletConnected ? "Please connect your wallet first" : ""}
        >
          {isClaiming ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming...</>
          ) : hasClaimed ? (
            <><Check className="mr-2 h-4 w-4" /> Token Claimed</>
          ) : !walletConnected ? (
            <>Connect Wallet to Claim</>
          ) : (
            <>Claim Token</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ClaimTokenCard;
