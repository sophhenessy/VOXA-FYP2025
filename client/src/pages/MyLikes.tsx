import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { PlaceDetails } from "@/components/PlaceDetails";
import { MapPin, Heart } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface Like {
  id: number;
  placeId: string;
  placeName: string;
  placeAddress: string | null;
  placeType: string | null;
  rating: number | null;
  priceLevel: number | null;
  createdAt: string;
}

export default function MyLikes() {
  const { toast } = useToast();
  const { user } = useUser();
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult & { place_id: string } | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: likes = [], isLoading, error } = useQuery<Like[]>({
    queryKey: ['/api/likes', user?.id],
    queryFn: async () => {
      try {
        console.log('Fetching likes for user:', user?.id);
        const response = await fetch('/api/likes', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch likes');
        }

        const data = await response.json();
        console.log('Fetched likes:', data);
        return data;
      } catch (error) {
        console.error('Error fetching likes:', error);
        throw error;
      }
    },
    enabled: !!user
  });

  const handleViewDetails = async (like: Like) => {
    console.log('Handling view details for like:', like);

    if (!like.placeId) {
      console.error('Missing place ID for:', like);
      toast({
        title: "Error",
        description: "Place ID is missing",
        variant: "destructive",
      });
      return;
    }

    // Create a minimal place object from our database data
    const fallbackPlace = {
      place_id: like.placeId,
      name: like.placeName || 'Unnamed Place',
      formatted_address: like.placeAddress || '',
      types: ['place'],
      rating: 0,
      user_ratings_total: 0,
      photos: [],
      price_level: 0,
      opening_hours: undefined,
      formatted_phone_number: undefined,
      website: undefined,
      business_status: undefined,
    } as google.maps.places.PlaceResult & { place_id: string };

    // Set the fallback place immediately so we have something to show
    console.log('Setting initial fallback place:', fallbackPlace);
    setSelectedPlace(fallbackPlace);
    setIsDetailsOpen(true);

    // Check if Maps API is loaded before trying to fetch additional details
    if (!window.google?.maps?.places) {
      console.error('Google Maps Places API not loaded');
      toast({
        title: "Limited Data",
        description: "Showing basic information only",
        variant: "default",
      });
      return;
    }

    try {
      // Create a PlacesService instance
      const mapDiv = document.createElement('div');
      const placesService = new google.maps.places.PlacesService(mapDiv);

      const request = {
        placeId: like.placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'rating',
          'photos',
          'formatted_phone_number',
          'website',
          'opening_hours',
          'geometry',
          'user_ratings_total',
          'business_status',
          'price_level',
          'types'
        ],
      };

      console.log('Requesting place details with:', request);

      placesService.getDetails(request, (placeResult, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && placeResult) {
          console.log('Place details received:', placeResult);

          // Create a complete place object with required fields
          const placeWithId = {
            ...placeResult,
            place_id: like.placeId,
            name: placeResult.name || like.placeName || 'Unnamed Place',
            formatted_address: placeResult.formatted_address || like.placeAddress || '',
            // Add fallback values for optional fields
            rating: placeResult.rating || 0,
            photos: placeResult.photos || [],
            types: placeResult.types || ['place'],
            price_level: placeResult.price_level || 0,
            user_ratings_total: placeResult.user_ratings_total || 0,
          } as google.maps.places.PlaceResult & { place_id: string };

          console.log('Setting selected place:', placeWithId);
          setSelectedPlace(placeWithId);
        } else {
          console.error('Places API error:', status);
          // Keep using the fallback place we set earlier
          toast({
            title: "Limited Data Available",
            description: "Showing basic place information only",
            variant: "default",
          });
        }
      });
    } catch (error) {
      console.error('Error fetching place details:', error);
      // Keep using the fallback place we set earlier
      toast({
        title: "Limited Data Available",
        description: "Showing basic place information only",
        variant: "default",
      });
    }
  };

  if (!user) {
    return (
      <div className="h-screen w-full relative bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Please Log In</h2>
          <p className="text-muted-foreground">You need to be logged in to view your liked places.</p>
          <Link href="/auth">
            <Button>Log In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Heart className="w-6 h-6 text-primary animate-pulse" />
          <h1 className="text-2xl font-bold">Loading your liked places...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Error Loading Likes</h1>
        <p className="text-destructive">{error instanceof Error ? error.message : 'Failed to load likes'}</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative bg-background">
      <div className="container max-w-2xl mx-auto p-4 pb-20">
        <div className="flex items-center gap-2 mb-6">
          <Heart className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">My Liked Places</h1>
          <span className="text-sm text-muted-foreground">
            ({likes.length} places)
          </span>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {likes.length > 0 ? (
            <div className="space-y-4">
              {likes.map((like) => (
                <Card key={like.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-medium text-lg">{like.placeName}</h3>
                      {like.placeAddress && (
                        <div className="flex items-center text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-1" />
                          <p className="text-sm">{like.placeAddress}</p>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleViewDetails(like)}
                      variant="ghost"
                    >
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">No liked places yet. Start exploring to add some!</p>
              <Link href="/">
                <Button>Explore Places</Button>
              </Link>
            </div>
          )}
        </ScrollArea>
      </div>

      {selectedPlace && (
        <PlaceDetails
          place={selectedPlace}
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedPlace(null);
          }}
        />
      )}
    </div>
  );
}