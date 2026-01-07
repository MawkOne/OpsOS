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
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Redirect to onboarding if no organization (except if already on onboarding, settings, or select-property)
  useEffect(() => {
    if (!authLoading && !orgLoading && user && organizations.length === 0) {
      const excludedPaths = ["/onboarding", "/settings", "/marketing/google-analytics/select-property"];
      const shouldRedirect = !excludedPaths.some(path => pathname.startsWith(path));
      if (shouldRedirect) {
        router.push("/onboarding");
      }
    }
  }, [authLoading, orgLoading, user, organizations, pathname, router]);

  // Show loading state
  if (authLoading || orgLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--background)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
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

