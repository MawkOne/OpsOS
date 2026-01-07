"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { organizations, currentOrg, loading: orgLoading } = useOrganization();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      // Use window.location for more reliable redirect
      window.location.href = "/login";
    }
  }, [authLoading, user]);

  // Redirect to onboarding if no organization (except if already on onboarding, settings, or select-property)
  useEffect(() => {
    if (!authLoading && !orgLoading && user && organizations.length === 0) {
      const excludedPaths = ["/onboarding", "/settings", "/marketing/google-analytics/select-property"];
      const shouldRedirect = !excludedPaths.some(path => pathname.startsWith(path));
      if (shouldRedirect) {
        window.location.href = "/onboarding";
      }
    }
  }, [authLoading, orgLoading, user, organizations, pathname]);

  // Show loading state
  if (authLoading || orgLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--background)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  // Don't render if not authenticated - show redirect message
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4" style={{ background: "var(--background)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        <p style={{ color: "var(--foreground-muted)" }}>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden gradient-mesh">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

