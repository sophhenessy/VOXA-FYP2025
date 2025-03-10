import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThumbsUp, Search, UserPlus, UserMinus, MapPin, Map, Camera, Send, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import debounce from 'lodash/debounce';

interface Review {
  id: number;
  username: string;
  placeId: string;
  placeName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
  location?: {
    coordinates: {
      lat: number;
      lng: number;
    };
    formatted_address: string;
    distance?: number;
  } | null;
}

interface UserSearchResult {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isFollowing?: boolean;
}

interface PublicTrip {
  id: number;
  name: string;
  description: string | null;
  username: string;
  createdAt: string;
  placesCount: number;
}

interface Group {
  id: number;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  memberCount: number;
  isJoined: boolean;
  creatorUsername: string;
  creatorDisplayName: string | null;
  isAdmin: boolean;
}

interface GroupMessage {
  id: number;
  content: string;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
}

interface GroupReview extends Review {
  groupId: number | null;
  groupName: string | null;
}

export default function CommunityPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [followingReviews, setFollowingReviews] = useState<Review[]>([]);
  const [publicTrips, setPublicTrips] = useState<PublicTrip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupData, setNewGroupData] = useState({
    name: '',
    description: '',
    avatar: null as File | null,
  });
  const [selectedGroupReviews, setSelectedGroupReviews] = useState<GroupReview[]>([]);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupData, setEditGroupData] = useState<Group | null>(null);


  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log("Error getting location:", error);
          setIsLoading(false);
        }
      );
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await Promise.all([fetchReviews(), fetchFollowingReviews(), fetchPublicTrips(), fetchGroups()]);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!user) {
      setIsLoading(false);
      return;
    }

    loadData();
  }, [userCoords, user]);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        setIsSearching(true);
        const response = await fetch(`/api/reviews/search/users?query=${encodeURIComponent(query)}`);
        if (!response.ok) {
          throw new Error('Failed to search users');
        }
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to search users",
          variant: "destructive"
        });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  const fetchFollowingReviews = async () => {
    try {
      const url = new URL('/api/reviews/following', window.location.origin);
      if (userCoords) {
        url.searchParams.append('userLat', userCoords.lat.toString());
        url.searchParams.append('userLng', userCoords.lng.toString());
      }

      const response = await fetch(url.toString(), {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error('Failed to fetch following reviews');
      }
      const data = await response.json();
      setFollowingReviews(data);
    } catch (error) {
      console.error('Error fetching following reviews:', error);
      toast({
        title: "Error",
        description: "Failed to load following reviews",
        variant: "destructive"
      });
    }
  };

  const fetchReviews = async () => {
    try {
      const url = new URL('/api/reviews/community', window.location.origin);
      if (userCoords) {
        url.searchParams.append('userLat', userCoords.lat.toString());
        url.searchParams.append('userLng', userCoords.lng.toString());
      }

      const response = await fetch(url.toString(), {
        credentials: "include",
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }
      const data = await response.json();
      setReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        title: "Error",
        description: "Failed to load reviews",
        variant: "destructive"
      });
    }
  };

  const handleLikeReview = async (reviewId: number) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to like reviews",
        variant: "destructive"
      });
      return;
    }

    try {
      const review = reviews.find(r => r.id === reviewId);
      const isLiked = review?.isLiked;

      const response = await fetch(`/api/reviews/${reviewId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to update like');
      }

      const updateReviews = (prevReviews: Review[]) =>
        prevReviews.map(review => {
          if (review.id === reviewId) {
            return {
              ...review,
              likes: isLiked ? review.likes - 1 : review.likes + 1,
              isLiked: !isLiked
            };
          }
          return review;
        });

      setReviews(updateReviews);
      setFollowingReviews(updateReviews);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive"
      });
    }
  };

  const handleFollowUser = async (userId: number) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to follow users",
        variant: "destructive"
      });
      return;
    }

    try {
      const method = searchResults.find(u => u.id === userId)?.isFollowing ? 'unfollow' : 'follow';
      const response = await fetch(`/api/social/${method}/${userId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to ${method} user`);
      }

      setSearchResults(prev => prev.map(user => {
        if (user.id === userId) {
          return { ...user, isFollowing: !user.isFollowing };
        }
        return user;
      }));

      toast({
        title: "Success",
        description: `User ${method}ed successfully`,
      });

      await Promise.all([
        fetchFollowingReviews(),
        fetchReviews(),
      ]);

      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.username}/following`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user.username}/stats`] });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${searchResults.find(u => u.id === userId)?.isFollowing ? 'unfollow' : 'follow'} user`,
        variant: "destructive"
      });
    }
  };

  const navigateToBusinessProfile = (placeId: string) => {
    setLocation(`/business/${placeId}`);
  };

  const renderReviews = (reviewList: Review[]) => {
    if (isLoading) {
      return <p className="text-center text-muted-foreground">Loading reviews...</p>;
    }

    if (!user) {
      return (
        <p className="text-center text-muted-foreground">
          Please log in to view reviews.
        </p>
      );
    }

    if (reviewList.length === 0) {
      return (
        <p className="text-center text-muted-foreground">
          No reviews available.
        </p>
      );
    }

    return reviewList.map((review) => (
      <Card key={review.id} className="border-border/80">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <Link href={`/users/${review.username}`}>
                <a className="font-semibold hover:text-primary cursor-pointer">
                  {review.username}
                </a>
              </Link>
              <p className="text-sm text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant={review.isLiked ? "default" : "outline"}
              size="sm"
              onClick={() => handleLikeReview(review.id)}
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              {review.likes}
            </Button>
          </div>
          {review.placeName ? (
            <button
              onClick={() => navigateToBusinessProfile(review.placeId)}
              className="text-lg font-medium mb-1 hover:underline text-left w-auto"
            >
              {review.placeName}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground mb-1">Unnamed location</p>
          )}
          {review.location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="h-4 w-4" />
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
          <div className="text-amber-500 mb-2">
            {'⭐'.repeat(review.rating)}
          </div>
          <p className="text-sm">{review.comment}</p>
        </CardContent>
      </Card>
    ));
  };

  const fetchPublicTrips = async () => {
    try {
      console.log('Fetching public trips');
      const response = await fetch('/api/trips/public', {  
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to fetch public trips');
      }
      const data = await response.json();
      console.log('Fetched public trips:', data);  
      setPublicTrips(data);
    } catch (error) {
      console.error('Error fetching public trips:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load public trips",
        variant: "destructive"
      });
    }
  };

  const renderTrips = () => {
    if (isLoading) {
      return <p className="text-center text-muted-foreground">Loading trips...</p>;
    }

    if (!user) {
      return (
        <p className="text-center text-muted-foreground">
          Please log in to view trips.
        </p>
      );
    }

    if (publicTrips.length === 0) {
      return (
        <p className="text-center text-muted-foreground">
          No public trips available.
        </p>
      );
    }

    return publicTrips.map((trip) => (
      <Card key={trip.id} className="mb-4 border-border/80">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Link href={`/trips/shared/${trip.id}`}>
                <a className="text-lg font-medium hover:text-primary cursor-pointer">
                  {trip.name}
                </a>
              </Link>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href={`/users/${trip.username}`}>
                  <a className="hover:text-primary">@{trip.username}</a>
                </Link>
                <span>•</span>
                <span>{new Date(trip.createdAt).toLocaleDateString()}</span>
              </div>
              {trip.description && (
                <p className="text-sm text-muted-foreground">{trip.description}</p>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Map className="h-4 w-4" />
                <span>{trip.placesCount} {trip.placesCount === 1 ? 'place' : 'places'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    ));
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load groups",
        variant: "destructive"
      });
    }
  };

  const fetchGroupMessages = async (groupId: number) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/messages`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      });
    }
  };

  const fetchGroupReviews = async (groupId: number) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/reviews`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch group reviews');
      const data = await response.json();
      setSelectedGroupReviews(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load group reviews",
        variant: "destructive"
      });
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const formData = new FormData();
    formData.append('name', newGroupData.name);
    formData.append('description', newGroupData.description);
    if (newGroupData.avatar) {
      formData.append('avatar', newGroupData.avatar);
    }

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to create group');

      toast({
        title: "Success",
        description: "Group created successfully",
      });

      setIsCreatingGroup(false);
      setNewGroupData({ name: '', description: '', avatar: null });
      await fetchGroups();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create group",
        variant: "destructive"
      });
    }
  };

  const handleJoinGroup = async (groupId: number) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/join`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to join group');

      toast({
        title: "Success",
        description: "Joined group successfully",
      });

      await fetchGroups();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to join group",
        variant: "destructive"
      });
    }
  };

  const handleLeaveGroup = async (groupId: number) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/leave`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to leave group');

      toast({
        title: "Success",
        description: "Left group successfully",
      });

      await fetchGroups();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to leave group",
        variant: "destructive"
      });
    }
  };

  const handleSendMessage = async (groupId: number) => {
    if (!messageInput.trim() || !user) return;

    try {
      const response = await fetch(`/api/groups/${groupId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageInput }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      setMessageInput('');
      await fetchGroupMessages(groupId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const handleGroupSelect = async (group: Group) => {
    try {
      setSelectedGroup(group);
      await Promise.all([
        fetchGroupMessages(group.id),
        fetchGroupReviews(group.id)
      ]);
    } catch (error) {
      console.error('Error loading group data:', error);
      toast({
        title: "Error",
        description: "Failed to load group data",
        variant: "destructive"
      });
    }
  };

  const handleEditGroup = (group: Group) => {
    setIsEditingGroup(true);
    setEditGroupData(group);
  };

  const handleSaveGroupEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupData || !user) return;

    const formData = new FormData();
    formData.append('name', editGroupData.name);
    formData.append('description', editGroupData.description);
    if (newGroupData.avatar) {
      formData.append('avatar', newGroupData.avatar);
    }

    try {
      const response = await fetch(`/api/groups/${editGroupData.id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to update group');

      toast({
        title: "Success",
        description: "Group updated successfully"
      })

      setIsEditingGroup(false);
      setEditGroupData(null);
      await fetchGroups();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive"
      });
    }
  }


  const renderGroups = () => {
    if (isLoading) {
      return <p className="text-center text-muted-foreground">Loading groups...</p>;
    }

    if (!user) {
      return (
        <p className="text-center text-muted-foreground">
          Please log in to view groups.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Groups</h2>
          <Button onClick={() => setIsCreatingGroup(true)}>Create Group</Button>
        </div>

        {selectedGroup ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">{selectedGroup.name}</h3>
              <Button 
                variant="outline" 
                onClick={() => setSelectedGroup(null)}
              >
                Back to Groups
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Group Reviews</h4>
                {selectedGroupReviews.length > 0 ? (
                  <div className="space-y-4">
                    {selectedGroupReviews.map((review) => (
                      <Card key={review.id} className="border-border/80">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="space-y-1">
                                <div className="font-semibold text-base">
                                  {review.placeName ? (
                                    <button
                                      onClick={() => navigateToBusinessProfile(review.placeId)}
                                      className="hover:underline text-left"
                                    >
                                      {review.placeName}
                                    </button>
                                  ) : (
                                    <span>Unnamed location</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  by {review.username}
                                </p>
                                {review.location && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    <span>
                                      {review.location.formatted_address}
                                      {review.location.distance !== undefined && 
                                        ` • ${review.location.distance.toFixed(1)} km away`}
                                    </span>
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center mt-2">
                                {'⭐'.repeat(review.rating)}
                              </div>
                              <p className="text-sm mt-2">{review.comment}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No reviews in this group yet.</p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Group Chat</h4>
                <div className="h-[300px] overflow-y-auto space-y-2 border rounded-lg p-4">
                  {messages.map((message) => (
                    <div key={message.id} className="flex gap-2">
                      <div className="flex-1">
                        <p className="font-semibold">{message.username}</p>
                        <p>{message.content}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(message.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(selectedGroup.id);
                      }
                    }}
                  />
                  <Button
                    onClick={() => handleSendMessage(selectedGroup.id)}
                    disabled={!messageInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => (
              <Card key={group.id} className="cursor-pointer hover:bg-accent/50 transition-colors border-border/80">
                <CardContent className="p-4" onClick={() => handleGroupSelect(group)}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">{group.name}</h3>
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>Created by {group.creatorDisplayName || group.creatorUsername}</span>
                        <span>•</span>
                        <span>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</span>
                      </div>
                    </div>
                    <Button
                      variant={group.isJoined ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        group.isJoined ? handleLeaveGroup(group.id) : handleJoinGroup(group.id);
                      }}
                    >
                      {group.isJoined ? "Leave" : "Join"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderGroupCreationForm = () => {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Group Name</Label>
                <Input
                  id="name"
                  value={newGroupData.name}
                  onChange={(e) => setNewGroupData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newGroupData.description}
                  onChange={(e) => setNewGroupData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar">Group Avatar</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewGroupData(prev => ({ ...prev, avatar: file }));
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreatingGroup(false);
                    setNewGroupData({ name: '', description: '', avatar: null });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Group</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-16">
      {isCreatingGroup && renderGroupCreationForm()}
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 border-border/80"
            />
          </div>

          {searchQuery.length >= 2 && (
            <div className="space-y-2 mt-4">
              {isSearching ? (
                <p className="text-center text-muted-foreground">Searching...</p>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <Card key={user.id} className="border-border/80">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <Link href={`/users/${user.username}`}>
                            <a className="font-semibold hover:text-primary cursor-pointer">
                              {user.displayName || user.username}
                            </a>
                          </Link>
                          {user.bio && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {user.bio}
                            </p>
                          )}
                        </div>
                        <Button
                          variant={user.isFollowing ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleFollowUser(user.id)}
                        >
                          {user.isFollowing ? (
                            <>
                              <UserMinus className="h-4 w-4 mr-1" />
                              Unfollow
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-1" />
                              Follow
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground">
                  No users found
                </p>
              )}
            </div>
          )}
        </div>

        <Tabs defaultValue="community" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="community">Community</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
            <TabsTrigger value="trips">Trips</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="following">
            <div className="space-y-4">
              {renderReviews(followingReviews)}
            </div>
          </TabsContent>
          <TabsContent value="community">
            <div className="space-y-4">
              {renderReviews(reviews)}
            </div>
          </TabsContent>
          <TabsContent value="trips">
            <div className="space-y-4">
              {renderTrips()}
            </div>
          </TabsContent>
          <TabsContent value="groups">
            <div className="space-y-4">
              {renderGroups()}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
}