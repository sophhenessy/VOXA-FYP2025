import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { useForm } from "react-hook-form";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Settings,
  Users,
  MapPin,
  Star,
  Trash2,
  Share2,
  UserMinus,
  UserPlus,
  Mail,
  Lock,
  Globe,
  Bell,
  Eye,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BottomNav } from "@/components/BottomNav";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";


interface ProfileFormData {
  username: string;
  displayName: string;
  bio: string;
  location: string;
  avatar?: FileList;
}

interface SocialStats {
  followersCount: number;
  followingCount: number;
}

interface UserProfile {
  id: number;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isFollowing?: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  followPermission: 'everyone' | 'approved';
  reviewsVisibility: 'public' | 'private';
}

interface NotificationSettings {
  likesNotifications: boolean;
  commentsNotifications: boolean;
  messagesNotifications: boolean;
  reviewsNotifications: boolean;
}

interface EmailSettings {
  email: string;
  emailVerified: boolean;
}


export default function ProfilePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: socialStats } = useQuery<SocialStats>({
    queryKey: [`/api/users/${user?.username}/stats`],
    enabled: !!user,
  });

  const { data: followers = [] } = useQuery<UserProfile[]>({
    queryKey: [`/api/users/${user?.username}/followers`],
    enabled: !!user,
  });

  const { data: following = [] } = useQuery<UserProfile[]>({
    queryKey: [`/api/users/${user?.username}/following`],
    enabled: !!user,
  });

  const { data: trips = [] } = useQuery<any[]>({
    queryKey: ["/api/trips"],
    enabled: !!user,
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<any[]>({
    queryKey: [`/api/users/${user?.username}/reviews`],
    enabled: !!user,
    onSuccess: (data) => {
      console.log('Fetched reviews:', data);
    },
    onError: (error) => {
      console.error('Error fetching reviews:', error);
    }
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormData>({
    defaultValues: {
      username: user?.username || "",
      displayName: user?.displayName || "",
      bio: user?.bio || "",
      location: user?.location || "",
    },
  });

  const followMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/social/follow/${userId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to follow user');
      }
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.username}/following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.username}/followers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.username}/stats`] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/following"] });
      toast({ title: "Success", description: "Successfully followed user" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to follow user",
        variant: "destructive"
      });
    }
  });

  const unfollowMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/social/unfollow/${userId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unfollow user');
      }
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.username}/following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.username}/followers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.username}/stats`] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/following"] });
      toast({ title: "Success", description: "Successfully unfollowed user" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unfollow user",
        variant: "destructive"
      });
    }
  });

  const handleFollow = (userId: number) => {
    followMutation.mutate(userId);
  };

  const handleUnfollow = (userId: number) => {
    unfollowMutation.mutate(userId);
  };

  const handleShare = async () => {
    if (!user) return;

    try {
      const shareUrl = `${window.location.origin}/users/${user.username}`;

      // Check if native sharing is available and all required data types are supported
      if (navigator.share && navigator.canShare &&
        navigator.canShare({ url: shareUrl, text: `Check out ${user.displayName || user.username}'s profile!`, title: user.displayName || user.username })) {
        await navigator.share({
          title: user.displayName || user.username,
          text: `Check out ${user.displayName || user.username}'s profile!`,
          url: shareUrl
        });
        toast({
          title: "Shared Successfully",
          description: "Your profile has been shared.",
        });
      } else {
        // Fallback to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast({
            title: "Link Copied",
            description: "Your profile link has been copied to your clipboard.",
          });
        } catch (clipboardError) {
          // If clipboard fails, show the URL in a toast
          toast({
            title: "Share Link",
            description: `Share this URL: ${shareUrl}`,
          });
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // More specific error message
      const errorMessage = error instanceof Error ? error.message : "Unable to share profile";
      toast({
        variant: "destructive",
        title: "Sharing Failed",
        description: `Could not share profile: ${errorMessage}`,
      });
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      console.log('Starting profile update mutation with data:', data);

      // Handle avatar separately if present
      if (data.avatar?.[0]) {
        const formData = new FormData();
        formData.append('avatar', data.avatar[0]);

        console.log('Uploading avatar...');
        const avatarResponse = await fetch("/api/profile/avatar", {
          method: "PUT",
          body: formData,
          credentials: "include",
        });

        if (!avatarResponse.ok) {
          const error = await avatarResponse.text();
          console.error('Avatar update failed:', error);
          throw new Error(error);
        }
        console.log('Avatar uploaded successfully');
      }

      // Send profile data as JSON
      console.log('Sending profile update request with data:', {
        username: data.username,
        displayName: data.displayName,
        bio: data.bio,
        location: data.location,
      });

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: data.username,
          displayName: data.displayName,
          bio: data.bio || '',
          location: data.location || '',
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Profile update failed:', error);
        try {
          // Try to parse as JSON
          const errorJson = JSON.parse(error);
          throw new Error(errorJson.error || 'Failed to update profile');
        } catch (e) {
          // If not JSON, use the raw error text
          throw new Error(error || 'Failed to update profile');
        }
      }

      const result = await response.json();
      console.log('Profile update successful:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('Profile update mutation succeeded:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Profile update mutation failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
      });
    }
  });

  const onSubmit = async (data: ProfileFormData) => {
    console.log('Submitting form with data:', data);
    updateProfileMutation.mutate(data);
  };

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete review");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.username}/reviews`] });
      toast({
        title: "Review Deleted",
        description: "Your review has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete review",
      });
    },
  });

  const renderUserList = (users: UserProfile[], type: 'followers' | 'following') => {
    return (
      <ScrollArea className="h-[400px]">
        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
                  <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{user.displayName || user.username}</p>
                  {user.bio && (
                    <p className="text-sm text-muted-foreground">{user.bio}</p>
                  )}
                </div>
              </div>
              {type === 'following' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnfollow(user.id)}
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Unfollow
                </Button>
              )}
              {type === 'followers' && !user.isFollowing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFollow(user.id)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Follow Back
                </Button>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </p>
          )}
        </div>
      </ScrollArea>
    );
  };

  if (!user) {
    return <div>Please log in to view your profile.</div>;
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-8 pb-16">
      {/* Profile Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Profile Settings</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share Profile
              </Button>
              <div className="flex gap-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <div className="text-sm">
                        <span className="font-bold">{socialStats?.followersCount || 0}</span>
                        <span className="text-muted-foreground ml-1">followers</span>
                      </div>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Followers</DialogTitle>
                      <DialogDescription>People who follow you</DialogDescription>
                    </DialogHeader>
                    {renderUserList(followers, 'followers')}
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <div className="text-sm">
                        <span className="font-bold">{socialStats?.followingCount || 0}</span>
                        <span className="text-muted-foreground ml-1">following</span>
                      </div>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Following</DialogTitle>
                      <DialogDescription>People you follow</DialogDescription>
                    </DialogHeader>
                    {renderUserList(following, 'following')}
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
                <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="avatar" className="block mb-2">Profile Picture</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  {...register("avatar")}
                  className="cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                {...register("username")}
                placeholder="Your username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                {...register("displayName")}
                placeholder="Your display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                {...register("bio")}
                placeholder="Tell us about yourself"
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...register("location")}
                placeholder="Enter your location"
              />
            </div>
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="w-full"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Reviews Card - Moved up */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            <CardTitle>My Reviews</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review: any) => (
                  <div key={review.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{review.placeName}</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-4 w-4 text-yellow-400 fill-current"
                            />
                          ))}
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Review</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this review? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteReviewMutation.mutate(review.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
                No reviews written yet
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Trips Card - Moved below Reviews */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <CardTitle>My Trips</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {trips.length > 0 ? (
              <div className="space-y-4">
                {trips.map((trip: any) => (
                  <Link
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="block"
                  >
                    <div className="p-4 border rounded-lg hover:bg-secondary/50 transition-colors">
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
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center">
                No trips created yet
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Email & Security Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Email & Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Address</Label>
                <p className="text-sm text-muted-foreground">
                  {user.email}
                  {user.emailVerified && (
                    <span className="ml-2 text-green-600">(Verified)</span>
                  )}
                </p>
              </div>
              {!user.emailVerified && (
                <Button variant="outline" onClick={() => {/* Handle verification */}}>
                  Verify Email
                </Button>
              )}
            </div>
            <div>
              <Button variant="outline" className="w-full" onClick={() => {/* Handle email update */}}>
                Update Email
              </Button>
            </div>
            <div>
              <Button variant="outline" className="w-full" onClick={() => {/* Handle password reset */}}>
                Change Password
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings - UPDATED */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <CardTitle>Privacy & Appearance Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle between light and dark theme
                </p>
              </div>
              <ThemeToggle />
            </div>
            <Separator className="my-4" />
            <div className="space-y-2">
              <Label>Profile Visibility</Label>
              <Select defaultValue="public" onValueChange={(value) => {/* Handle visibility change */}}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="friends">Friends Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Follow Permission</Label>
              <Select defaultValue="everyone" onValueChange={(value) => {/* Handle follow permission change */}}>
                <SelectTrigger>
                  <SelectValue placeholder="Select who can follow you" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="approved">Approved Users Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reviews Visibility</Label>
              <Select defaultValue="public" onValueChange={(value) => {/* Handle reviews visibility change */}}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reviews visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notification Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Likes Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications when someone likes your content
                </p>
              </div>
              <Switch
                checked={true}
                onCheckedChange={(checked) => {/* Handle likes notifications */}}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Comments Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for comments on your content
                </p>
              </div>
              <Switch
                checked={true}
                onCheckedChange={(checked) => {/* Handle comments notifications */}}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Messages Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for new messages
                </p>
              </div>
              <Switch
                checked={true}
                onCheckedChange={(checked) => {/* Handle messages notifications */}}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Reviews Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for new reviews on places you follow
                </p>
              </div>
              <Switch
                checked={true}
                onCheckedChange={(checked) => {/* Handle reviews notifications */}}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <BottomNav />
    </div>
  );
}