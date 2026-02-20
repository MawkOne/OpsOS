"use client";

import AppLayout from "@/components/AppLayout";
import Card, { CardHeader } from "@/components/Card";
import { Mail, Send, Users, TrendingUp } from "lucide-react";

export default function EmailMarketingPage() {
  return (
    <AppLayout 
      title="Email Marketing" 
      subtitle="Track email campaigns, automation sequences, and engagement metrics"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Contacts</span>
                <Users className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Total active</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Campaigns</span>
                <Send className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>This month</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Open Rate</span>
                <Mail className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Average</p>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Traffic</span>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>--</p>
              <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>Email referral sessions</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader 
            title="Email Campaigns" 
            subtitle="Marketing campaigns vs automation sequences"
            icon={<Mail className="w-5 h-5" />}
          />
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Routing Types</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• <strong>Transactional:</strong> Account notifications, confirmations</li>
                  <li>• <strong>Monthly Recap:</strong> Personalized performance summaries (talents)</li>
                  <li>• <strong>Occasional:</strong> Promotional campaigns</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Campaign Types</h3>
                <ul className="space-y-2 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <li>• <strong>Marketing Campaigns:</strong> Manual broadcasts (status=5)</li>
                  <li>• <strong>Automation:</strong> Triggered sequences (status=1)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>Search Campaigns</h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Targeted campaigns via channels</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
