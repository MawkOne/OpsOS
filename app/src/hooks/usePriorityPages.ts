"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface PriorityPagesData {
  priorityUrls: string[];
  priorityPrefixes: string[];
  excludePatterns: string[];
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
  const [excludePatterns, setExcludePatterns] = useState<string[]>([]);
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
          setExcludePatterns(data.excludePatterns || []);
          setDomain(data.domain || "");
        } else {
          setPriorityUrls([]);
          setPriorityPrefixes([]);
          setExcludePatterns([]);
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

  return { priorityUrls, priorityPrefixes, excludePatterns, domain, loading, error };
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
 * Check if a page should be EXCLUDED based on exclude patterns
 * @param entityId - The entity_id from opportunities
 * @param excludePatterns - Array of URL prefixes to exclude
 */
export function isExcludedPage(
  entityId: string,
  excludePatterns: string[]
): boolean {
  if (!entityId || excludePatterns.length === 0) return false;

  // Normalize the entity_id
  const normalizedEntityId = entityId.replace(/^page_/, '').toLowerCase();

  // Check against exclude patterns
  for (const pattern of excludePatterns) {
    const normalizedPattern = normalizePathToEntityId(pattern);
    if (normalizedEntityId.startsWith(normalizedPattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a page should be INCLUDED (not excluded, and optionally matches include criteria)
 * @param entityId - The entity_id from opportunities (e.g., "page_talentsearchallcategories")
 * @param priorityUrls - Array of full priority URLs (include list)
 * @param priorityPrefixes - Array of URL prefixes (include list)
 * @param excludePatterns - Array of URL prefixes to exclude
 * @param domain - The domain to construct full URLs
 */
export function isPriorityPage(
  entityId: string,
  priorityUrls: string[],
  priorityPrefixes: string[],
  domain: string,
  excludePatterns: string[] = []
): boolean {
  if (!entityId) return false;

  // First check if excluded - excluded pages are never priority
  if (isExcludedPage(entityId, excludePatterns)) {
    return false;
  }

  // If no include criteria, all non-excluded pages are included
  const hasIncludeCriteria = priorityUrls.length > 0 || priorityPrefixes.length > 0;
  if (!hasIncludeCriteria) {
    // No include list = include all (except excluded)
    return true;
  }

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
