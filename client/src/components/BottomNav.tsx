import { Search, Users, User, LogOut, Heart, Map } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";

export function BottomNav() {
  const [location] = useLocation();
  const { logout } = useUser();
  const { toast } = useToast();
  const [showSearch, setShowSearch] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out successfully",
        description: "See you next time!",
        duration: 3000,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        duration: 5000,
      });
    }
  };

  const navItems = [
    { icon: Map, href: "/trips", label: "My Trips" },
    { icon: Heart, href: "/likes", label: "My Likes" },
    { icon: Users, href: "/community", label: "Community" },
  ];

  return (
    <>
      <CommandDialog open={showSearch} onOpenChange={setShowSearch}>
        <CommandInput placeholder="Search places..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>Search nearby...</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border h-16 flex items-center justify-around px-4">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center text-sm ${
            location === "/"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="h-6 w-6 mb-1" />
          <span className="text-xs">Search</span>
        </Link>

        {navItems.map(({ icon: Icon, href, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center text-sm ${
              location === href
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-6 w-6 mb-1" />
            <span className="text-xs">{label}</span>
          </Link>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger className={`flex flex-col items-center justify-center text-sm ${
            location === "/profile"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}>
            <User className="h-6 w-6 mb-1" />
            <span className="text-xs">Profile</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                View Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll need to login again to access your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </>
  );
}