"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <CurrencyProvider>
          {children}
        </CurrencyProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
}

