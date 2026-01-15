/**
 * Forecast Version Management
 * CRUD operations and utilities for versioned forecasts
 */

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ForecastVersion, ForecastComparison, ForecastAdjustment } from "@/types/forecast";
import { MasterTableEntity, getEntitiesByIds } from "./masterTableData";

/**
 * Create a new forecast version
 */
export async function createForecastVersion(
  organizationId: string,
  data: {
    name: string;
    description?: string;
    createdBy: string;
    createdByName: string;
    selectedEntityIds: string[];
    forecastMonths?: number;
    startMonth?: string;
    adjustments?: ForecastAdjustment[];
    status?: "draft" | "published";
    parentVersionId?: string;
  }
): Promise<string> {
  // Get next version number
  const versionsQuery = query(
    collection(db, "forecast_versions"),
    where("organizationId", "==", organizationId),
    orderBy("version", "desc"),
    limit(1)
  );
  const versionsSnap = await getDocs(versionsQuery);
  const latestVersion = versionsSnap.empty ? 0 : versionsSnap.docs[0].data().version;
  const nextVersion = latestVersion + 1;

  // Load entities
  const entities = await getEntitiesByIds(organizationId, data.selectedEntityIds);

  // Calculate forecast for each entity
  const now = new Date();
  const startMonth = data.startMonth || `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}`;
  const forecastMonths = data.forecastMonths || 12;

  const forecastData = entities.map(entity => {
    const { baseline, forecast, cmgr, total } = calculateEntityForecast(
      entity,
      startMonth,
      forecastMonths,
      data.adjustments?.find(a => a.entityId === entity.entityId)
    );

    return {
      entityId: entity.entityId,
      entityName: entity.entityName,
      source: entity.source,
      baseline,
      forecast,
      cmgr,
      total,
    };
  });

  // Calculate summary metrics
  const totalHistoricalRevenue = forecastData.reduce((sum, d) => {
    return sum + Object.values(d.baseline).reduce((s, v) => s + v, 0);
  }, 0);

  const totalForecastedRevenue = forecastData.reduce((sum, d) => {
    return sum + Object.values(d.forecast).reduce((s, v) => s + v, 0);
  }, 0);

  const averageMonthlyRevenue = totalForecastedRevenue / forecastMonths;
  const overallGrowthRate = totalHistoricalRevenue > 0
    ? ((totalForecastedRevenue - totalHistoricalRevenue) / totalHistoricalRevenue) * 100
    : 0;

  // If this is being published, mark all other versions as inactive
  if (data.status === "published") {
    const activeVersionsQuery = query(
      collection(db, "forecast_versions"),
      where("organizationId", "==", organizationId),
      where("isActive", "==", true)
    );
    const activeSnap = await getDocs(activeVersionsQuery);
    
    for (const doc of activeSnap.docs) {
      await updateDoc(doc.ref, { isActive: false });
    }
  }

  // Create the version
  const versionData: Omit<ForecastVersion, "id"> = {
    organizationId,
    version: nextVersion,
    name: data.name,
    description: data.description,
    createdAt: serverTimestamp() as Timestamp,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    parentVersionId: data.parentVersionId,
    status: data.status || "draft",
    isActive: data.status === "published",
    selectedEntityIds: data.selectedEntityIds,
    forecastMonths,
    startMonth,
    adjustments: data.adjustments || [],
    forecastData,
    summary: {
      totalHistoricalRevenue,
      totalForecastedRevenue,
      averageMonthlyRevenue,
      overallGrowthRate,
    },
    tags: [],
  };

  const docRef = await addDoc(collection(db, "forecast_versions"), versionData);
  return docRef.id;
}

/**
 * Calculate forecast for a single entity
 */
function calculateEntityForecast(
  entity: MasterTableEntity,
  startMonth: string,
  forecastMonths: number,
  adjustment?: ForecastAdjustment
): {
  baseline: Record<string, number>;
  forecast: Record<string, number>;
  cmgr: number;
  total: number;
} {
  const baseline = { ...entity.months };
  const forecast: Record<string, number> = {};

  // Get historical months sorted
  const monthKeys = Object.keys(entity.months).sort();
  const values = monthKeys.map(k => entity.months[k]).filter(v => v > 0);

  if (values.length < 3) {
    return { baseline, forecast: {}, cmgr: 0, total: 0 };
  }

  // Calculate CMGR
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const months = values.length - 1;
  let cmgr = months > 0 ? Math.pow(lastValue / firstValue, 1 / months) - 1 : 0;

  // Apply CMGR override if specified
  if (adjustment?.type === "cmgr_override") {
    cmgr = adjustment.value / 100; // Convert percentage to decimal
  }

  // Calculate month-over-month patterns
  const trailing12Months = monthKeys.slice(-12);
  const momPatterns: Record<string, number> = {};

  for (let i = 1; i < trailing12Months.length; i++) {
    const prevKey = trailing12Months[i - 1];
    const currKey = trailing12Months[i];
    const prevValue = entity.months[prevKey] || 0;
    const currValue = entity.months[currKey] || 0;

    if (prevValue > 0 && currValue > 0) {
      const prevMonth = parseInt(prevKey.split('-')[1]);
      const currMonth = parseInt(currKey.split('-')[1]);
      const changePercent = (currValue - prevValue) / prevValue;
      momPatterns[`${prevMonth}-${currMonth}`] = changePercent;
    }
  }

  // Generate forecast
  const [startYear, startMonthNum] = startMonth.split('-').map(Number);
  let previousValue = lastValue;
  let previousMonthNum = parseInt(monthKeys[monthKeys.length - 1].split('-')[1]);

  for (let i = 0; i < forecastMonths; i++) {
    const forecastDate = new Date(startYear, startMonthNum - 1 + i);
    const forecastKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
    const forecastMonthNum = forecastDate.getMonth() + 1;

    // Apply seasonal pattern if available
    const transitionKey = `${previousMonthNum}-${forecastMonthNum}`;
    const seasonalChange = momPatterns[transitionKey] || 0;

    let forecastValue = previousValue * (1 + seasonalChange) * (1 + cmgr);

    // Apply manual override if specified for this month
    if (adjustment?.type === "manual_override") {
      forecastValue = adjustment.value;
    }

    forecast[forecastKey] = forecastValue;
    previousValue = forecastValue;
    previousMonthNum = forecastMonthNum;
  }

  const total = Object.values(forecast).reduce((sum, v) => sum + v, 0);

  return { baseline, forecast, cmgr, total };
}

