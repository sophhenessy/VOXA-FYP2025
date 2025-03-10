import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InsertUser, SelectUser } from "@db/schema";

type LoginResponse = {
  message: string;
  user?: {
    id: number;
    username: string;
  };
};

async function handleAuthRequest(
  url: string,
  method: string,
  body?: InsertUser
): Promise<LoginResponse> {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Authentication failed');
  }

  return response.json();
}

async function fetchCurrentUser(): Promise<SelectUser | null> {
  try {
    const response = await fetch('/api/user', {
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error('Failed to fetch user');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export function useUser() {
  const queryClient = useQueryClient();

  const { data: user, error, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    retry: false
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const response = await handleAuthRequest('/api/login', 'POST', credentials);
      return response.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['currentUser'], user);
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const response = await handleAuthRequest('/api/register', 'POST', userData);
      return response.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['currentUser'], user);
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await handleAuthRequest('/api/logout', 'POST');
      queryClient.setQueryData(['currentUser'], null);
    }
  });

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync
  };
}