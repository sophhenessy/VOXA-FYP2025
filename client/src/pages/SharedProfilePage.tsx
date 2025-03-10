import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Users, Map, Star, UserPlus, UserMinus } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

interface PublicProfile {
  id: number;
  username: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  publicTripsCount: number;
  publicReviewsCount: number;
  isFollowing: boolean;
}

interface PublicTrip {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface PublicReview {
  id: number;
  placeName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
}

export default function SharedProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { data: profile, isLoading: profileLoading } = useQuery<PublicProfile>({
    queryKey: [`/api/users/${username}/public`],
  });

  const { data: trips = [], isLoading: tripsLoading } = useQuery<PublicTrip[]>({
    queryKey: [`/api/users/${username}/trips`],
    enabled: !!username,
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<PublicReview[]>({
    queryKey: [`/api/users/${username}/reviews`],
    enabled: !!username,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      const response = await fetch(`/api/social/${profile.isFollowing ? 'unfollow' : 'follow'}/${profile.id}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${profile.isFollowing ? 'unfollow' : 'follow'} user`);
      }
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/users/${username}/public`] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/following"] });
      toast({ 
        title: "Success", 
        description: `Successfully ${profile?.isFollowing ? 'unfollowed' : 'followed'} user` 
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update follow status",
        variant: "destructive"
      });
    }
  });

  const handleFollowToggle = () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to follow users",
        variant: "destructive"
      });
      return;
    }
    followMutation.mutate();
  };

  if (profileLoading || tripsLoading || reviewsLoading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Users className="w-6 h-6 text-primary animate-pulse" />
          <h1 className="text-2xl font-bold">Loading profile...</h1>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Users className="w-6 h-6 text-destructive" />
          <h1 className="text-2xl font-bold">Profile not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 pb-20">
      <Card className="mb-6">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24">
              {profile.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt={profile.displayName || profile.username} />
              ) : (
                <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
              )}
            </Avatar>
          </div>
          <CardTitle className="text-2xl">
            {profile.displayName || profile.username}
          </CardTitle>
          {profile.bio && (
            <p className="text-muted-foreground mt-2">{profile.bio}</p>
          )}
          {user && user.username !== profile.username && (
            <Button
              className="mt-4"
              variant={profile.isFollowing ? "default" : "outline"}
              onClick={handleFollowToggle}
              disabled={followMutation.isPending}
            >
              {profile.isFollowing ? (
                <>
                  <UserMinus className="h-4 w-4 mr-2" />
                  Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Follow
                </>
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {profile.location && (
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <MapPin className="w-4 h-4" />
              <span>{profile.location}</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="w-4 h-4 mx-auto mb-2" />
                <p className="text-2xl font-bold">{profile.followersCount}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="w-4 h-4 mx-auto mb-2" />
                <p className="text-2xl font-bold">{profile.followingCount}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Map className="w-4 h-4 mx-auto mb-2" />
                <p className="text-2xl font-bold">{trips.length}</p>
                <p className="text-xs text-muted-foreground">Public Trips</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Star className="w-4 h-4 mx-auto mb-2" />
                <p className="text-2xl font-bold">{reviews.length}</p>
                <p className="text-xs text-muted-foreground">Public Reviews</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Public Reviews - Now placed before Trips */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            <CardTitle>Reviews</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="p-4 border rounded-lg">
                    <h3 className="font-medium">{review.placeName || "Unnamed location"}</h3>
                    <div className="flex items-center mt-2">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 text-yellow-400 fill-current"
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {review.comment}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center">
                No reviews yet
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Public Trips - Now placed after Reviews */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            <CardTitle>Public Trips</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {trips.length > 0 ? (
              <div className="space-y-4">
                {trips.map((trip) => (
                  <div key={trip.id} className="p-4 border rounded-lg">
                    <h3 className="font-medium">{trip.name}</h3>
                    {trip.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {trip.description}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(trip.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center">
                No public trips yet
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      <BottomNav />
    </div>
  );
}