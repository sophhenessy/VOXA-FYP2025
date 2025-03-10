import { useState, useEffect } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';

interface Location {
  name: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface LocationSearchProps {
  onLocationSelect: (location: Location) => void;
  onSearchResults?: (results: Location[]) => void;
}

let mapsLoader: Loader | null = null;

export function LocationSearch({ onLocationSelect, onSearchResults }: LocationSearchProps) {
  const { toast } = useToast();
  const [searchInput, setSearchInput] = useState("");
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error('Google Maps API key is not configured');
        }

        if (!mapsLoader) {
          mapsLoader = new Loader({
            apiKey,
            version: "beta",
            libraries: ["places", "marker", "geometry"]
          });
        }

        await mapsLoader.load();
        setAutocompleteService(new google.maps.places.AutocompleteService());
        // Create a dummy div for PlacesService
        const mapDiv = document.createElement('div');
        setPlacesService(new google.maps.places.PlacesService(mapDiv));
      } catch (error) {
        console.error('Error initializing services:', error);
        toast({
          title: "Error",
          description: "Could not initialize search services",
          variant: "destructive",
        });
      }
    };

    initializeServices();
  }, [toast]);

  const handleSearch = () => {
    if (!searchInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a location",
        variant: "destructive",
      });
      return;
    }

    if (!autocompleteService || !placesService) {
      toast({
        title: "Error",
        description: "Search service is not ready yet",
        variant: "destructive",
      });
      return;
    }

    // First get place predictions
    autocompleteService.getPlacePredictions(
      { input: searchInput },
      async (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          toast({
            title: "Error",
            description: "No locations found",
            variant: "destructive",
          });
          return;
        }

        // Get details for all predictions
        const detailsPromises = predictions.map(prediction => {
          return new Promise<Location>((resolve, reject) => {
            placesService.getDetails(
              {
                placeId: prediction.place_id,
                fields: ['name', 'geometry', 'formatted_address']
              },
              (result, detailsStatus) => {
                if (detailsStatus === google.maps.places.PlacesServiceStatus.OK && result?.geometry?.location) {
                  resolve({
                    name: result.name || prediction.description,
                    lat: result.geometry.location.lat(),
                    lng: result.geometry.location.lng(),
                    placeId: prediction.place_id
                  });
                } else {
                  reject(new Error(`Failed to get details for ${prediction.description}`));
                }
              }
            );
          });
        });

        try {
          const locations = await Promise.all(detailsPromises);
          if (onSearchResults) {
            onSearchResults(locations);
          }
          if (locations.length > 0) {
            onLocationSelect(locations[0]); // Select the first result by default
          }
          setSearchInput("");
        } catch (error) {
          console.error('Error getting place details:', error);
          toast({
            title: "Error",
            description: "Failed to get location details",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <div className="flex gap-2">
      <Input
        type="text"
        placeholder="Search for a location..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <Button onClick={handleSearch}>
        Search
      </Button>
    </div>
  );
}