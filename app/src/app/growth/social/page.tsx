"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { Users, Twitter, MessageCircle, Linkedin, TrendingUp } from "lucide-react";

export default function SocialMediaPage() {
  return (
    <AppLayout 
      title="Social Media" 
      subtitle="Track performance across Twitter, Telegram, LinkedIn, and other social channels"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Twitter</span>
                <Twitter className="w-4 h-4" style={{ color: "#1DA1F2" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>14.4K</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Main account followers</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Telegram</span>
                <MessageCircle className="w-4 h-4" style={{ color: "#0088cc" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>1.5K</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Channel members</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>LinkedIn</span>
                <Linkedin className="w-4 h-4" style={{ color: "#0077B5" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>6.8K</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Followers</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Engagement</span>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>This month</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader 
            title="Social Channels" 
            subtitle="All social media accounts and performance"
            icon={<Users className="w-5 h-5" />}
          />
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Twitter</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• Main Account (~14.4K Followers)</li>
                  <li>• Spotlight Account (Automated, ~3.5K Followers)</li>
                  <li>• Feed (since 8 m. ago): 118 Followers</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Telegram</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• Channel (Automated, 1560 members)</li>
                  <li>• Bot for Notifications (1800 users)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>LinkedIn</h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>6.8K Followers</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
