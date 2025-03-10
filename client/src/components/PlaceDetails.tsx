import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Heart, MapPin, Edit } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Reviews } from "@/components/Reviews"; // Change to named import

interface Review {
  id: number;
  placeId: string;
  placeName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  location?: {
    coordinates: { lat: number; lng: number };
    city?: string;
    country?: string;
    formatted_address?: string;
  } | null;
}

interface PlaceDetailsProps {
  place: google.maps.places.PlaceResult & { place_id: string } | null;
  isOpen: boolean;
  onClose: () => void;
}

interface Trip {
  id: number;
  name: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
}

export function PlaceDetails({ place, isOpen, onClose }: PlaceDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);
  const [showTripDialog, setShowTripDialog] = useState(false);
  const [showEditTripDialog, setShowEditTripDialog] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [editTripName, setEditTripName] = useState("");
  const [editTripDescription, setEditTripDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  // Fetch user's trips
  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['/api/trips'],
    enabled: showTripDialog || showEditTripDialog
  });

  // Fetch likes status
  const { data: likes = [] } = useQuery<{ placeId: string }[]>({
    queryKey: ['/api/likes'],
    enabled: isOpen
  });

  // Add reviews query
  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['/api/reviews/place', place?.place_id],
    queryFn: async () => {
      if (!place?.place_id) return [];
      const response = await fetch(`/api/reviews/place/${place.place_id}`);
      if (!response.ok) throw new Error('Failed to fetch reviews');
      return response.json();
    },
    enabled: isOpen && !!place?.place_id,
  });

  // Add place to trip mutation
  const addToTripMutation = useMutation({
    mutationFn: async () => {
      if (!place || !selectedTripId) return;

      const response = await fetch(`/api/trips/${selectedTripId}/places`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          placeId: place.place_id,
          placeName: place.name,
          placeAddress: place.formatted_address,
          notes: "",
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${selectedTripId}/places`] });
      setShowTripDialog(false);
      setSelectedTripId("");
      toast({
        title: "Added to Trip",
        description: "The place has been added to your trip.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add place to trip",
      });
    },
  });

  // Edit trip mutation
  const editTripMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTripId) return;

      const response = await fetch(`/api/trips/${selectedTripId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editTripName,
          description: editTripDescription,
          startDate: editStartDate || null,
          endDate: editEndDate || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setShowEditTripDialog(false);
      toast({
        title: "Trip Updated",
        description: "Trip details have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update trip",
      });
    },
  });

  // Check if this place is liked
  useEffect(() => {
    if (place && likes) {
      setIsLiked(likes.some(like => like.placeId === place.place_id));
    }
  }, [place, likes]);

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!place) return;

      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          placeId: place.place_id,
          placeName: place.name,
          placeAddress: place.formatted_address
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/likes'] });
      setIsLiked(true);
      toast({
        title: "Added to Likes",
        description: "This place has been added to your likes.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to like place",
      });
    },
  });

  // Unlike mutation
  const unlikeMutation = useMutation({
    mutationFn: async () => {
      if (!place) return;

      const response = await fetch(`/api/likes/${place.place_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/likes'] });
      setIsLiked(false);
      toast({
        title: "Removed from Likes",
        description: "This place has been removed from your likes.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unlike place",
      });
    },
  });

  const handleLikeToggle = () => {
    if (isLiked) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const handleShare = async () => {
    if (!place) return;

    try {
      const shareData = {
        title: place.name || 'Check out this place!',
        text: `Check out ${place.name}${place.formatted_address ? ` at ${place.formatted_address}` : ''}`,
        url: place.url || window.location.href,
      };

      if (navigator.share) {
        await navigator.share(shareData);
        toast({
          title: "Shared Successfully",
          description: "The place has been shared.",
        });
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        toast({
          title: "Copied to Clipboard",
          description: "The place details have been copied to your clipboard.",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to share the place",
      });
    }
  };

  const handleEditTrip = (tripId: string) => {
    const trip = trips.find(t => t.id.toString() === tripId);
    if (trip) {
      setEditTripName(trip.name);
      setEditTripDescription(trip.description || '');
      setEditStartDate(trip.startDate || '');
      setEditEndDate(trip.endDate || '');
      setShowEditTripDialog(true);
    }
  };

  if (!isOpen) return null;

  // Show loading or error state if place data isn't available
  if (!place) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold">{place.name || 'Unnamed Place'}</DialogTitle>
                {place.formatted_address && (
                  <DialogDescription className="text-sm">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    {place.formatted_address}
                  </DialogDescription>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  onClick={handleLikeToggle}
                  disabled={likeMutation.isPending || unlikeMutation.isPending}
                >
                  <Heart
                    className={`w-5 h-5 transition-colors ${
                      isLiked ? 'fill-destructive stroke-destructive' : 'stroke-current'
                    }`}
                  />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleShare}>
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTripDialog(true)}
                >
                  Add to Trip
                </Button>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Rating & Reviews */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Rating & Reviews</h3>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Write Review
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Review {place.name}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const rating = parseInt(formData.get('rating') as string);
                        const comment = formData.get('comment') as string;

                        if (!place.geometry?.location || !place.formatted_address) {
                          toast({
                            title: "Error",
                            description: "Missing location information",
                            variant: "destructive"
                          });
                          return;
                        }

                        const processedLocation = {
                          coordinates: {
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng()
                          },
                          formatted_address: place.formatted_address,
                          ...(place.address_components?.reduce((acc, component) => {
                            if (component.types.includes('locality')) {
                              acc.city = component.long_name;
                            }
                            if (component.types.includes('country')) {
                              acc.country = component.long_name;
                            }
                            return acc;
                          }, {} as { city?: string; country?: string }))
                        };

                        fetch('/api/reviews', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            placeId: place.place_id,
                            placeName: place.name,
                            rating,
                            comment,
                            location: processedLocation
                          }),
                        })
                          .then(response => {
                            if (!response.ok) {
                              throw new Error('Failed to submit review');
                            }
                            return response.json();
                          })
                          .then(() => {
                            toast({
                              title: "Review submitted",
                              description: "Thank you for your review!"
                            });
                            queryClient.invalidateQueries({ queryKey: ['/api/reviews/place', place.place_id] });
                            (e.target as HTMLFormElement).reset();
                          })
                          .catch(error => {
                            toast({
                              title: "Error",
                              description: "Failed to submit review. Please try again.",
                              variant: "destructive"
                            });
                          });
                      }}>
                        <div className="space-y-4 my-4">
                          <div className="space-y-2">
                            <Label htmlFor="rating">Rating</Label>
                            <Select name="rating" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select rating" />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5].map(num => (
                                  <SelectItem key={num} value={num.toString()}>
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
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">⭐</span>
                  <span className="text-xl font-medium">{place.rating || 'N/A'}</span>
                  {place.user_ratings_total !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      ({place.user_ratings_total} Google reviews)
                    </span>
                  )}
                </div>
                {place.price_level !== undefined && (
                  <p className="text-sm text-muted-foreground">
                    Price Level: {'$'.repeat(place.price_level)}
                  </p>
                )}
              </div>

              <Separator />

              {/* Business Hours */}
              {place.opening_hours && (
                <div>
                  <h3 className="font-semibold mb-2">Business Hours</h3>
                  <div className="text-sm grid gap-1">
                    {place.opening_hours.weekday_text?.map((hours, idx) => (
                      <p key={idx} className="flex justify-between">
                        <span className="font-medium">{hours.split(': ')[0]}</span>
                        <span>{hours.split(': ')[1]}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Contact Information */}
              <div className="space-y-2">
                <h3 className="font-semibold">Contact Information</h3>
                {place.formatted_phone_number && (
                  <p className="text-sm flex items-center gap-2">
                    📞{' '}
                    <a
                      href={`tel:${place.formatted_phone_number}`}
                      className="text-blue-600 hover:underline"
                    >
                      {place.formatted_phone_number}
                    </a>
                  </p>
                )}
                {place.website && (
                  <p className="text-sm flex items-center gap-2">
                    🌐{' '}
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Visit Website
                    </a>
                  </p>
                )}
              </div>

              {/* Additional Information */}
              {((place?.types && place.types.length > 0) || place?.business_status) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold">Additional Information</h3>
                    {place?.business_status && (
                      <p className="text-sm">
                        Status:{' '}
                        <span className="capitalize">
                          {place.business_status.toLowerCase().replace('_', ' ')}
                        </span>
                      </p>
                    )}
                    {place?.types && place.types.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {place.types.map((type, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 bg-secondary rounded-full"
                          >
                            {type.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {/* Reviews Section */}
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Voxa Reviews</h3>
                  <span className="text-sm text-muted-foreground">
                    {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                  </span>
                </div>
                <div className="space-y-4">
                  <Reviews
                    placeId={place.place_id}
                    placeName={place.name}
                    placeLocation={place.geometry?.location ? {
                      coordinates: {
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng()
                      },
                      // Try to extract city and country from address components
                      ...place.address_components?.reduce((acc, component) => {
                        if (component.types.includes('locality')) {
                          acc.city = component.long_name;
                        }
                        if (component.types.includes('country')) {
                          acc.country = component.long_name;
                        }
                        return acc;
                      }, {} as { city?: string; country?: string })
                    } : undefined}
                  />
                  {reviews.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No reviews yet. Be the first to review this place!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showTripDialog} onOpenChange={setShowTripDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Trip</DialogTitle>
            <DialogDescription>
              Select a trip to add this place to
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select
              value={selectedTripId}
              onValueChange={setSelectedTripId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a trip" />
              </SelectTrigger>
              <SelectContent>
                {trips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id.toString()}>
                    {trip.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTripId && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => handleEditTrip(selectedTripId)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Trip Details
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => addToTripMutation.mutate()}
              disabled={!selectedTripId || addToTripMutation.isPending}
            >
              {addToTripMutation.isPending ? "Adding..." : "Add to Trip"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditTripDialog} onOpenChange={setShowEditTripDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Trip Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tripName">Trip Name</Label>
              <Input
                id="tripName"
                value={editTripName}
                onChange={(e) => setEditTripName(e.target.value)}
                placeholder="Enter trip name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tripDescription">Description</Label>
              <Textarea
                id="tripDescription"
                value={editTripDescription}
                onChange={(e) => setEditTripDescription(e.target.value)}
                placeholder="Enter trip description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => editTripMutation.mutate()}
              disabled={!editTripName || editTripMutation.isPending}
            >
              {editTripMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}