/**
 * Get all forecast versions for an organization
 */
export async function getForecastVersions(
  organizationId: string,
  options: {
    status?: "draft" | "published" | "archived";
    limit?: number;
  } = {}
): Promise<ForecastVersion[]> {
  let q = query(
    collection(db, "forecast_versions"),
    where("organizationId", "==", organizationId),
    orderBy("version", "desc")
  );

  if (options.status) {
    q = query(q, where("status", "==", options.status));
  }

  if (options.limit) {
    q = query(q, limit(options.limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ForecastVersion[];
}

/**
 * Get a specific forecast version
 */
export async function getForecastVersion(versionId: string): Promise<ForecastVersion | null> {
  const docRef = doc(db, "forecast_versions", versionId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as ForecastVersion;
}

/**
 * Get the active (published) forecast version
 */
export async function getActiveForecastVersion(organizationId: string): Promise<ForecastVersion | null> {
  const q = query(
    collection(db, "forecast_versions"),
    where("organizationId", "==", organizationId),
    where("isActive", "==", true),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  } as ForecastVersion;
}

/**
 * Publish a draft version (makes it the active version)
 */
export async function publishForecastVersion(
  versionId: string,
  organizationId: string
): Promise<void> {
  // Mark all other versions as inactive
  const activeVersionsQuery = query(
    collection(db, "forecast_versions"),
    where("organizationId", "==", organizationId),
    where("isActive", "==", true)
  );
  const activeSnap = await getDocs(activeVersionsQuery);

  for (const doc of activeSnap.docs) {
    await updateDoc(doc.ref, { isActive: false });
  }

  // Publish this version
  await updateDoc(doc(db, "forecast_versions", versionId), {
    status: "published",
    isActive: true,
  });
}

/**
 * Archive a forecast version
 */
export async function archiveForecastVersion(versionId: string): Promise<void> {
  await updateDoc(doc(db, "forecast_versions", versionId), {
    status: "archived",
    isActive: false,
  });
}

/**
 * Compare two forecast versions
 */
export async function compareForecastVersions(
  versionAId: string,
  versionBId: string
): Promise<ForecastComparison> {
  const [versionA, versionB] = await Promise.all([
    getForecastVersion(versionAId),
    getForecastVersion(versionBId),
  ]);

  if (!versionA || !versionB) {
    throw new Error("One or both versions not found");
  }

  // Compare forecast data for matching entities
  const differences = versionA.forecastData.map(entityA => {
    const entityB = versionB.forecastData.find(e => e.entityId === entityA.entityId);

    if (!entityB) {
      return {
        entityId: entityA.entityId,
        entityName: entityA.entityName,
        changeInForecast: entityA.total,
        changeInForecastPercent: 100,
        changeInCMGR: entityA.cmgr * 100,
      };
    }

    const changeInForecast = entityA.total - entityB.total;
    const changeInForecastPercent = entityB.total > 0
      ? (changeInForecast / entityB.total) * 100
      : 0;
    const changeInCMGR = (entityA.cmgr - entityB.cmgr) * 100;

    return {
      entityId: entityA.entityId,
      entityName: entityA.entityName,
      changeInForecast,
      changeInForecastPercent,
      changeInCMGR,
    };
  });

  const totalRevenueDiff = versionA.summary.totalForecastedRevenue - versionB.summary.totalForecastedRevenue;
  const totalRevenueDiffPercent = versionB.summary.totalForecastedRevenue > 0
    ? (totalRevenueDiff / versionB.summary.totalForecastedRevenue) * 100
    : 0;
  const avgMonthlyDiff = versionA.summary.averageMonthlyRevenue - versionB.summary.averageMonthlyRevenue;

  return {
    versionA,
    versionB,
    differences,
    summaryDifference: {
      totalRevenueDiff,
      totalRevenueDiffPercent,
      avgMonthlyDiff,
    },
  };
}

/**
 * Clone a forecast version (create a new draft based on existing)
 */
export async function cloneForecastVersion(
  versionId: string,
  newName: string,
  createdBy: string,
  createdByName: string
): Promise<string> {
  const original = await getForecastVersion(versionId);

  if (!original) {
    throw new Error("Version not found");
  }

  return createForecastVersion(original.organizationId, {
    name: newName,
    description: `Cloned from version ${original.version} (${original.name})`,
    createdBy,
    createdByName,
    selectedEntityIds: original.selectedEntityIds,
    forecastMonths: original.forecastMonths,
    startMonth: original.startMonth,
    adjustments: original.adjustments,
    status: "draft",
    parentVersionId: versionId,
  });
}
