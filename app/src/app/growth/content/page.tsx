"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { Lightbulb, FileText, Users, TrendingUp, Eye } from "lucide-react";

export default function ContentPage() {
  return (
    <AppLayout 
      title="Content Marketing" 
      subtitle="Track performance across blog posts, UGC, dynamic pages, and on-product content"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Blog Posts</span>
                <FileText className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Published this month</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>UGC Content</span>
                <Users className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>7.5K</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Talent stories recorded</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Dynamic Pages</span>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Active pages</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Views</span>
                <Eye className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>This month</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader 
            title="Content Channels" 
            subtitle="Performance across all content types"
            icon={<Lightbulb className="w-5 h-5" />}
          />
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>On-Product (UGC)</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• Talent Stories (7.5K recorded)</li>
                  <li>• Hire Professionals Lists</li>
                  <li>• Placement Stories</li>
                  <li>• Talent Reviews</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Dynamic Pages</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• Monthly Recap Pages (3K users listed in Dec 2025)</li>
                  <li>• Salary Lists</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Blog Posts</h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Track blog performance and engagement</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
