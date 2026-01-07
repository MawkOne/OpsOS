"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrganizationProvider>
        {children}
      </OrganizationProvider>
    </AuthProvider>
  );
}

