import { useEffect } from 'react';
import { useUser } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MapPin } from 'lucide-react';
import { useLocation } from 'wouter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

interface Location {
  coordinates: {
    lat: number;
    lng: number;
  };
  formatted_address: string;
  distance?: number;
  city?: string;
  country?: string;
}

interface Review {
  id: number;
  placeId: string;
  username: string;
  rating: number;
  comment: string;
  createdAt: string;
  location: Location | null;
}

interface ReviewsProps {
  placeId?: string;
  placeName?: string;
  placeLocation?: Location;
  groupId?: number;
  showGroupSelection?: boolean;
}

export function Reviews({ placeId, placeName, placeLocation, groupId, showGroupSelection = true }: ReviewsProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['/api/groups'],
    enabled: !!user && showGroupSelection
  });

  // Get user location
  const { data: userLocation } = useQuery({
    queryKey: ['userLocation'],
    queryFn: () => {
      return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            console.error('Error getting location:', error);
            reject(error);
          }
        );
      });
    },
    retry: false,
    staleTime: Infinity
  });

  // Fetch reviews using React Query
  const { data: reviews = [], isLoading, error } = useQuery<Review[]>({
    queryKey: ['reviews', { placeId, groupId, userLocation }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userLocation) {
        params.append('userLat', userLocation.lat.toString());
        params.append('userLng', userLocation.lng.toString());
      }

      const endpoint = groupId 
        ? `/api/groups/${groupId}/reviews${params.toString() ? `?${params.toString()}` : ''}`
        : placeId
          ? `/api/reviews/place/${placeId}${params.toString() ? `?${params.toString()}` : ''}`
          : `/api/reviews/following${params.toString() ? `?${params.toString()}` : ''}`;

      console.log('Fetching reviews from endpoint:', endpoint);

      const response = await fetch(endpoint, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch reviews');
      }

      const data = await response.json();
      console.log('Fetched reviews:', data);
      return data;
    },
    enabled: !!(user && (placeId || groupId))
  });

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async ({ rating, comment, selectedGroupId }: { 
      rating: number; 
      comment: string; 
      selectedGroupId: string;
    }) => {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          placeId,
          placeName,
          rating,
          comment,
          location: placeLocation,
          groupId: selectedGroupId === "none" ? null : parseInt(selectedGroupId)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit review');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reviews/following'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reviews/community'] });
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: [`/api/groups/${groupId}/reviews`] });
      }
      if (placeId) {
        queryClient.invalidateQueries({ queryKey: [`/api/reviews/place/${placeId}`] });
      }

      toast({
        title: "Success",
        description: "Review submitted successfully",
      });
    },
    onError: (error: Error) => {
      console.error('Error submitting review:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive"
      });
    }
  });

  if (isLoading) return <div className="p-4">Loading reviews...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error instanceof Error ? error.message : 'Failed to load reviews'}</div>;

  const handleSubmitReview = async (rating: number, comment: string, selectedGroupId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to submit a review",
        variant: "destructive"
      });
      return;
    }

    if (!placeLocation && !groupId) {
      toast({
        title: "Error",
        description: "Missing location information",
        variant: "destructive"
      });
      return;
    }

    await submitReviewMutation.mutateAsync({ rating, comment, selectedGroupId });
  };

  return (
    <div className="space-y-4">
      {user && (
        <div className="space-y-4 mb-6 bg-card p-4 rounded-lg border">
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleSubmitReview(value, '', groupId ? groupId.toString() : 'none')}
                className={`text-2xl ${submitReviewMutation.variables?.rating >= value ? 'text-amber-500' : 'text-gray-300'}`}
              >
                ⭐
              </button>
            ))}
          </div>

          {showGroupSelection && !groupId && (
            <div className="space-y-2">
              <Label htmlFor="groupSelect">Share with Group (Optional)</Label>
              <Select 
                value={submitReviewMutation.variables?.selectedGroupId || "none"} 
                onValueChange={(value) => handleSubmitReview(
                  submitReviewMutation.variables?.rating || 5,
                  submitReviewMutation.variables?.comment || '',
                  value
                )}
              >
                <SelectTrigger className="w-full" id="groupSelect">
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
          )}

          <div className="space-y-2">
            <Label htmlFor="reviewComment">Your Review</Label>
            <Textarea
              id="reviewComment"
              value={submitReviewMutation.variables?.comment || ''}
              onChange={(e) => handleSubmitReview(
                submitReviewMutation.variables?.rating || 5,
                e.target.value,
                submitReviewMutation.variables?.selectedGroupId || 'none'
              )}
              placeholder="Write your review..."
              className="w-full"
            />
          </div>

          <Button 
            onClick={() => handleSubmitReview(
              submitReviewMutation.variables?.rating || 5,
              submitReviewMutation.variables?.comment || '',
              submitReviewMutation.variables?.selectedGroupId || 'none'
            )}
            className="w-full"
            disabled={submitReviewMutation.isPending}
          >
            {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border rounded-lg p-4 bg-card">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-semibold mb-1">
                    {review.username}
                  </div>
                  <div className="text-sm mb-2 text-amber-500">
                    {'⭐'.repeat(review.rating)}
                  </div>
                  <p className="text-sm text-card-foreground mb-2">{review.comment}</p>
                  {review.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>
                        {[
                          review.location.formatted_address,
                          review.location.distance !== undefined && !isNaN(review.location.distance)
                            ? `${review.location.distance.toFixed(1)} km away`
                            : null
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}