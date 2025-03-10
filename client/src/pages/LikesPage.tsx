
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { Heart, MapPin, Trash2 } from 'lucide-react';

interface Like {
  id: number;
  placeId: string;
  placeName: string;
  placeAddress: string;
}

export default function LikesPage() {
  const [likes, setLikes] = useState<Like[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      fetchLikes();
    }
  }, [user]);

  const fetchLikes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/likes', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch likes');
      }

      const data = await response.json();
      setLikes(data);
    } catch (error) {
      console.error('Error fetching likes:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load liked places. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlike = async (placeId: string) => {
    try {
      const response = await fetch(`/api/likes/${placeId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to unlike place');
      }

      setLikes(likes.filter(like => like.placeId !== placeId));
      toast({
        title: "Success",
        description: "Place removed from likes",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to unlike place. Please try again.",
      });
    }
  };

  if (!user) {
    return (
      <div className="h-screen w-full relative bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Please Log In</h2>
          <p className="text-muted-foreground">You need to be logged in to view your liked places.</p>
          <Link href="/auth">
            <Button>Log In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative bg-background">
      <div className="container max-w-2xl mx-auto p-4 pb-20">
        <div className="flex items-center gap-2 mb-6">
          <Heart className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">My Liked Places</h1>
        </div>

        {isLoading ? (
          <div className="text-center py-4">
            <p>Loading your liked places...</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-200px)]">
            {likes.length > 0 ? (
              <div className="space-y-4">
                {likes.map((like) => (
                  <Card key={like.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <h3 className="font-medium text-lg">{like.placeName}</h3>
                        <div className="flex items-center text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-1" />
                          <p className="text-sm">{like.placeAddress}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleUnlike(like.placeId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">No liked places yet</p>
                <Link href="/">
                  <Button>
                    Explore Places
                  </Button>
                </Link>
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
