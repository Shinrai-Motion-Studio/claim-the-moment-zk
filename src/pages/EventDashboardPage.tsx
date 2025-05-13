import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getAllEvents, getEventDetails, getEventClaimHistory } from '@/utils/eventServices';
import { EventRecord } from '@/lib/db';
import { formatDate } from '@/utils/formatters';

const EventDashboardPage = () => {
  const { connected, publicKey } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventClaims, setEventClaims] = useState<any[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);

  // Load events when component mounts or wallet changes
  useEffect(() => {
    async function loadEvents() {
      if (!connected) {
        setEvents([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const allEvents = await getAllEvents();
        
        // Filter to only show events created by current wallet
        const myEvents = publicKey 
          ? allEvents.filter(event => event.creator === publicKey.toString()) 
          : allEvents;
        
        setEvents(myEvents);
      } catch (error) {
        console.error('Error loading events:', error);
        toast.error("Error Loading Events", {
          description: "Failed to load your events. Please try again later."
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadEvents();
  }, [connected, publicKey]);

  // Load claims when an event is selected
  const viewEventClaims = async (eventId: string) => {
    setSelectedEventId(eventId);
    setIsLoadingClaims(true);
    
    try {
      const claims = await getEventClaimHistory(eventId);
      setEventClaims(claims);
    } catch (error) {
      console.error('Error loading claims:', error);
      toast.error("Error Loading Claims", {
        description: "Failed to load claim history for this event."
      });
    } finally {
      setIsLoadingClaims(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Event Dashboard</CardTitle>
            <CardDescription>
              Connect your wallet to view your events
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <p>Please connect your wallet to view your events.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold mb-2">Event Dashboard</h1>
      <p className="text-muted-foreground mb-8">
        Manage your compressed token events and view claim statistics
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Your Events</CardTitle>
          <CardDescription>
            Events you've created with compressed tokens
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">You haven't created any events yet.</p>
              <Button className="mt-4" asChild>
                <a href="/create">Create Your First Event</a>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Mint Address</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.title}</TableCell>
                      <TableCell>{formatDate(event.date)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.mintAddress?.slice(0, 6)}...{event.mintAddress?.slice(-4)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => viewEventClaims(event.id)}
                        >
                          View Claims
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEventId && (
        <Card>
          <CardHeader>
            <CardTitle>Claim History</CardTitle>
            <CardDescription>
              Claims for this event's compressed tokens
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingClaims ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : eventClaims.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No claims have been made for this event yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wallet Address</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Transaction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventClaims.map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-mono text-xs">
                          {claim.walletAddress.slice(0, 6)}...{claim.walletAddress.slice(-4)}
                        </TableCell>
                        <TableCell>{formatDate(claim.createdAt)}</TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              claim.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                              claim.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800'
                            }
                          >
                            {claim.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {claim.transactionId ? (
                            <a 
                              href={`https://explorer.solana.com/tx/${claim.transactionId}?cluster=devnet`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {claim.transactionId.slice(0, 6)}...{claim.transactionId.slice(-4)}
                            </a>
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EventDashboardPage;
