import { Progress } from "@/components/ui/progress";
import { useMemo } from "react";

export type PasswordStrength = {
  score: number;
  message: string;
  color: string;
};

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, message: "", color: "bg-gray-200" };
  }

  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isLongEnough = password.length >= 8;

  const checks = [hasLowerCase, hasUpperCase, hasNumber, hasSpecialChar, isLongEnough];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  if (score <= 20) {
    return { score, message: "Very Weak", color: "bg-destructive" };
  } else if (score <= 40) {
    return { score, message: "Weak", color: "bg-orange-500" };
  } else if (score <= 60) {
    return { score, message: "Fair", color: "bg-yellow-500" };
  } else if (score <= 80) {
    return { score, message: "Good", color: "bg-primary" };
  } else {
    return { score, message: "Strong", color: "bg-green-500" };
  }
}

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  if (!password) {
    return null;
  }

  return (
    <div className="w-full space-y-2 mt-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Password Strength:</span>
        <span className={`font-medium ${strength.score <= 40 ? 'text-destructive' : ''}`}>
          {strength.message}
        </span>
      </div>
      <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full ${strength.color} transition-all duration-300`}
          style={{ width: `${strength.score}%` }}
        />
      </div>
    </div>
  );
}
