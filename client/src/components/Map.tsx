import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader } from "@googlemaps/js-api-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlaceDetails } from "./PlaceDetails";
import { Search } from "lucide-react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194,
};

interface MapProps {
  onPlaceSelect?: (place: google.maps.places.PlaceResult) => void;
  initialCenter?: { lat: number; lng: number } | null;
  onMapClick?: (event: google.maps.MapMouseEvent) => void;
  markers?: Array<{ lat: number; lng: number }>;
  className?: string;
}

interface Place extends google.maps.places.PlaceResult {
  distance?: string;
  formatted_address?: string;
  location?: {
    coordinates: {
      lat: number;
      lng: number;
    };
    formatted_address: string;
  };
  place_id: string;
  voxaRating?: number;
  voxaReviewCount?: number;
}

interface BusinessCategory {
  value: string;
  label: string;
  icon: string;
}

export function MapComponent({
  onPlaceSelect,
  initialCenter,
  onMapClick,
  markers = [],
  className = "",
}: MapProps) {
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "detecting" | "available" | "unavailable"
  >("detecting");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [placesService, setPlacesService] =
    useState<google.maps.places.PlacesService | null>(null);
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);

  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [selectedPlace, setSelectedPlace] =
    useState<google.maps.places.PlaceResult | null>(null);
  const [foundPlaces, setFoundPlaces] = useState<Place[]>([]);
  const [placeReviews, setPlaceReviews] = useState<{
    [key: string]: { rating: number; count: number };
  }>({});
  const [currentSearchLocation, setCurrentSearchLocation] =
    useState<google.maps.LatLng | null>(null);

  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);

  const businessCategories: BusinessCategory[] = [
    { value: "restaurant", label: "Restaurants", icon: "🍽️" },
    { value: "cafe", label: "Cafes", icon: "☕" },
    { value: "bar", label: "Bars", icon: "🍺" },
    { value: "gym", label: "Gyms", icon: "💪" },
    { value: "shopping_mall", label: "Shopping", icon: "🛍️" },
    { value: "lodging", label: "Hotels", icon: "🏨" },
  ];

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      if (!mapRef.current) return;

      try {
        if (!GOOGLE_MAPS_API_KEY) {
          throw new Error("Google Maps API key is not configured");
        }

        const loader = new Loader({
          apiKey: GOOGLE_MAPS_API_KEY,
          version: "beta",
          libraries: ["places", "marker", "geometry"],
        });

        await loader.load();

        if (!isMounted || !mapRef.current) return;

        const mapInstance = new google.maps.Map(mapRef.current, {
          center: initialCenter || defaultCenter,
          zoom: 14,
          mapId: "DEMO_MAP_ID",
          disableDefaultUI: false,
          mapTypeControl: true,
          mapTypeControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER,
          },
          streetViewControl: false,
          fullscreenControl: false,
        });

        if (onMapClick) {
          mapInstance.addListener("click", (e: google.maps.MapMouseEvent) => {
            onMapClick(e);
          });
        }

        setMap(mapInstance);
        const placesServiceInstance = new google.maps.places.PlacesService(
          mapInstance,
        );
        setPlacesService(placesServiceInstance);
        setGeocoder(new google.maps.Geocoder());
        setIsLoadingPlaces(false);

        if (!initialCenter) {
          setLocationStatus("detecting");

          const handleLocationSuccess = (position: GeolocationPosition) => {
            if (!isMounted || !mapInstance) return;

            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };

            console.log("Location detected:", location);
            setUserLocation(location);
            setLocationStatus("available");

            mapInstance.setCenter(location);
            mapInstance.setZoom(14);

            if (userMarkerRef.current) {
              userMarkerRef.current.setMap(null);
            }

            userMarkerRef.current = new google.maps.Marker({
              map: mapInstance,
              position: location,
              title: "Your Location",
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#4285F4", // Google Maps blue
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#FFFFFF",
              },
              animation: google.maps.Animation.DROP,
            });

            toast({
              title: "Location Found",
              description: "Using your current location",
            });
          };

          const handleLocationError = (error: GeolocationPositionError) => {
            console.error("Geolocation error:", error);
            setLocationStatus("unavailable");

            let errorMessage = "Using default location. ";
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage +=
                  "Please enable location access in your browser settings.";
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage += "Location information is unavailable.";
                break;
              case error.TIMEOUT:
                errorMessage += "Location request timed out.";
                break;
              default:
                errorMessage += "An unknown error occurred.";
            }

            if (isMounted) {
              toast({
                title: "Location Not Available",
                description: errorMessage,
                variant: "default",
              });
            }
          };

          if ("geolocation" in navigator) {
            const options = {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            };

            navigator.geolocation.getCurrentPosition(
              handleLocationSuccess,
              handleLocationError,
              options,
            );
          } else {
            setLocationStatus("unavailable");
            toast({
              title: "Location Not Available",
              description:
                "Geolocation is not supported by your browser. Using default location.",
              variant: "default",
            });
          }
        }
      } catch (error) {
        console.error("Error initializing map:", error);
        setIsLoadingPlaces(false);
        if (isMounted) {
          toast({
            title: "Error",
            description:
              error instanceof Error
                ? error.message
                : "Could not initialize map",
            variant: "destructive",
          });
        }
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (map) {
        console.log("clearing markers");
        markersRef.current.forEach((marker) => marker.setMap(null));
        if (userMarkerRef.current) {
          console.log("clearing markers l 255");
          userMarkerRef.current.setMap(null);
        }
      }
    };
  }, [toast, initialCenter, onMapClick]);

  useEffect(() => {
    if (!map) return;

    console.log("clearing markers line 266");
    markersRef.current = [];

    markers.forEach((position, index) => {
      const marker = new google.maps.Marker({
        map,
        position: new google.maps.LatLng(position.lat, position.lng),
        title: `Marker ${index + 1}`,
        animation: google.maps.Animation.DROP,
      });
      markersRef.current.push(marker);
    });

    if (markers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((position) =>
        bounds.extend(new google.maps.LatLng(position.lat, position.lng)),
      );
      map.fitBounds(bounds);
    }
  }, [map, markers]);

  const calculateDistance = (place: google.maps.places.PlaceResult): string => {
    if (!userLocation || !place.geometry?.location) return "N/A";

    const placeLocation = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    try {
      if (!google.maps.geometry?.spherical) {
        console.warn("Geometry library not loaded yet");
        return "N/A";
      }

      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(userLocation.lat, userLocation.lng),
        new google.maps.LatLng(placeLocation.lat, placeLocation.lng),
      );

      return (distance / 1000).toFixed(1) + " km";
    } catch (error) {
      console.error("Error calculating distance:", error);
      return "N/A";
    }
  };

  const handlePlaceSelect = useCallback(
    (place: Place) => {
      if (!placesService || !place.place_id) return;

      markersRef.current.forEach((marker) => {
        if (marker !== userMarkerRef.current) {
          marker.setMap(null);
          console.log("clearing markers line 327");
        }
      });
      markersRef.current = markersRef.current.filter(
        (marker) => marker === userMarkerRef.current,
      );

      placesService.getDetails(
        {
          placeId: place.place_id,
          fields: [
            "name",
            "formatted_address",
            "geometry",
            "rating",
            "photos",
            "formatted_phone_number",
            "website",
            "opening_hours",
            "user_ratings_total",
            "business_status",
            "price_level",
            "types",
          ],
        },
        (placeDetails, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            placeDetails
          ) {
            console.log("Google Places API Response:", placeDetails);
            if (placeDetails.business_status === "CLOSED_PERMANENTLY") {
              return;
            }
            const location = {
              coordinates: {
                lat: placeDetails.geometry?.location?.lat() ?? 0,
                lng: placeDetails.geometry?.location?.lng() ?? 0,
              },
              formatted_address: placeDetails.formatted_address || "",
            };

            console.log("Processing place details:", {
              name: placeDetails.name,
              geometry: placeDetails.geometry,
              location: location,
            });

            const placeWithLocation: Place = {
              ...placeDetails,
              location,
              place_id: place.place_id,
            };

            setSelectedPlace(placeWithLocation);
            setIsDetailsOpen(true);

            if (map && placeDetails.geometry?.location) {
              map.panTo(placeDetails.geometry.location);
              map.setZoom(16);

              const marker = new google.maps.Marker({
                map,
                position: placeDetails.geometry.location,
                title: placeDetails.name || "Selected Place",
                animation: google.maps.Animation.DROP,
              });

              markersRef.current.push(marker);
            }
          } else {
            toast({
              title: "Error",
              description: "Could not load place details",
              variant: "destructive",
            });
          }
        },
      );
    },
    [map, placesService, toast],
  );

  const { user } = useAuth();

  const fetchVoxaReviews = async (placeId: string) => {
    // Don't attempt to fetch reviews if user is not authenticated
    if (!user) {
      return null;
    }

    try {
      const response = await fetch(
        `/api/reviews/place/${encodeURIComponent(placeId)}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        return null;
      }

      const reviews = await response.json();
      if (reviews && reviews.length > 0) {
        const averageRating =
          reviews.reduce((acc: number, review: any) => acc + review.rating, 0) /
          reviews.length;
        return {
          rating: averageRating,
          count: reviews.length,
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching VOXA reviews:", error);
      return null;
    }
  };

  const handleSearchResults = useCallback(
    async (
      places: google.maps.places.PlaceResult[] | null,
      status: google.maps.places.PlacesServiceStatus,
      pagination: google.maps.places.PlaceSearchPagination | null,
      searchLocation: google.maps.LatLng,
    ) => {
      if (
        status === google.maps.places.PlacesServiceStatus.OK &&
        places &&
        map
      ) {
        console.log("Found places:", places.length);

        if (!pagination?.hasNextPage) {
          markersRef.current.forEach((marker) => {
            if (marker !== userMarkerRef.current) {
              marker.setMap(null);
              console.log("clearing markers line 451");
            }
          });
          markersRef.current = markersRef.current.filter(
            (marker) => marker === userMarkerRef.current,
          );
        }

        const bounds = new google.maps.LatLngBounds();
        if (userMarkerRef.current?.getPosition()) {
          bounds.extend(userMarkerRef.current.getPosition()!);
        }
        bounds.extend(searchLocation);

        const validPlaces = places.filter((place): place is Place =>
          Boolean(
            place.place_id &&
              place.geometry?.location &&
              place.business_status !== "CLOSED_PERMANENTLY",
          ),
        );

        console.log("Valid places for markers:", validPlaces.length);

        const placesWithDistance = validPlaces.map((place) => ({
          ...place,
          distance: calculateDistance(place),
          formatted_address: place.formatted_address || place.vicinity || "",
        }));

        setFoundPlaces((prevPlaces) => {
          const newPlaces = [...prevPlaces];
          placesWithDistance.forEach((place) => {
            if (!newPlaces.some((p) => p.place_id === place.place_id)) {
              newPlaces.push(place);
              if (place.geometry?.location && map) {
                try {
                  const position = place.geometry.location;
                  const marker = new google.maps.Marker({
                    position: position,
                    map: map,
                    title: place.name || "Unknown Place",
                    animation: google.maps.Animation.DROP,
                  });

                  marker.addListener("click", () =>
                    handlePlaceSelect(place)
                  );
                  markersRef.current.push(marker);
                  bounds.extend(position);

                  console.log(
                    "Created marker for:",
                    place.name,
                    "at position:",
                    position.toString(),
                  );
                } catch (error) {
                  console.error("Error creating marker:", error);
                }
              }
            }
          });

          if (!pagination?.hasNextPage && markersRef.current.length > 0) {
            const padding = {
              top: 50,
              right: 50,
              bottom: 50,
              left: 250,
            };
            map?.fitBounds(bounds, padding);
          }

          return newPlaces;
        });

        if (pagination?.hasNextPage) {
          setTimeout(() => {
            pagination.nextPage();
          }, 200);
        } else {
          setIsSearching(false);
        }
      } else {
        console.error("Places search failed:", status);
        toast({
          title: "No Results",
          description:
            "No places found in this area. Try adjusting your search.",
          variant: "destructive",
        });
        setIsSearching(false);
      }
    },
    [map, handlePlaceSelect, toast, calculateDistance],
  );

  const clearMarkers = useCallback(() => {
    console.log("Clearing all place markers");
    markersRef.current.forEach((marker) => {
      if (marker !== userMarkerRef.current) {
        marker.setMap(null);
      }
    });
    markersRef.current = markersRef.current.filter(
      (marker) => marker === userMarkerRef.current
    );
  }, []);

  const performSearch = useCallback(
    (query: string, searchCenter?: google.maps.LatLng) => {
      if (!map || !placesService) {
        console.log("Missing required services:", {
          map: !!map,
          placesService: !!placesService,
        });
        return;
      }

      setIsSearching(true);
      setFoundPlaces([]);

      // Clear existing markers before new search
      console.log("Clearing markers for new search");
      clearMarkers();

      const searchLocation =
        searchCenter || currentSearchLocation || map.getCenter();
      if (!searchLocation) return;

      const normalizedQuery = query.trim();
      const matchedCategory = Object.entries(categoryMapping).find(
        ([key]) => key.toLowerCase() === normalizedQuery.toLowerCase()
      );

      if (matchedCategory) {
        console.log(`Performing category search for: ${matchedCategory[0]}`);
        const bounds = map.getBounds();
        const radius = bounds
          ? (() => {
              try {
                if (!google.maps.geometry?.spherical?.computeDistanceBetween) {
                  console.warn(
                    "Geometry library not loaded yet, using default radius"
                  );
                  return 2000;
                }
                return Math.min(
                  google.maps.geometry.spherical.computeDistanceBetween(
                    bounds.getCenter(),
                    bounds.getNorthEast()
                  ),
                  3000
                );
              } catch (error) {
                console.error("Error calculating radius:", error);
                return 2000;
              }
            })()
          : 2000;

        const categoryConfig = categoryMapping[matchedCategory[0]];
        console.log("Using category config:", categoryConfig);

        // Create a search promise for each type and keyword combination
        const searchPromises: Promise<google.maps.places.PlaceResult[]>[] = [];

        categoryConfig.types.forEach((type) => {
          categoryConfig.keywords.forEach((keyword) => {
            searchPromises.push(
              new Promise<google.maps.places.PlaceResult[]>((resolve) => {
                const request = {
                  location: searchLocation,
                  radius: radius,
                  type,
                  keyword: keyword,
                };

                console.log(`Searching with params:`, request);

                placesService.nearbySearch(
                  request,
                  (places, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && places) {
                      console.log(`Found ${places.length} places for type: ${type}, keyword: ${keyword}`);
                      resolve(places);
                    } else {
                      console.log(`No results for type: ${type}, keyword: ${keyword}, status: ${status}`);
                      resolve([]);
                    }
                  }
                );
              })
            );
          });
        });

        // Handle all search results
        Promise.all(searchPromises)
          .then((resultsArray) => {
            // Flatten and deduplicate results
            const combinedPlaces = Array.from(
              new Map(
                resultsArray
                  .flat()
                  .filter(place => 
                    place.business_status !== "CLOSED_PERMANENTLY" &&
                    place.place_id
                  )
                  .map(place => [place.place_id, place])
              ).values()
            );

            console.log(`Total combined places after deduplication: ${combinedPlaces.length}`);

            handleSearchResults(
              combinedPlaces,
              google.maps.places.PlacesServiceStatus.OK,
              null,
              searchLocation
            );
          })
          .catch((error) => {
            console.error("Error in category search:", error);
            setIsSearching(false);
            toast({
              title: "Search Error",
              description: "Failed to search places. Please try again.",
              variant: "destructive",
            });
          });
      } else {
        // Regular text search remains unchanged
        const request: google.maps.places.TextSearchRequest = {
          query: normalizedQuery,
          location: searchLocation,
          radius: searchCenter ? 10000 : 2000,
        };

        placesService.textSearch(request, (places, status, pagination) => {
          handleSearchResults(places, status, pagination, searchLocation);
        });
      }
    },
    [map, placesService, currentSearchLocation, handleSearchResults, clearMarkers, toast]
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim() || !map || !placesService) return;

    setIsSearching(true);

    try {
      console.log("Attempting search:", searchInput);

      const request: google.maps.places.TextSearchRequest = {
        query: searchInput,
        location: map.getCenter(),
        radius: 2000,
      };

      placesService.textSearch(request, (places, status, pagination) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && places) {
          const location = places[0].geometry?.location;
          if (location) {
            map.setCenter(location);
            map.setZoom(14);
          }
          handleSearchResults(places, status, pagination, map.getCenter()!);
        } else {
          console.error("Places search failed:", status);
          toast({
            title: "No Results",
            description:
              "No places found in this area. Try adjusting your search.",
            variant: "destructive",
          });
          setIsSearching(false);
        }
      });
    } catch (error) {
      console.error("Search failed:", error);
      toast({
        title: "Search Failed",
        description: "Unable to perform search. Please try again.",
        variant: "destructive",
      });
      setIsSearching(false);
    }
  };

  const submitReview = async (
    place: Place,
    rating: number,
    comment: string,
  ) => {
    try {
      if (!place.geometry?.location || !place.location) {
        console.error("Missing required place data:", {
          geometry: place.geometry,
          location: place.location,
        });
        return;
      }

      const locationData = {
        coordinates: {
          lat: Number(place.location.coordinates.lat),
          lng: Number(place.location.coordinates.lng),
        },
        formatted_address: place.location.formatted_address,
      };

      console.log("Submitting review with location data:", locationData);

      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          placeId: place.place_id,
          placeName: place.name,
          rating,
          comment,
          location: locationData,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Unauthorized",
            description: "Please log in to submit a review.",
            variant: "warning",
          });
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      toast({
        title: "Review Added",
        description: "Successfully added review",
      });

      if (onPlaceSelect) {
        onPlaceSelect(place);
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit review",
      });
    }
  };

  const handleCloseDetails = useCallback(() => {
    setIsDetailsOpen(false);
    setSelectedPlace(null);
  }, []);

  const categoryMapping: { [key: string]: { types: string[]; keywords: string[] } } = {
    Restaurants: {
      types: ["restaurant", "meal_takeaway", "meal_delivery"],
      keywords: ["restaurant", "dining"]
    },
    Cafes: {
      types: ["cafe", "bakery"],
      keywords: ["cafe", "coffee"]
    },
    Bars: {
      types: ["bar", "night_club"],
      keywords: ["bar", "pub"]
    },
    Gyms: {
      types: ["gym"],
      keywords: ["gym", "fitness"]
    },
    Shopping: {
      types: ["shopping_mall", "department_store", "store"],
      keywords: ["shopping"]
    },
    Hotels: {
      types: ["lodging"],
      keywords: ["hotel"]
    },
  };


  return (
    <div className={`relative w-full h-[calc(100vh-64px)] flex ${className}`}>
      <div className="flex-grow relative">
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="absolute right-4 top-0 flex overflow-hidden rounded-md shadow-md">
            <button
              onClick={() => map?.setMapTypeId("roadmap")}
              className={`px-4 py-2 text-sm transition-colors ${
                map?.getMapTypeId() === "roadmap"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/95 hover:bg-accent"
              }`}
            >
              Map
            </button>
            <button
              onClick={() => map?.setMapTypeId("hybrid")}
              className={`px-4 py-2 text-sm transition-colors ${
                map?.getMapTypeId() === "hybrid"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/95 hover:bg-accent"
              }`}
            >
              Satellite
            </button>
          </div>
          <div className="space-y-2">
            <form
              onSubmit={handleSearch}
              className="relative max-w-2xl mx-auto"
            >
              <Input
                type="text"
                placeholder={
                  isLoadingPlaces
                    ? "Loading places service..."
                    : "Search for businesses and places..."
                }
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm border-2"
                disabled={isLoadingPlaces || isSearching}
              />
            </form>
            <div className="flex gap-2 flex-wrap max-w-2xl mx-auto">
              {businessCategories.map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => {
                    if (!isSearching) {
                      setSearchInput(label);
                      console.log("Category changed - clearing existing markers");
                      clearMarkers();
                      performSearch(label);
                    }
                  }}
                  disabled={isSearching}
                  className={`px-3 py-1 bg-card/95 hover:bg-accent rounded-full text-sm transition-all shadow-sm border ${
                    isSearching ? "opacity-50 cursor-not-allowed" : "hover:shadow-md"
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {locationStatus === "detecting" && (
          <div className="absolute top-16 left-4 right-4 z-10">
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm text-center">
              Detecting your location...
            </div>
          </div>
        )}

        <div
          ref={mapRef}
          className="w-full h-full"
          style={{ backgroundColor: "#f8f9fa" }}
        />
      </div>

      {(foundPlaces.length > 0 || isSearching) && (
        <div className="absolute top-20 right-4 bottom-16 w-80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border transition-opacity duration-200">
          <ScrollArea className="h-full">
            {isSearching ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center space-y-2">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-sm text-muted-foreground">
                    Searching places...
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {foundPlaces.map((place, index) => (
                  <Card key={place.place_id || index}>
                    <div
                      className="p-4 cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handlePlaceSelect(place)}
                    >
                      <h3 className="font-medium">{place.name}</h3>
                      {place.formatted_address && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {place.formatted_address}
                        </p>
                      )}
                      {place.place_id && placeReviews[place.place_id] ? (
                        <p className="text-sm mt-1">
                          ⭐ {placeReviews[place.place_id].rating.toFixed(1)} (
                          {placeReviews[place.place_id].count} reviews)
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">
                          No reviews yet
                        </p>
                      )}
                      {place.distance && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📍 {place.distance}
                        </p>
                      )}
                    </div>
                    <div className="px-4 pb-4 pt-0">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="w-full px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                            Write Review
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Review {place.name}</DialogTitle>
                          </DialogHeader>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              const rating = parseInt(
                                formData.get("rating") as string,
                              );
                              const comment = formData.get("comment") as string;

                              submitReview(place, rating, comment)
                                .then(() => {
                                  toast({
                                    title: "Review submitted",
                                    description: "Thank you for your review!",
                                  });
                                  (e.target as HTMLFormElement).reset();
                                })
                                .catch(() => {
                                  toast({
                                    title: "Error",
                                    description:
                                      "Failed to submit review. Please try again.",
                                    variant: "destructive",
                                  });
                                });
                            }}
                          >
                            <div className="space-y-4 my-4">
                              <div className="space-y-2">
                                <Label htmlFor="rating">Rating</Label>
                                <Select name="rating" required>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select rating" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5].map((num) => (
                                      <SelectItem
                                        key={num}
                                        value={num.toString()}
                                      >
                                        {"⭐".repeat(num)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="comment">Comment</Label>
                                <Textarea
                                  name="comment"
                                  placeholder="Write your review..."
                                  required
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="submit">Submit Review</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      <PlaceDetails
        place={selectedPlace as (Place & { place_id: string }) | null}
        isOpen={isDetailsOpen}
        onClose={handleCloseDetails}
      />
    </div>
  );
}

declare global {
  interface Window {
    likedPlaces?: string[];
  }
}