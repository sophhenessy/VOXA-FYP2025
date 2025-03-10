import { z } from "zod";

export const authSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email"
  }).nonempty("Email is required"),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters"
  }).nonempty("Password is required"),
  role: z.enum(['casual', 'admin', 'business']).optional()
});

export type AuthFormData = z.infer<typeof authSchema>;

export const handleAuthError = (error: any): string => {
  if (error?.message) {
    return error.message;
  }
  return "An unexpected error occurred. Please try again.";
};