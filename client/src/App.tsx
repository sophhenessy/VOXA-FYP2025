import { Switch, Route, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import MapPage from "./pages/MapPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import CommunityPage from "./pages/CommunityPage";
import GroupPage from "./pages/GroupPage";
import { useUser } from "./hooks/use-user";
import MyLikes from "./pages/MyLikes";
import TripsPage from "./pages/TripsPage";
import TripDetailPage from "./pages/TripDetailPage";
import SharedTripPage from "./pages/SharedTripPage";
import SharedProfilePage from "./pages/SharedProfilePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import BusinessProfilePage from "./pages/BusinessProfilePage";
import { BottomNav } from "./components/BottomNav";
import { useEffect } from 'react';
import { AuthProvider } from '@/hooks/use-auth';
import { ThemeProvider } from '@/hooks/use-theme';

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
      toast({
        title: "Authentication Required",
        description: "Please log in to access this page",
        variant: "destructive",
      });
    }
  }, [isLoading, user, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function App() {
  const { user, isLoading } = useUser();
  const [location] = useLocation();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if we're on a public route first
    const isPublicRoute = location === '/auth' || 
                         location.startsWith('/auth?') || 
                         location === '/reset-password' || 
                         location.startsWith('/reset-password?') ||
                         location.startsWith('/trips/shared/') ||
                         location.startsWith('/users/') ||
                         location.startsWith('/business/');

    // Only redirect if not on a public route and not authenticated
    if (!isLoading && !user && !isPublicRoute) {
      setLocation('/auth');
    }
  }, [user, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Public routes that don't require auth checks
  if (location === '/reset-password' || location.startsWith('/reset-password?')) {
    return (
      <>
        <ResetPasswordPage />
        <Toaster />
      </>
    );
  }

  if (location === '/auth' || location.startsWith('/auth?')) {
    return (
      <>
        <AuthPage />
        <Toaster />
      </>
    );
  }

  // Protected routes
  return (
    <div className="min-h-screen bg-background">
      <Switch>
        {/* Make map route protected */}
        <Route path="/" component={() => <ProtectedRoute component={MapPage} />} />
        <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
        <Route path="/likes" component={() => <ProtectedRoute component={MyLikes} />} />
        <Route path="/trips" component={() => <ProtectedRoute component={TripsPage} />} />
        <Route path="/trips/:id" component={() => <ProtectedRoute component={TripDetailPage} />} />
        <Route path="/trips/shared/:id" component={SharedTripPage} />
        <Route path="/users/:username" component={SharedProfilePage} />
        <Route path="/map/trip/:tripId" component={() => <ProtectedRoute component={MapPage} />} />
        <Route path="/community" component={() => <ProtectedRoute component={CommunityPage} />} />
        <Route path="/business/:placeId" component={BusinessProfilePage} />
        <Route path="/groups/:groupId" component={() => <ProtectedRoute component={GroupPage} />} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
      {user && <BottomNav />}
      <Toaster />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            The page you are looking for does not exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  );
}