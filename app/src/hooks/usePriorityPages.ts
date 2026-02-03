"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface PriorityPagesData {
  priorityUrls: string[];
  priorityPrefixes: string[];
  domain: string;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and manage priority pages from Firestore
 * Priority pages are stored in the dataforseo_connections collection
 */
export function usePriorityPages(organizationId: string | undefined): PriorityPagesData {
  const [priorityUrls, setPriorityUrls] = useState<string[]>([]);
  const [priorityPrefixes, setPriorityPrefixes] = useState<string[]>([]);
  const [domain, setDomain] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const connectionRef = doc(db, "dataforseo_connections", organizationId);
    const unsubscribe = onSnapshot(
      connectionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPriorityUrls(data.priorityUrls || []);
          setPriorityPrefixes(data.priorityPrefixes || []);
          setDomain(data.domain || "");
        } else {
          setPriorityUrls([]);
          setPriorityPrefixes([]);
          setDomain("");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching priority pages:", err);
        setError("Failed to load priority pages");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [organizationId]);

  return { priorityUrls, priorityPrefixes, domain, loading, error };
}

/**
 * Check if a page matches priority criteria
 * @param pagePath - The page path (e.g., "/blog/article" or full URL)
 * @param priorityUrls - Array of full priority URLs
 * @param priorityPrefixes - Array of URL prefixes
 * @param domain - The domain to construct full URLs
 */
export function isPriorityPage(
  pagePath: string,
  priorityUrls: string[],
  priorityPrefixes: string[],
  domain: string
): boolean {
  // If no priority pages configured, return false
  if (priorityUrls.length === 0 && priorityPrefixes.length === 0) {
    return false;
  }

  // Extract path from entity_id (could be full URL or just path)
  let path = pagePath;
  try {
    if (pagePath.startsWith("http")) {
      const url = new URL(pagePath);
      path = url.pathname;
    }
  } catch {
    // Keep original path if URL parsing fails
  }

  // Construct full URL for comparison
  const fullUrl = domain.startsWith("http")
    ? `${domain}${path}`
    : `https://${domain}${path}`;

  // Check if exact URL is in priority list
  if (priorityUrls.includes(fullUrl)) {
    return true;
  }

  // Also check if the pagePath itself is in priority URLs (for full URL entity_ids)
  if (priorityUrls.includes(pagePath)) {
    return true;
  }

  // Check if page path matches any prefix
  return priorityPrefixes.some((prefix) => path.startsWith(prefix));
}

/**
 * Get the count of priority pages from a list of opportunities
 */
export function countPriorityOpportunities(
  opportunities: Array<{ entity_id: string; entity_type: string }>,
  priorityUrls: string[],
  priorityPrefixes: string[],
  domain: string
): number {
  return opportunities.filter((opp) => {
    if (opp.entity_type !== "page") return false;
    return isPriorityPage(opp.entity_id, priorityUrls, priorityPrefixes, domain);
  }).length;
}
