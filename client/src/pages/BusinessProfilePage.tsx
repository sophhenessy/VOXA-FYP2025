import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, ThumbsUp, Heart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/hooks/use-user";
import { Loader } from '@googlemaps/js-api-loader';

type Review = {
  id: number;
  placeId: string;
  username: string;
  placeName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  likes: number;
  isLiked: boolean;
  location: {
    coordinates: {
      lat: number;
      lng: number;
    };
    formatted_address: string;
    distance?: number;
  } | null;
};

type Trip = {
  id: number;
  name: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
};

let mapsLoader: Loader | null = null;

export default function BusinessProfilePage() {
  const { placeId } = useParams();
  const decodedPlaceId = placeId ? decodeURIComponent(placeId) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(false);
  const [showTripDialog, setShowTripDialog] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeMaps = async () => {
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
        setIsInitialized(true);
        setInitError(null);
      } catch (error) {
        console.error('Error initializing Google Maps:', error);
        setInitError(error instanceof Error ? error.message : 'Failed to initialize map services');
        toast({
          title: "Error",
          description: "There was a problem loading business details. Please try again.",
          variant: "destructive"
        });
      }
    };

    if (decodedPlaceId) {
      initializeMaps();
    }
  }, [decodedPlaceId, toast]);

  const { data: placeDetails, isLoading: isLoadingDetails, error: placeError } = useQuery<google.maps.places.PlaceResult>({
    queryKey: ["placeDetails", decodedPlaceId],
    queryFn: async () => {
      if (!decodedPlaceId) {
        throw new Error("Missing place ID");
      }

      if (!isInitialized) {
        throw new Error("Map services not initialized");
      }

      return new Promise((resolve, reject) => {
        const service = new google.maps.places.PlacesService(
          document.createElement('div')
        );

        console.log('Fetching place details for:', decodedPlaceId);
        service.getDetails(
          {
            placeId: decodedPlaceId,
            fields: [
              'name',
              'formatted_address',
              'geometry',
              'formatted_phone_number',
              'website',
              'opening_hours',
              'price_level',
              'types',
              'url'
            ],
          },
          (result, status) => {
            console.log('Place details status:', status);
            if (status === google.maps.places.PlacesServiceStatus.OK && result) {
              resolve(result);
            } else {
              reject(new Error(`Failed to fetch place details: ${status}`));
            }
          }
        );
      });
    },
    enabled: !!decodedPlaceId && isInitialized,
    retry: 2,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Only fetch likes if user is authenticated
  const { data: likes = [] } = useQuery<{ placeId: string }[]>({
    queryKey: ['/api/likes'],
    enabled: !!user
  });

  useEffect(() => {
    if (decodedPlaceId && likes) {
      setIsLiked(likes.some(like => like.placeId === decodedPlaceId));
    }
  }, [decodedPlaceId, likes]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!decodedPlaceId || !placeDetails) return;

      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          placeId: decodedPlaceId,
          placeName: placeDetails.name,
          placeAddress: placeDetails.formatted_address
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

  const unlikeMutation = useMutation({
    mutationFn: async () => {
      if (!decodedPlaceId) return;

      const response = await fetch(`/api/likes/${decodedPlaceId}`, {
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

  const addToTripMutation = useMutation({
    mutationFn: async () => {
      if (!decodedPlaceId || !selectedTripId || !placeDetails) return;

      const response = await fetch(`/api/trips/${selectedTripId}/places`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          placeId: decodedPlaceId,
          placeName: placeDetails.name,
          placeAddress: placeDetails.formatted_address,
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

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['/api/trips'],
    enabled: !!user && showTripDialog
  });

  const handleLikeToggle = () => {
    if (isLiked) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const handleShare = async () => {
    if (!placeDetails) return;

    try {
      const shareData = {
        title: placeDetails.name || 'Check out this place!',
        text: `Check out ${placeDetails.name}${placeDetails.formatted_address ? ` at ${placeDetails.formatted_address}` : ''}`,
        url: placeDetails.url || window.location.href,
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


  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/groups'],
    enabled: !!user
  });

  const handleLikeReview = (reviewId: number) => {
    // Implement like/unlike logic for individual reviews here.  This will likely involve another mutation.
  };

  const handleSubmitReview = async (formData: FormData) => {
    try {
      if (!decodedPlaceId || !placeDetails?.geometry?.location || !placeDetails.formatted_address) {
        throw new Error("Missing required place information");
      }

      const rating = parseInt(formData.get('rating') as string);
      const comment = formData.get('comment') as string;
      const groupId = formData.get('groupId') as string;

      const processedLocation = {
        coordinates: {
          lat: placeDetails.geometry.location.lat(),
          lng: placeDetails.geometry.location.lng()
        },
        formatted_address: placeDetails.formatted_address
      };

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          placeId: decodedPlaceId,
          placeName: placeDetails.name,
          rating,
          comment,
          location: processedLocation,
          groupId: groupId === 'none' ? null : groupId ? parseInt(groupId) : null
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit review');
      }

      await response.json();

      // Invalidate all relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/reviews/place", decodedPlaceId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/reviews/following'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/reviews/community'] })
      ]);

      toast({
        title: "Review submitted",
        description: "Thank you for your review!"
      });

      return true;
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit review",
        variant: "destructive"
      });
      return false;
    }
  };

  // Update the reviews fetching logic
  const { data: reviews = [], isLoading: isLoadingReviews } = useQuery<Review[]>({
    queryKey: ["/api/reviews/place", decodedPlaceId, user?.id],
    enabled: !!decodedPlaceId,
    queryFn: async () => {
      try {
        let userLat: number | undefined;
        let userLng: number | undefined;

        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          userLat = position.coords.latitude;
          userLng = position.coords.longitude;
        } catch (error) {
          console.log('User location not available:', error);
        }

        let url = `/api/reviews/place/${encodeURIComponent(decodedPlaceId || '')}`;
        if (userLat !== undefined && userLng !== undefined) {
          url += `?userLat=${userLat}&userLng=${userLng}`;
        }

        const response = await fetch(url, {
          credentials: "include",
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(error || 'Failed to fetch reviews');
        }

        const data = await response.json();
        console.log('Fetched reviews for place:', data);
        return data;
      } catch (error) {
        console.error('Error fetching reviews:', error);
        throw error;
      }
    }
  });

  if (initError) {
    return (
      <div className="container max-w-2xl mx-auto p-4 text-center">
        <div className="text-destructive mb-4">
          <MapPin className="w-6 h-6 mx-auto mb-2" />
          <p className="font-semibold">Error Loading Business</p>
        </div>
        <p className="text-muted-foreground mb-4">{initError}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (isLoadingDetails || !isInitialized) {
    return (
      <div className="container max-w-2xl mx-auto p-4 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-muted-foreground">Loading business details...</p>
      </div>
    );
  }

  if (placeError || !placeDetails) {
    return (
      <div className="container max-w-2xl mx-auto p-4 text-center">
        <div className="text-destructive mb-4">
          <MapPin className="w-6 h-6 mx-auto mb-2" />
          <p className="font-semibold">Business Not Found</p>
        </div>
        <p className="text-muted-foreground mb-4">
          {placeError instanceof Error ? placeError.message : "Could not load business details. Please try again later."}
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" onClick={() => window.history.back()} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">{placeDetails.name}</h1>
            {placeDetails.formatted_address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{placeDetails.formatted_address}</span>
              </div>
            )}
          </div>
          {user && (
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
          )}
        </div>

        <div className="mt-4">
          {/* VOXA Reviews Rating */}
          <div className="flex items-center gap-2">
            {reviews.length > 0 ? (
              <>
                <span>⭐</span>
                <span>
                  {(reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length).toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">No reviews yet</span>
            )}
          </div>

          {placeDetails.price_level !== undefined && (
            <p className="text-sm text-muted-foreground mt-2">
              Price Level: {'$'.repeat(placeDetails.price_level)}
            </p>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {placeDetails.formatted_phone_number && (
            <p className="text-sm flex items-center gap-2">
              📞{' '}
              <a
                href={`tel:${placeDetails.formatted_phone_number}`}
                className="text-blue-600 hover:underline"
              >
                {placeDetails.formatted_phone_number}
              </a>
            </p>
          )}
          {placeDetails.website && (
            <p className="text-sm flex items-center gap-2">
              🌐{' '}
              <a
                href={placeDetails.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Visit Website
              </a>
            </p>
          )}
        </div>

        {!user && (
          <div className="text-center my-6">
            <p className="text-muted-foreground mb-4">Log in to see reviews, add to trips, and more!</p>
            <Button asChild>
              <Link href="/auth">Log In</Link>
            </Button>
          </div>
        )}

        {user && (
          <>
            <Separator />
            {placeDetails.opening_hours && (
              <>
                <div className="my-6">
                  <h3 className="font-semibold mb-2">Business Hours</h3>
                  <div className="text-sm grid gap-1">
                    {placeDetails.opening_hours.weekday_text?.map((hours, idx) => (
                      <p key={idx} className="flex justify-between">
                        <span className="font-medium">{hours.split(': ')[0]}</span>
                        <span>{hours.split(': ')[1]}</span>
                      </p>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            <div className="my-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Reviews</h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Write Review
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Review {placeDetails.name}</DialogTitle>
                    </DialogHeader>
                    <form
                      className="space-y-4"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const success = await handleSubmitReview(new FormData(e.currentTarget));
                        if (success) {
                          (e.target as HTMLFormElement).reset();
                        }
                      }}
                    >
                      <div className="space-y-4">
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
                          <Label htmlFor="groupId">Share with Group (Optional)</Label>
                          <Select name="groupId" defaultValue="none">
                            <SelectTrigger>
                              <SelectValue placeholder="Select a group" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Don't share with a group</SelectItem>
                              {groups?.map(group => (
                                <SelectItem key={group.id} value={group.id.toString()}>
                                  {group.name}
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
                      <DialogFooter className="mt-4">
                        <Button type="submit">Submit Review</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoadingReviews ? (
                <div className="text-center py-4">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading reviews...</p>
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No reviews yet. Be the first to review!
                </p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <Card key={review.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">
                              by {review.username}
                            </p>
                            <div className="flex items-center mb-2">
                              {'⭐'.repeat(review.rating)}
                            </div>
                            <p className="text-sm">{review.comment}</p>
                            {review.location && (
                              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span>
                                  {review.location.formatted_address}
                                  {review.location.distance !== undefined &&
                                    !isNaN(review.location.distance) &&
                                    ` • ${review.location.distance.toFixed(1)} km away`}
                                </span>
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end">
                            <Button
                              variant={review.isLiked ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleLikeReview(review.id)}
                            >
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              {review.likes}
                            </Button>
                            <span className="text-xs text-muted-foreground mt-2">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}