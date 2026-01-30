"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { motion } from "framer-motion";
import {
  Megaphone,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Loader2,
  DollarSign,
  MousePointerClick,
  Target,
  TrendingUp,
  BarChart3,
  Key,
  Building2,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

interface GoogleAdsCustomer {
  id: string;
  descriptiveName: string;
  resourceName?: string;
  currencyCode?: string;
  timeZone?: string;
  manager?: boolean;
}

interface GoogleAdsConnection {
  status: 'connected' | 'pending_config' | 'not_connected';
  customerId?: string;
  customerName?: string;
  userEmail?: string;
  lastSyncAt?: string;
}

interface AccountMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  conversionRate: number;
  currency?: string;
}

function GoogleAdsContent() {
  const { currentOrg } = useOrganization();
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<GoogleAdsConnection | null>(null);
  const [metrics, setMetrics] = useState<AccountMetrics | null>(null);
  const [customers, setCustomers] = useState<GoogleAdsCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Configuration form
  const [developerToken, setDeveloperToken] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showConfigForm, setShowConfigForm] = useState(false);

  const organizationId = currentOrg?.id || "";

  // Check for URL params from OAuth callback
  useEffect(() => {
    const status = searchParams.get("status");
    const email = searchParams.get("email");
    const errorParam = searchParams.get("error");

    if (status === "oauth_complete") {
      setSuccess(`OAuth complete for ${email}. Now enter your Developer Token.`);
      setShowConfigForm(true);
      window.history.replaceState({}, "", "/sources/google-ads");
    }

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, "", "/sources/google-ads");
    }
  }, [searchParams]);

  // Check connection status
  useEffect(() => {
    if (!organizationId) return;

    const checkStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/google-ads/configure?organizationId=${organizationId}`);
        const data = await response.json();
        
        setConnection({
          status: data.status,
          customerId: data.customerId,
          customerName: data.customerName,
          userEmail: data.userEmail,
          lastSyncAt: data.lastSyncAt,
        });

        if (data.status === 'pending_config') {
          setShowConfigForm(true);
        }

        // If connected, fetch metrics
        if (data.status === 'connected') {
          fetchMetrics();
        }
      } catch (err) {
        console.error('Error checking status:', err);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/google-ads/sync?organizationId=${organizationId}`);
      const data = await response.json();
      
      if (data.hasData && data.accountMetrics) {
        setMetrics(data.accountMetrics);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  const handleConnect = () => {
    if (!organizationId) {
      setError("No organization selected");
      return;
    }
    window.location.href = `/api/google-ads/auth?organizationId=${organizationId}`;
  };

  const handleConfigure = async () => {
    if (!developerToken) {
      setError("Please enter your Developer Token");
      return;
    }

    setIsConfiguring(true);
    setError(null);

    try {
      // First, validate token and get customer list
      const response = await fetch('/api/google-ads/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          developerToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Configuration failed');
      }

      if (data.status === 'select_customer') {
        setCustomers(data.customers || []);
        setSuccess('Developer token validated! Now select your account.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration failed');
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleSelectCustomer = async () => {
    if (!selectedCustomerId) {
      setError("Please select an account");
      return;
    }

    setIsConfiguring(true);
    setError(null);

    try {
      const response = await fetch('/api/google-ads/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          developerToken,
          customerId: selectedCustomerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect account');
      }

      setConnection({
        status: 'connected',
        customerId: data.customer.id,
        customerName: data.customer.descriptiveName,
      });
      setShowConfigForm(false);
      setCustomers([]);
      setSuccess('Google Ads connected successfully!');
      
      // Trigger initial sync
      handleSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      // Call Cloud Function directly - syncs from Google Ads API to BigQuery (bypasses Firestore)
      console.log("Syncing Google Ads data directly to BigQuery...");
      const response = await fetch("https://us-central1-opsos-864a1.cloudfunctions.net/google-ads-bigquery-sync", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Sync failed');
      }

      setSuccess(`Synced ${data.campaigns_processed || 0} campaigns, ${data.daily_records || 0} daily records to BigQuery.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Ads?')) return;

    try {
      await fetch('/api/google-ads/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      setConnection({ status: 'not_connected' });
      setMetrics(null);
      setSuccess('Google Ads disconnected.');
    } catch (err) {
      setError('Failed to disconnect');
    }
  };

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  if (loading) {
    return (
      <AppLayout title="Google Ads" subtitle="Connect your advertising data">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Google Ads" subtitle="Connect your advertising data">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Messages */}
        {error && (
          <div className="p-4 rounded-lg flex items-center gap-3" style={{ background: "#ef444420", border: "1px solid #ef4444" }}>
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500">×</button>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-lg flex items-center gap-3" style={{ background: "#10b98120", border: "1px solid #10b981" }}>
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className="text-sm" style={{ color: "#10b981" }}>{success}</p>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-500">×</button>
          </div>
        )}

        {/* Connection Status Card */}
        <Card>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "#4285f420" }}>
                <Megaphone className="w-6 h-6" style={{ color: "#4285f4" }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>Google Ads</h2>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  {connection?.status === 'connected' 
                    ? `Connected: ${connection.customerName}` 
                    : connection?.status === 'pending_config'
                    ? 'OAuth complete - configure below'
                    : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connection?.status === 'connected' ? (
                <>
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
                    style={{ background: "#4285F4", color: "white" }}
                    title="Sync Google Ads data directly to BigQuery"
                  >
                    {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {isSyncing ? 'Syncing to BigQuery...' : 'Sync to BigQuery'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="p-2 rounded-lg hover:bg-red-50"
                    style={{ color: "#ef4444" }}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              ) : connection?.status !== 'pending_config' ? (
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
                  style={{ background: "var(--accent)", color: "var(--background)" }}
                >
                  Connect Google Ads
                </button>
              ) : null}
            </div>
          </div>
        </Card>

        {/* Configuration Form */}
        {showConfigForm && connection?.status !== 'connected' && (
          <Card>
            <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>Configure Google Ads Connection</h3>
            
            <div className="space-y-4">
              {/* Developer Token Input */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  <Key className="w-4 h-4 inline mr-2" />
                  Developer Token
                </label>
                <input
                  type="text"
                  value={developerToken}
                  onChange={(e) => setDeveloperToken(e.target.value)}
                  placeholder="Enter your Google Ads Developer Token"
                  className="w-full px-4 py-2 rounded-lg border"
                  style={{ 
                    background: "var(--background)", 
                    border: "1px solid var(--border)",
                    color: "var(--foreground)"
                  }}
                />
                <p className="text-xs mt-1" style={{ color: "var(--foreground-muted)" }}>
                  Get this from{" "}
                  <a 
                    href="https://ads.google.com/aw/apicenter" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Google Ads API Center <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </p>
              </div>

              {/* Customer Selection (if available) */}
              {customers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    <Building2 className="w-4 h-4 inline mr-2" />
                    Select Account
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border"
                    style={{ 
                      background: "var(--background)", 
                      border: "1px solid var(--border)",
                      color: "var(--foreground)"
                    }}
                  >
                    <option value="">Select an account...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.descriptiveName} ({customer.id})
                        {customer.manager ? ' [Manager]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {customers.length === 0 ? (
                  <button
                    onClick={handleConfigure}
                    disabled={isConfiguring || !developerToken}
                    className="px-4 py-2 rounded-lg flex items-center gap-2 font-medium disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--background)" }}
                  >
                    {isConfiguring ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Validate Token
                  </button>
                ) : (
                  <button
                    onClick={handleSelectCustomer}
                    disabled={isConfiguring || !selectedCustomerId}
                    className="px-4 py-2 rounded-lg flex items-center gap-2 font-medium disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--background)" }}
                  >
                    {isConfiguring ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Connect Account
                  </button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Metrics Display */}
        {metrics && connection?.status === 'connected' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Total Spend</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatCurrency(metrics.totalSpend, metrics.currency)}
                </p>
              </Card>

              <Card>
                <div className="flex items-center gap-3 mb-2">
                  <MousePointerClick className="w-5 h-5 text-blue-500" />
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Clicks</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalClicks)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {formatPercent(metrics.ctr)} CTR
                </p>
              </Card>

              <Card>
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Conversions</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                  {formatNumber(metrics.totalConversions)}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {formatCurrency(metrics.cpa, metrics.currency)} CPA
                </p>
              </Card>

              <Card>
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>ROAS</span>
                </div>
                <p className="text-2xl font-bold" style={{ color: metrics.roas >= 3 ? "#10b981" : metrics.roas >= 1 ? "#f59e0b" : "#ef4444" }}>
                  {metrics.roas.toFixed(2)}x
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {formatCurrency(metrics.totalConversionValue, metrics.currency)} value
                </p>
              </Card>
            </div>

            <Card>
              <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>Additional Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Impressions</p>
                  <p className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    {formatNumber(metrics.totalImpressions)}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Avg CPC</p>
                  <p className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    {formatCurrency(metrics.cpc, metrics.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Conv. Rate</p>
                  <p className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    {formatPercent(metrics.conversionRate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Conv. Value</p>
                  <p className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                    {formatCurrency(metrics.totalConversionValue, metrics.currency)}
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Setup Instructions */}
        {connection?.status !== 'connected' && !showConfigForm && (
          <Card>
            <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>Setup Instructions</h3>
            <ol className="space-y-3 text-sm" style={{ color: "var(--foreground-muted)" }}>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "var(--background)" }}>1</span>
                <span>Click "Connect Google Ads" to authenticate with your Google account</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "var(--background)" }}>2</span>
                <span>
                  Get your Developer Token from{" "}
                  <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--accent)" }}>
                    Google Ads API Center
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "var(--background)" }}>3</span>
                <span>Enter your Developer Token and select the account to connect</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--accent)", color: "var(--background)" }}>4</span>
                <span>Click "Sync Data" to import your campaign performance</span>
              </li>
            </ol>
          </Card>
        )}

        {/* What You'll Get */}
        <Card>
          <h3 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>What You'll Get</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Campaign Performance</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Spend, clicks, conversions by campaign</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>ROAS & CPA</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Return on ad spend, cost per acquisition</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <div>
                <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>90-Day Trends</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Historical performance over time</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Conversion Tracking</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Conversions and conversion value</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function GoogleAdsPage() {
  return (
    <Suspense fallback={
      <AppLayout title="Google Ads" subtitle="Connect your advertising data">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      </AppLayout>
    }>
      <GoogleAdsContent />
    </Suspense>
  );
}
