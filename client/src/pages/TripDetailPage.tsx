import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { MapPin, Calendar, ArrowLeft, Trash2, Sparkles, Plus, Share2, Globe, Lock } from "lucide-react";
import { Link, useLocation } from "wouter";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useState } from 'react';

interface Trip {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isPublic: boolean;
  createdAt: string;
}

interface TripPlace {
  id: number;
  tripId: number;
  placeId: string;
  placeName: string;
  placeAddress: string | null;
  visitDate: string | null;
  notes: string | null;
}

interface AddPlaceForm {
  placeName: string;
  placeAddress: string;
  visitDate: string;
  notes: string;
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const form = useForm<AddPlaceForm>({
    defaultValues: {
      placeName: "",
      placeAddress: "",
      visitDate: "",
      notes: ""
    }
  });

  const addPlaceMutation = useMutation({
    mutationFn: async (data: AddPlaceForm) => {
      const response = await fetch(`/api/trips/${id}/places`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          placeId: Date.now().toString(),
          ...data
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${id}/places`] });
      setShowAddPlace(false);
      form.reset();
      toast({
        title: "Place Added",
        description: "The place has been added to your trip successfully.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add place",
      });
    },
  });

  const { data: trip, isLoading } = useQuery<Trip>({
    queryKey: [`/api/trips/${id}`],
  });

  const { data: places = [] } = useQuery<TripPlace[]>({
    queryKey: [`/api/trips/${id}/places`],
    enabled: !!id,
  });

  const deleteTripMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/trips/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Trip Deleted",
        description: "Your trip has been deleted successfully.",
      });
      setLocation('/trips');
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete trip",
      });
    },
  });

  const suggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/trips/${id}/suggestions`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: (data) => {
      setShowSuggestions(true);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate suggestions",
      });
    },
  });

  // Toggle trip visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: async (isPublic: boolean) => {
      const response = await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isPublic }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${id}`] });
      toast({
        title: "Trip Updated",
        description: "Trip visibility has been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update trip visibility",
      });
    },
  });

  const handleShare = async () => {
    if (!trip) return;

    try {
      const shareUrl = `${window.location.origin}/trips/shared/${id}`;
      if (navigator.share) {
        await navigator.share({
          title: trip.name,
          text: `Check out my trip to ${trip.name}!`,
          url: shareUrl
        });
        toast({
          title: "Shared Successfully",
          description: "The trip has been shared.",
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied",
          description: "The trip link has been copied to your clipboard.",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to share the trip",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <MapPin className="w-6 h-6 text-primary animate-pulse" />
          <h1 className="text-2xl font-bold">Loading trip details...</h1>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <MapPin className="w-6 h-6 text-destructive" />
          <h1 className="text-2xl font-bold">Trip not found</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/trips">Back to Trips</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/trips" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Trips
          </Link>
        </Button>
        <div className="flex gap-2">
          <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Share2 className="w-4 h-4 mr-2" />
                Share Trip
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share Trip</DialogTitle>
                <DialogDescription>
                  Control who can see your trip and share it with others
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Trip Visibility</Label>
                    <div className="text-sm text-muted-foreground">
                      {trip?.isPublic ? (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Public - Anyone with the link can view
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4" />
                          Private - Only you can view
                        </div>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={trip?.isPublic}
                    onCheckedChange={(checked) => toggleVisibilityMutation.mutate(checked)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shareable Link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={`${window.location.origin}/trips/shared/${id}`} />
                    <Button onClick={handleShare}>Share</Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setShowShareDialog(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showAddPlace} onOpenChange={setShowAddPlace}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Place
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Place</DialogTitle>
                <DialogDescription>
                  Add a new place to your trip itinerary.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => addPlaceMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="placeName"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Place Name</Label>
                        <FormControl>
                          <Input {...field} placeholder="Enter place name" required />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="placeAddress"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Address</Label>
                        <FormControl>
                          <Input {...field} placeholder="Enter address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="visitDate"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Visit Date</Label>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Notes</Label>
                        <FormControl>
                          <Textarea {...field} placeholder="Add any notes about this place" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={addPlaceMutation.isPending}>
                    {addPlaceMutation.isPending ? "Adding..." : "Add Place"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={() => suggestionsMutation.mutate()}
            disabled={suggestionsMutation.isPending || places.length === 0}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Get AI Suggestions
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Trip
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your trip
                  and remove all places associated with it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteTripMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{trip.name}</h1>
          {trip.description && (
            <p className="mt-2 text-muted-foreground">{trip.description}</p>
          )}
          {(trip.startDate || trip.endDate) && (
            <div className="flex items-center mt-4 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 mr-2" />
              <span>
                {trip.startDate && format(new Date(trip.startDate), 'MMM d, yyyy')}
                {trip.endDate && ' - '}
                {trip.endDate && format(new Date(trip.endDate), 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Places</h2>
            {places.length > 0 ? (
              places.map((place: any) => (
                <Card key={place.id} className="p-4">
                  <div className="space-y-2">
                    <h3 className="font-medium">{place.placeName}</h3>
                    {place.placeAddress && (
                      <p className="text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        {place.placeAddress}
                      </p>
                    )}
                    {place.notes && (
                      <p className="text-sm mt-2">{place.notes}</p>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  No places added to this trip yet.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/map/trip/${id}`)}
                  className="mx-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Search and Add Places
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>AI-Generated Trip Suggestions</DialogTitle>
            <DialogDescription>
              Here's a suggested itinerary based on your saved places
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="mt-4 h-full max-h-[60vh]">
            {suggestionsMutation.data?.suggestions ? (
              <div className="space-y-4 dark:text-white">
                <div 
                  className="space-y-4"
                  dangerouslySetInnerHTML={{
                    __html: suggestionsMutation.data.suggestions
                      .replace(/\n\n/g, '<br/><br/>')
                      .replace(/Day \d+:/g, (match: string) => `<h2 class="text-2xl font-bold mt-6 dark:text-white">${match}</h2>`)
                      .replace(/^(Morning|Afternoon|Evening|Late Morning|Lunch|Dinner):/gm, (match: string) => `<h3 class="text-base font-semibold mt-4 dark:text-white">${match}</h3>`)
                      .replace(/^Travel tip:/gm, (match: string) => `<p class="italic mt-4 text-muted-foreground dark:text-gray-300">${match}</p>`)
                      .replace(/^[•-]\s(.*)/gm, (match: string) => `<li class="ml-4 dark:text-white text-base">${match.substring(2)}</li>`)
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">
                  {suggestionsMutation.isPending ? 'Generating suggestions...' : 'No suggestions available'}
                </p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}