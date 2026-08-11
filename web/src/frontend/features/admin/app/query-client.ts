"use client";
import { QueryClient } from "@tanstack/react-query";

export function createAdminQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 0,
        retry: false,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
