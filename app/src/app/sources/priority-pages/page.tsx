"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { 
  Loader2, 
  Plus, 
  XCircle, 
  TrendingUp, 
  Eye, 
  Clock,
  AlertCircle,
  ExternalLink,
  Settings,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";

interface PageData {
  id: string;
  name: string;
  months: Record<string, {
    pageviews: number;
    sessions: number;
    avgTimeOnPage: number;
  }>;
}

interface PageWithStats extends PageData {
  totalPageviews: number;
  totalSessions: number;
  avgTimeOnPage: number;
}

export default function PriorityPagesPage() {
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<PageWithStats[]>([]);
  const [priorityUrls, setPriorityUrls] = useState<string[]>([]);
  const [domain, setDomain] = useState<string>("");
  const [pageLimit, setPageLimit] = useState(50);
  const [saving, setSaving] = useState(false);

  // Load priority URLs and domain from Firestore
  useEffect(() => {
    if (!currentOrg?.id) return;

    const connectionRef = doc(db, "dataforseo_connections", currentOrg.id);
    const unsubscribe = onSnapshot(connectionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.priorityUrls) {
          setPriorityUrls(data.priorityUrls);
        }
        if (data.domain) {
          setDomain(data.domain);
        }
      }
    });

    return () => unsubscribe();
  }, [currentOrg?.id]);

  // Fetch Google Analytics pages
  useEffect(() => {
    if (!currentOrg?.id) return;

    const fetchPages = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/google-analytics/pages?organizationId=${currentOrg.id}&viewMode=ttm`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch page data");
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        // Calculate totals and averages for each page
        const pagesWithStats: PageWithStats[] = data.pages.map((page: PageData) => {
          const monthValues = Object.values(page.months);
          const totalPageviews = monthValues.reduce((sum, m) => sum + m.pageviews, 0);
          const totalSessions = monthValues.reduce((sum, m) => sum + m.sessions, 0);
          const avgTime = monthValues.reduce((sum, m) => sum + m.avgTimeOnPage, 0) / monthValues.length;

          return {
            ...page,
            totalPageviews,
            totalSessions,
            avgTimeOnPage: avgTime,
          };
        });

        // Sort by total pageviews descending
        pagesWithStats.sort((a, b) => b.totalPageviews - a.totalPageviews);

        setPages(pagesWithStats);
      } catch (err: any) {
        console.error("Error fetching pages:", err);
        setError(err.message || "Failed to load pages");
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [currentOrg?.id, pageLimit]);

  const handleAddPriorityPage = async (pagePath: string) => {
    if (!currentOrg?.id || !domain) return;

    // Construct full URL
    const fullUrl = domain.startsWith("http") 
      ? `${domain}${pagePath}`
      : `https://${domain}${pagePath}`;

    // Check if we already have 20 URLs (DataForSEO limit)
    if (priorityUrls.length >= 20) {
      setError("Maximum 20 priority URLs allowed");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Check if URL already exists
    if (priorityUrls.includes(fullUrl)) {
      setError("This page is already in the priority list");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const updatedUrls = [...priorityUrls, fullUrl];
    setPriorityUrls(updatedUrls);

    // Save to Firestore
    setSaving(true);
    try {
      const connectionRef = doc(db, "dataforseo_connections", currentOrg.id);
      await setDoc(connectionRef, {
        priorityUrls: updatedUrls,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch (err) {
      console.error("Error saving priority URLs:", err);
      setError("Failed to save priority URL");
      // Revert on error
      setPriorityUrls(priorityUrls);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePriorityUrl = async (urlToRemove: string) => {
    if (!currentOrg?.id) return;

    const updatedUrls = priorityUrls.filter(url => url !== urlToRemove);
    setPriorityUrls(updatedUrls);

    // Save to Firestore
    setSaving(true);
    try {
      const connectionRef = doc(db, "dataforseo_connections", currentOrg.id);
      await setDoc(connectionRef, {
        priorityUrls: updatedUrls,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    } catch (err) {
      console.error("Error saving priority URLs:", err);
      setError("Failed to remove priority URL");
      // Revert on error
      setPriorityUrls([...priorityUrls, urlToRemove]);
    } finally {
      setSaving(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isPriorityPage = (pagePath: string) => {
    const fullUrl = domain.startsWith("http") 
      ? `${domain}${pagePath}`
      : `https://${domain}${pagePath}`;
    return priorityUrls.includes(fullUrl);
  };

  return (
    <div className="min-h-screen p-8" style={{ background: "var(--background)" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-8 h-8" style={{ color: "var(--primary)" }} />
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
              Priority Pages
            </h1>
          </div>
          <p className="text-lg" style={{ color: "var(--foreground-muted)" }}>
            Select your most important pages for deeper SEO analysis
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl flex items-start gap-3"
            style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)" }}
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-500">Error</p>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Selected Priority Pages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-6 mb-6"
          style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Selected Priority Pages
              </h2>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                These pages will be crawled first with deeper analysis. Max 20 URLs.
              </p>
            </div>
            <span 
              className="text-sm font-medium px-3 py-1 rounded-full" 
              style={{ 
                background: priorityUrls.length >= 20 ? "rgba(239, 68, 68, 0.1)" : "rgba(37, 99, 235, 0.1)",
                color: priorityUrls.length >= 20 ? "#ef4444" : "#2563eb"
              }}
            >
              {priorityUrls.length} / 20
            </span>
          </div>

          {priorityUrls.length > 0 ? (
            <div className="space-y-2">
              {priorityUrls.map((url, index) => (
                <motion.div
                  key={url}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: "var(--background-tertiary)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: "var(--foreground-muted)" }} />
                    <span className="text-sm truncate" style={{ color: "var(--foreground)" }}>
                      {url}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemovePriorityUrl(url)}
                    disabled={saving}
                    className="ml-3 p-1.5 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Remove"
                  >
                    <XCircle className="w-4 h-4 text-red-500" />
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: "var(--foreground-muted)" }}>
              <Target className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No priority pages selected yet</p>
              <p className="text-xs mt-1">Click the + icon next to any page below to add it</p>
            </div>
          )}
        </motion.div>

        {/* All Pages Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
        >
          {/* Table Header */}
          <div className="p-6 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  All Pages (Trailing 12 Months)
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                  Sorted by total traffic
                </p>
              </div>
              
              {/* Page Limit Selector */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                  Show:
                </label>
                <select
                  value={pageLimit}
                  onChange={(e) => setPageLimit(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--background-tertiary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value={25}>25 pages</option>
                  <option value={50}>50 pages</option>
                  <option value={100}>100 pages</option>
                  <option value={200}>200 pages</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-20" style={{ color: "var(--foreground-muted)" }}>
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No page data available</p>
              <p className="text-xs mt-1">Make sure Google Analytics is connected and has data</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ maxHeight: "600px", overflowY: "auto" }}>
                <table className="w-full">
                  <thead className="sticky top-0" style={{ background: "var(--background-tertiary)" }}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                        
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                        Page Path
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                        <div className="flex items-center justify-end gap-1">
                          <Eye className="w-3 h-3" />
                          Pageviews
                        </div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                        <div className="flex items-center justify-end gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Sessions
                        </div>
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          Avg Time
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.slice(0, pageLimit).map((page, index) => {
                      const isSelected = isPriorityPage(page.name);
                      return (
                        <motion.tr
                          key={page.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="border-t transition-colors"
                          style={{ 
                            borderColor: "var(--border)",
                            background: isSelected ? "rgba(37, 99, 235, 0.05)" : "transparent"
                          }}
                        >
                          <td className="px-6 py-4">
                            {isSelected ? (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
                                <Target className="w-4 h-4 text-green-500" />
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddPriorityPage(page.name)}
                                disabled={saving || priorityUrls.length >= 20}
                                className="flex items-center justify-center w-8 h-8 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                style={{ 
                                  background: "var(--background-tertiary)",
                                  border: "1px solid var(--border)"
                                }}
                                title="Add to priority pages"
                              >
                                <Plus className="w-4 h-4" style={{ color: "var(--foreground)" }} />
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                              {page.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                              {formatNumber(page.totalPageviews)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                              {formatNumber(page.totalSessions)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                              {formatDuration(page.avgTimeOnPage)}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
