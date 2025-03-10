import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { MapPin, Calendar, ArrowLeft, Lock } from "lucide-react";
import { Link } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Trip {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isPublic: boolean;
  createdAt: string;
  places: Array<{
    id: number;
    placeName: string;
    placeId: string;
    placeAddress: string | null;
    notes: string | null;
  }>;
}

export default function SharedTripPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: trip, isLoading, error } = useQuery<Trip>({
    queryKey: [`/api/trips/shared/${id}`],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <MapPin className="w-6 h-6 text-primary animate-pulse" />
          <h1 className="text-2xl font-bold">Loading trip details...</h1>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Lock className="w-6 h-6 text-destructive" />
          <h1 className="text-2xl font-bold">Trip not found or is private</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <Button variant="outline" asChild className="mb-4">
        <Link href="/" className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </Button>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{trip.name}</h1>
          {trip.description && (
            <p className="mt-2 text-muted-foreground">{trip.description}</p>
          )}
          {(trip.startDate || trip.endDate) && (
            <div className="flex items-center mt-4 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 mr-2" />
              <span>
                {trip.startDate && format(new Date(trip.startDate), 'MMM d, yyyy')}
                {trip.endDate && ' - '}
                {trip.endDate && format(new Date(trip.endDate), 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Places</h2>
            {trip.places.length > 0 ? (
              trip.places.map((place) => (
                <Card key={place.id} className="p-4">
                  <div className="space-y-2">
                    <Link 
                      href={`/business/${place.placeId}`}
                      className="text-lg font-medium hover:text-primary hover:underline block"
                    >
                      {place.placeName}
                    </Link>
                    {place.placeAddress && (
                      <p className="text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        {place.placeAddress}
                      </p>
                    )}
                    {place.notes && (
                      <p className="text-sm mt-2">{place.notes}</p>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center">
                <p className="text-muted-foreground">
                  No places added to this trip yet.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}