import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { authSchema, type AuthFormData } from "@/lib/auth-validation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { PasswordStrengthIndicator } from "../components/PasswordStrengthIndicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState<'casual' | 'admin' | 'business'>('casual');
  const { toast } = useToast();
  const { login, register, user } = useUser();
  const [, setLocation] = useLocation();

  // Handle redirection when user is authenticated
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const form = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "casual"
    }
  });

  const onSubmit = async (data: AuthFormData) => {
    try {
      setIsSubmitting(true);
      form.clearErrors();

      if (isLogin) {
        await login({
          email: data.email,
          password: data.password
        });
        toast({
          title: "Login successful",
          description: "Welcome back!",
          duration: 3000,
        });
      } else {
        await register({
          email: data.email,
          password: data.password,
          role
        });
        toast({
          title: "Registration successful",
          description: "Your account has been created.",
          duration: 3000,
        });
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        variant: "destructive",
        title: isLogin ? "Login failed" : "Registration failed",
        description: error.message || "Please check your credentials and try again",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md mx-4 p-6 bg-card rounded-lg shadow-lg">
        <div className="flex flex-col items-center pt-8 mb-12">
          <h2 className="text-xl font-semibold text-center">
            {isLogin ? "Login" : "Sign Up"}
          </h2>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Email" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Password" 
                        {...field} 
                      />
                      <button
                        type="button"
                        className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  {!isLogin && <PasswordStrengthIndicator password={field.value} />}
                </FormItem>
              )}
            />

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="role">Account Type</Label>
                <Select
                  value={role}
                  onValueChange={(value: 'casual' | 'admin' | 'business') => setRole(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual User</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="business">Business Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? "Logging in..." : "Signing up..."}
                </span>
              ) : (
                isLogin ? "Login" : "Sign Up"
              )}
            </Button>
          </form>
        </Form>

        {isLogin ? (
          <div className="mt-4 text-center text-sm">
            <p>
              Don't have an account?{" "}
              <button
                onClick={() => setIsLogin(false)}
                className="text-primary hover:underline"
              >
                Sign Up
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-4 text-center text-sm">
            <p>
              Already have an account?{" "}
              <button
                onClick={() => setIsLogin(true)}
                className="text-primary hover:underline"
              >
                Login
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}