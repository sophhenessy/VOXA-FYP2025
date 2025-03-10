import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function HomePage() {
  const { user, logout } = useUser();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/auth'; // Force redirect to auth page after logout
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // If user is not logged in, show auth prompt
  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Welcome to VOXA!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center mb-6 text-muted-foreground">
              Please log in or sign up to start exploring places and planning trips.
            </p>
            <Button asChild className="w-full">
              <Link href="/auth">Log In / Sign Up</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome {user.username}!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center mb-6 text-muted-foreground">
            You have successfully logged in to your account.
          </p>
          <Button 
            onClick={handleLogout}
            className="w-full"
            variant="outline"
          >
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}