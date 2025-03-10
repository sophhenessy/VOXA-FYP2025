import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Reviews } from "@/components/Reviews";
import { ArrowLeft, Search, Send, Edit, Trash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Group {
  id: number;
  name: string;
  description: string | null;
  creatorUsername: string;
  creatorDisplayName: string | null;
  memberCount: number;
  isAdmin: boolean;
}

interface Message {
  id: number;
  content: string;
  createdAt: string;
  username: string;
  avatarUrl: string | null;
}

interface Place {
  placeId: string;
  name: string;
  formattedAddress: string;
}

export default function GroupPage() {
  const { groupId } = useParams();
  const { toast } = useToast();
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{
    name: string;
    description: string;
  }>({ name: '', description: '' });

  const { data: group } = useQuery<Group>({
    queryKey: ["/api/groups", groupId],
    enabled: !!groupId,
  });

  const { data: members = [] } = useQuery<{ username: string }[]>({
    queryKey: ["/api/groups", groupId, "members"],
    enabled: !!groupId,
  });

  useEffect(() => {
    if (group && !editData.name) {
      setEditData({
        name: group.name,
        description: group.description || '',
      });
    }
  }, [group]);

  useEffect(() => {
    if (!groupId) return;
    fetchMessages();
  }, [groupId]);

  const fetchMessages = async () => {
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

  const handleSendMessage = async () => {
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
      await fetchMessages();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(`/api/places/search?query=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to search places');
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search places",
        variant: "destructive"
      });
    }
  };

  const handleAddReview = (place: Place) => {
    setSelectedPlace(place);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleUpdateGroup = async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });

      if (!response.ok) throw new Error('Failed to update group');

      toast({
        title: "Success",
        description: "Group updated successfully"
      });

      // Refresh group data
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update group",
        variant: "destructive"
      });
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to delete group');

      toast({
        title: "Success",
        description: "Group deleted successfully"
      });

      setLocation('/community');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete group",
        variant: "destructive"
      });
    }
  };

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto p-4">
          <Button variant="outline" asChild className="mb-6">
            <Link href="/community">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Community
            </Link>
          </Button>
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-4">
        <Button variant="outline" asChild className="mb-6">
          <Link href="/community">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Community
          </Link>
        </Button>

        <div className="space-y-8">
          <Card>
            <CardContent className="p-6">
              {!isEditing ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-4">
                      <h1 className="text-3xl font-bold">{group.name}</h1>
                      <p className="text-lg text-muted-foreground">{group.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Created by {group.creatorDisplayName || group.creatorUsername}</span>
                        <span>•</span>
                        <span>{members.length} members</span>
                      </div>
                    </div>
                    {group.isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Group
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteGroup}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete Group
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Group Name</Label>
                    <Input
                      id="name"
                      value={editData.name}
                      onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={editData.description}
                      onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateGroup}>Save Changes</Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Members</h2>
              <div className="flex flex-wrap gap-2">
                {members.map((member, index) => (
                  <div key={index} className="px-3 py-1 bg-secondary rounded-full text-sm">
                    {member.username}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Add Review</h2>
                {selectedPlace && (
                  <Button variant="outline" onClick={() => setSelectedPlace(null)}>Cancel</Button>
                )}
              </div>
              {!selectedPlace ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search for a place to review..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch();
                        }
                      }}
                    />
                    <Button onClick={handleSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {searchResults.map((place) => (
                        <button
                          key={place.placeId}
                          className="w-full p-3 text-left hover:bg-accent/50 transition-colors"
                          onClick={() => handleAddReview(place)}
                        >
                          <div className="font-medium">{place.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {place.formattedAddress}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h3 className="font-medium mb-4">{selectedPlace.name}</h3>
                  <Reviews
                    placeId={selectedPlace.placeId}
                    placeName={selectedPlace.name}
                    groupId={parseInt(groupId!)}
                    showGroupSelection={false}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Group Chat</h2>
              <div className="space-y-4">
                <div className="h-[300px] overflow-y-auto space-y-4 mb-4">
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
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}