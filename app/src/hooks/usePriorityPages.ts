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
 * Normalize a path to match BigQuery canonical entity_id format
 * e.g., "/talent-search/all-categories" -> "talentsearchallcategories"
 */
function normalizePathToEntityId(path: string): string {
  // Remove leading slash and 'page_' prefix if present
  let normalized = path.replace(/^\//, '').replace(/^page_/, '');
  // Remove special characters, convert to lowercase
  normalized = normalized.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized;
}

/**
 * Check if a page matches priority criteria
 * @param entityId - The entity_id from opportunities (e.g., "page_talentsearchallcategories" or "/blog/article")
 * @param priorityUrls - Array of full priority URLs
 * @param priorityPrefixes - Array of URL prefixes
 * @param domain - The domain to construct full URLs
 */
export function isPriorityPage(
  entityId: string,
  priorityUrls: string[],
  priorityPrefixes: string[],
  domain: string
): boolean {
  // If no priority pages configured, return false
  if (priorityUrls.length === 0 && priorityPrefixes.length === 0) {
    return false;
  }

  if (!entityId) return false;

  // Normalize the entity_id (remove 'page_' prefix if present)
  const normalizedEntityId = entityId.replace(/^page_/, '').toLowerCase();

  // Check against priority URLs - normalize both sides for comparison
  for (const url of priorityUrls) {
    try {
      // Extract path from URL
      let urlPath = url;
      if (url.startsWith("http")) {
        const parsed = new URL(url);
        urlPath = parsed.pathname;
      }
      
      // Normalize the URL path
      const normalizedUrlPath = normalizePathToEntityId(urlPath);
      
      // Check if normalized versions match
      if (normalizedEntityId === normalizedUrlPath) {
        return true;
      }
      
      // Also check if entity_id contains the normalized path
      if (normalizedEntityId.includes(normalizedUrlPath) || normalizedUrlPath.includes(normalizedEntityId)) {
        return true;
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // Check against prefixes
  for (const prefix of priorityPrefixes) {
    const normalizedPrefix = normalizePathToEntityId(prefix);
    if (normalizedEntityId.startsWith(normalizedPrefix)) {
      return true;
    }
  }

  return false;
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
