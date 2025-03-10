import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { CalendarIcon, MapPin, Plus, Edit } from "lucide-react";
import { format } from "date-fns";

interface Trip {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isPublic: boolean;
  locationName?: string;
  locationLat?: string;
  locationLng?: string;
  createdAt: string;
}

export default function TripsPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTripId, setEditTripId] = useState<number | null>(null);
  const [editTripName, setEditTripName] = useState("");
  const [editTripDescription, setEditTripDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ['/api/trips', user?.id],
    queryFn: async () => {
      try {
        console.log('Fetching trips for user:', user?.id);
        const response = await fetch('/api/trips', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch trips');
        }

        const data = await response.json();
        console.log('Fetched trips:', data);
        return data;
      } catch (error) {
        console.error('Error fetching trips:', error);
        throw error;
      }
    },
    enabled: !!user
  });

  const createTripMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description'),
          startDate: formData.get('startDate'),
          endDate: formData.get('endDate'),
          isPublic: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create trip');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips', user?.id] });
      setIsCreateOpen(false);
      toast({
        title: "Success",
        description: "Trip created successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create trip",
      });
    },
  });

  const editTripMutation = useMutation({
    mutationFn: async () => {
      if (!editTripId) return;

      const response = await fetch(`/api/trips/${editTripId}`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/trips', user?.id] });
      setIsEditOpen(false);
      setEditTripId(null);
      toast({
        title: "Success",
        description: "Trip updated successfully",
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

  const handleEditTrip = (trip: Trip) => {
    setEditTripId(trip.id);
    setEditTripName(trip.name);
    setEditTripDescription(trip.description || '');
    setEditStartDate(trip.startDate || '');
    setEditEndDate(trip.endDate || '');
    setIsEditOpen(true);
  };

  if (!user) {
    return (
      <div className="h-screen w-full relative bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Please Log In</h2>
          <p className="text-muted-foreground">You need to be logged in to view and create trips.</p>
          <Link href="/auth">
            <Button>Log In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <MapPin className="w-6 h-6 text-primary animate-pulse" />
          <h1 className="text-2xl font-bold">Loading your trips...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MapPin className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">My Trips</h1>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Trip
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Trip</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                createTripMutation.mutate(new FormData(form));
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Trip Name</Label>
                <Input id="name" name="name" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" name="startDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" name="endDate" type="date" />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={createTripMutation.isPending}
              >
                {createTripMutation.isPending ? "Creating..." : "Create Trip"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        {trips.length > 0 ? (
          <div className="space-y-4">
            {trips.map((trip) => (
              <Card key={trip.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h3 className="font-medium text-lg">{trip.name}</h3>
                    {trip.description && (
                      <p className="text-sm text-muted-foreground">{trip.description}</p>
                    )}
                    {trip.locationName && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mr-1" />
                        <span>{trip.locationName}</span>
                      </div>
                    )}
                    {(trip.startDate || trip.endDate) && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        <span>
                          {trip.startDate && format(new Date(trip.startDate), 'MMM d, yyyy')}
                          {trip.endDate && ' - '}
                          {trip.endDate && format(new Date(trip.endDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditTrip(trip)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/trips/${trip.id}`}>View Details</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">No trips yet. Create one to start planning!</p>
          </div>
        )}
      </ScrollArea>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Trip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Trip Name</Label>
              <Input
                id="editName"
                value={editTripName}
                onChange={(e) => setEditTripName(e.target.value)}
                placeholder="Enter trip name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editTripDescription}
                onChange={(e) => setEditTripDescription(e.target.value)}
                placeholder="Enter trip description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStartDate">Start Date</Label>
              <Input
                id="editStartDate"
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEndDate">End Date</Label>
              <Input
                id="editEndDate"
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
              />
            </div>
            <Button
              onClick={() => editTripMutation.mutate()}
              disabled={!editTripName || editTripMutation.isPending}
              className="w-full"
            >
              {editTripMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}