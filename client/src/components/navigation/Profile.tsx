import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { LogOut, User } from "lucide-react";
import { useLocation } from "wouter";

export default function Profile() {
  const { user, logout } = useUser();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      // The logout function in useUser hook now handles:
      // 1. Clearing the user state
      // 2. Showing the toast
      // 3. Redirecting to /auth
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleProfile = () => {
    setLocation(`/profile/${user?.id}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleProfile}
        className="rounded-full"
      >
        <User className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        className="rounded-full"
      >
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  );
}