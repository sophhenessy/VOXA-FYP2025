import { MapComponent } from "@/components/Map";
import { BottomNav } from "@/components/BottomNav";
import { useLocation, useRoute } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface Trip {
  id: number;
  locationName?: string;
  locationLat?: string;
  locationLng?: string;
}

export default function MapPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/map/trip/:tripId');
  const tripId = params?.tripId;
  const [initialCenter, setInitialCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch trip details if we're adding places to a trip
  const { data: trip } = useQuery<Trip>({
    queryKey: [`/api/trips/${tripId}`],
    enabled: !!tripId,
  });

  // Set initial map center based on trip location
  useEffect(() => {
    if (trip?.locationLat && trip?.locationLng) {
      setInitialCenter({
        lat: parseFloat(trip.locationLat),
        lng: parseFloat(trip.locationLng)
      });
    }
  }, [trip]);

  const handlePlaceSelect = async (place: google.maps.places.PlaceResult) => {
    if (!place.name || !place.place_id) return;

    // If we're adding to a trip
    if (tripId) {
      try {
        const response = await fetch(`/api/trips/${tripId}/places`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            placeId: place.place_id,
            placeName: place.name,
            placeAddress: place.formatted_address || '',
            notes: ''
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to add place to trip');
        }

        toast({
          title: "Place Added",
          description: "Successfully added place to your trip",
        });

        // Redirect back to trip detail page
        setLocation(`/trips/${tripId}`);
      } catch (error) {
        console.error('Error adding place:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to add place to trip",
        });
      }
    }
  };

  return (
    <div className="h-screen w-full relative">
      <MapComponent 
        onPlaceSelect={handlePlaceSelect} 
        initialCenter={initialCenter}
      />
      <BottomNav />
    </div>
  );
}