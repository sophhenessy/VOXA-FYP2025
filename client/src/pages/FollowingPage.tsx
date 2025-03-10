import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { BottomNav } from "@/components/BottomNav";
import { ThumbsUp, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

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
  groupId: number | null;
  groupName: string | null;
  location: {
    coordinates: {
      lat: number;
      lng: number;
    };
    formatted_address: string;
    distance?: number;
  } | null;
};

export default function FollowingPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [userCoords, setUserCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      setLocation('/auth');
      return;
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          setUserCoords({ lat: null, lng: null });
        }
      );
    }
  }, []);

  const { data: followingReviews = [], isError: isFollowingError } = useQuery<Review[]>({
    queryKey: ['/api/reviews/following', user?.id, userCoords],
    enabled: !!user,
    queryFn: async () => {
      try {
        console.log('Fetching following reviews for user:', user?.id);
        const params = new URLSearchParams();
        if (userCoords.lat !== null) params.append('userLat', userCoords.lat.toString());
        if (userCoords.lng !== null) params.append('userLng', userCoords.lng.toString());

        const response = await fetch(`/api/reviews/following?${params.toString()}`, {
          credentials: "include",
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch following reviews");
        }

        const data = await response.json();
        console.log('Fetched following reviews:', data);
        return data;
      } catch (error) {
        console.error('Error fetching following reviews:', error);
        throw error;
      }
    }
  });

  const { data: communityReviews = [], isError: isCommunityError } = useQuery<Review[]>({
    queryKey: ['/api/reviews/community', user?.id, userCoords],
    enabled: !!user,
    queryFn: async () => {
      try {
        console.log('Fetching community reviews for user:', user?.id);
        const params = new URLSearchParams();
        if (userCoords.lat !== null) params.append('userLat', userCoords.lat.toString());
        if (userCoords.lng !== null) params.append('userLng', userCoords.lng.toString());

        const response = await fetch(`/api/reviews/community?${params.toString()}`, {
          credentials: "include",
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch community reviews");
        }

        const data = await response.json();
        console.log('Fetched community reviews:', data);
        return data;
      } catch (error) {
        console.error('Error fetching community reviews:', error);
        throw error;
      }
    }
  });

  const handleLikeReview = async (reviewId: number) => {
    if (!user) {
      setLocation('/auth');
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${reviewId}/like`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to like review");
      }

      await queryClient.invalidateQueries({ 
        queryKey: ['/api/reviews/following', user.id]
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/reviews/community', user.id]
      });
    } catch (error) {
      console.error('Error liking review:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to like review",
      });
    }
  };

  const navigateToBusinessProfile = (placeId: string) => {
    if (!placeId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid business ID",
      });
      return;
    }
    setLocation(`/business/${encodeURIComponent(placeId)}`);
  };

  const renderReviews = (reviews: Review[]) => {
    return reviews.map((review) => (
      <Card key={review.id} className="mb-4">
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="font-semibold text-base">
                {review.placeName ? (
                  <button
                    onClick={() => navigateToBusinessProfile(review.placeId)}
                    className="hover:underline text-left"
                    aria-label={`View ${review.placeName} details`}
                  >
                    {review.placeName}
                  </button>
                ) : (
                  <span>Unnamed location</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                by {review.username}
                {review.groupName && (
                  <span className="ml-2 text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                    Posted in {review.groupName}
                  </span>
                )}
              </p>
              {review.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {review.location.formatted_address}
                    {review.location.distance !== undefined &&
                      !isNaN(review.location.distance) &&
                      ` • ${review.location.distance.toFixed(1)} km away`}
                  </span>
                </p>
              )}
              <div className="flex items-center mt-2">
                {'⭐'.repeat(review.rating)}
              </div>
              <p className="text-sm mt-2">{review.comment}</p>
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
    ));
  };

  return (
    <>
      <div className="container max-w-2xl mx-auto p-4 pb-20">
        {!user ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Please log in to view reviews</p>
            <Button onClick={() => setLocation('/auth')} className="mt-4">
              Log In
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="following" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="following">Following</TabsTrigger>
              <TabsTrigger value="community">Community</TabsTrigger>
            </TabsList>

            <TabsContent value="following">
              {isFollowingError ? (
                <p className="text-center text-red-500 py-4">
                  Error loading following reviews. Please try again later.
                </p>
              ) : followingReviews.length > 0 ? (
                renderReviews(followingReviews)
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Follow some users to see their reviews here
                </p>
              )}
            </TabsContent>

            <TabsContent value="community">
              {isCommunityError ? (
                <p className="text-center text-red-500 py-4">
                  Error loading community reviews. Please try again later.
                </p>
              ) : communityReviews.length > 0 ? (
                renderReviews(communityReviews)
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No community reviews yet
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <BottomNav />
    </>
  );
}