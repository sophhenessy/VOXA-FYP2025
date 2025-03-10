import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const resetSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email"
  })
});

type ResetFormData = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const { toast } = useToast();

  const form = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: ""
    }
  });

  const onSubmit = async (data: ResetFormData) => {
    if (!data.email) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter your email address",
        duration: 5000,
      });
      return;
    }

    // Show success message immediately
    toast({
      title: "Reset Email Sent Successfully",
      description: "If an account exists with this email, you will receive password reset instructions.",
      duration: 5000,
    });

    try {
      // Make the API call after showing the toast
      await fetch('/api/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: data.email })
      });
    } catch (error) {
      console.error('Reset request error:', error);
    }

    // Reset form
    form.reset();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-[#1D84FE] mb-2">VOXA</CardTitle>
          <CardTitle className="text-xl text-center">
            Forgot Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full bg-[#1D84FE] hover:bg-[#1668C7]">
                Send Reset Link
              </Button>

              <div className="mt-4 text-center text-sm">
                <Link href="/" className="text-[#1D84FE] hover:underline inline-flex items-center">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Login
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}