"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { organizations, loading: orgLoading } = useOrganization();

  useEffect(() => {
    // Wait for auth and org context to load
    if (authLoading || orgLoading) return;

    // If authenticated and has org, go directly to growth metrics
    if (user && organizations.length > 0) {
      router.replace("/growth/metrics");
    } 
    // If authenticated but no org, go to onboarding
    else if (user && organizations.length === 0) {
      router.replace("/onboarding");
    }
    // If not authenticated, go to login
    else {
      router.replace("/login");
    }
  }, [user, organizations, authLoading, orgLoading, router]);

  // Show loading while redirecting
  return (
    <div 
      className="min-h-screen flex items-center justify-center" 
      style={{ 
        background: "linear-gradient(135deg, #0a0f1a 0%, #0d1520 50%, #0a1628 100%)",
      }}
    >
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#00d4aa]" />
        <p className="text-sm text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}
