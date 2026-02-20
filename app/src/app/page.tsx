"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page
    router.replace("/login");
  }, [router]);

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
