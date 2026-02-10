"use client";

import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { PieChart } from "lucide-react";

export default function LeadershipHealthPage() {
  return (
    <AppLayout title="Company Health" subtitle="Executive health and balance metrics">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PieChart className="w-12 h-12 mb-4" style={{ color: "var(--foreground-muted)" }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              Company Health
            </h3>
            <p className="text-sm max-w-md" style={{ color: "var(--foreground-muted)" }}>
              Health and balance metrics will be available here. Use the Metrics page for daily, weekly, and monthly performance data.
            </p>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
