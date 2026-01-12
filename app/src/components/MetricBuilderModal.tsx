"use client";

import React, { useState, useEffect } from "react";
import { X, Divide, Activity, TrendingUp, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomMetric, MetricSelector, DataSource, GAMetric } from "@/types/custom-metrics";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

interface MetricBuilderModalProps {
  organizationId: string;
  section: "marketing" | "revenue" | "leadership" | "custom";
  onClose: () => void;
  onSave?: (metric: CustomMetric) => void;
}

const dataSourceOptions = [
  { value: "google-analytics" as DataSource, label: "Google Analytics", color: "#F9AB00" },
  { value: "activecampaign" as DataSource, label: "ActiveCampaign", color: "#356AE6" },
  { value: "dataforseo" as DataSource, label: "DataForSEO", color: "#00C4CC" },
  { value: "stripe" as DataSource, label: "Stripe", color: "#635BFF" },
];

const gaMetricOptions: { value: GAMetric; label: string }[] = [
  { value: "activeUsers", label: "Users" },
  { value: "newUsers", label: "New Users" },
  { value: "sessions", label: "Sessions" },
  { value: "engagementRate", label: "Engagement Rate" },
  { value: "averageSessionDuration", label: "Avg. Session Duration" },
  { value: "eventCount", label: "Event Count" },
  { value: "conversions", label: "Conversions" },
  { value: "totalRevenue", label: "Revenue" },
];

export default function MetricBuilderModal({
  organizationId,
  section,
  onClose,
  onSave,
}: MetricBuilderModalProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewNumerator, setPreviewNumerator] = useState<number | null>(null);
  const [previewDenominator, setPreviewDenominator] = useState<number | null>(null);
  
  // Form state
  const [metricName, setMetricName] = useState("");
  const [description, setDescription] = useState("");
  
  // Numerator state
  const [numeratorSource, setNumeratorSource] = useState<DataSource>("google-analytics");
  const [numeratorType, setNumeratorType] = useState<"metric" | "event">("event");
  const [numeratorMetric, setNumeratorMetric] = useState<GAMetric>("eventCount");
  const [numeratorEvent, setNumeratorEvent] = useState("");
  const [numeratorCountry, setNumeratorCountry] = useState("");
  const [numeratorDevice, setNumeratorDevice] = useState("");
  
  // Denominator state
  const [denominatorSource, setDenominatorSource] = useState<DataSource>("google-analytics");
  const [denominatorType, setDenominatorType] = useState<"metric" | "event">("metric");
  const [denominatorMetric, setDenominatorMetric] = useState<GAMetric>("newUsers");
  const [denominatorEvent, setDenominatorEvent] = useState("");
  const [denominatorCountry, setDenominatorCountry] = useState("");
  const [denominatorDevice, setDenominatorDevice] = useState("");
  
  // Available events and filters
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [availableDevices, setAvailableDevices] = useState<string[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  
  // Fetch available filters on mount
  useEffect(() => {
    const fetchFilters = async () => {
      setLoadingFilters(true);
      try {
        const response = await fetch(
          `/api/google-analytics/filter-options?organizationId=${organizationId}`
        );
        if (response.ok) {
          const data = await response.json();
          setAvailableEvents(data.events || []);
          setAvailableCountries(data.countries || []);
          setAvailableDevices(data.devices || []);
        }
      } catch (error) {
        console.error("Error fetching filters:", error);
      } finally {
        setLoadingFilters(false);
      }
    };
    
    if (organizationId) {
      fetchFilters();
    }
  }, [organizationId]);
  
  // Fetch preview totals
  const fetchPreviewTotals = async () => {
    if (numeratorSource !== "google-analytics" || denominatorSource !== "google-analytics") {
      return;
    }
    
    if ((numeratorType === "event" && !numeratorEvent) || (denominatorType === "event" && !denominatorEvent)) {
      return;
    }
    
    setLoadingPreview(true);
    try {
      // Calculate last 30 days for preview
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const startDate = `${thirtyDaysAgo.getFullYear()}-${(thirtyDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${thirtyDaysAgo.getDate().toString().padStart(2, '0')}`;
      const endDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      
      // Build numerator selector (only include fields that have values)
      const numSelector: any = {
        source: numeratorSource,
        metricType: numeratorType,
        filters: {},
      };
      
      // Only add metric/event fields if they have actual values
      if (numeratorType === "metric" && numeratorMetric) {
        numSelector.gaMetric = numeratorMetric;
      } else if (numeratorType === "event" && numeratorEvent && numeratorEvent !== "") {
        numSelector.gaEventName = numeratorEvent;
      }
      
      // Only add filters if they have actual values
      if (numeratorCountry && numeratorCountry !== "") {
        numSelector.filters.country = numeratorCountry;
      }
      
      if (numeratorDevice && numeratorDevice !== "") {
        numSelector.filters.device = numeratorDevice;
      }
      
      // Remove filters object if it's empty
      if (Object.keys(numSelector.filters).length === 0) {
        delete numSelector.filters;
      }
      
      // Build denominator selector (only include fields that have values)
      const denSelector: any = {
        source: denominatorSource,
        metricType: denominatorType,
        filters: {},
      };
      
      // Only add metric/event fields if they have actual values
      if (denominatorType === "metric" && denominatorMetric) {
        denSelector.gaMetric = denominatorMetric;
      } else if (denominatorType === "event" && denominatorEvent && denominatorEvent !== "") {
        denSelector.gaEventName = denominatorEvent;
      }
      
      // Only add filters if they have actual values
      if (denominatorCountry && denominatorCountry !== "") {
        denSelector.filters.country = denominatorCountry;
      }
      
      if (denominatorDevice && denominatorDevice !== "") {
        denSelector.filters.device = denominatorDevice;
      }
      
      // Remove filters object if it's empty
      if (Object.keys(denSelector.filters).length === 0) {
        delete denSelector.filters;
      }
      
      // Fetch preview from API
      const response = await fetch("/api/custom-metrics/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          numerator: numSelector,
          denominator: denSelector,
          startDate,
          endDate,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreviewNumerator(data.numeratorValue || 0);
        setPreviewDenominator(data.denominatorValue || 0);
      }
    } catch (error) {
      console.error("Error fetching preview:", error);
    } finally {
      setLoadingPreview(false);
    }
  };
  
  // Fetch preview when selectors change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (numeratorSource === "google-analytics" && denominatorSource === "google-analytics") {
        fetchPreviewTotals();
      }
    }, 500); // Debounce
    
    return () => clearTimeout(timeoutId);
  }, [
    numeratorSource, numeratorType, numeratorMetric, numeratorEvent, numeratorCountry, numeratorDevice,
    denominatorSource, denominatorType, denominatorMetric, denominatorEvent, denominatorCountry, denominatorDevice
  ]);
  
  const handleSave = async () => {
    if (!metricName.trim() || !user) {
      console.log("Cannot save: missing name or user", { metricName, user });
      return;
    }
    
    setSaving(true);
    try {
      // Build numerator (only include fields that have values)
      const numerator: any = {
        source: numeratorSource,
        metricType: numeratorType,
        filters: {},
      };
      
      // Only add metric/event fields if they have actual values
      if (numeratorType === "metric" && numeratorMetric) {
        numerator.gaMetric = numeratorMetric;
      } else if (numeratorType === "event" && numeratorEvent && numeratorEvent !== "") {
        numerator.gaEventName = numeratorEvent;
      }
      
      // Only add filters if they have actual values
      if (numeratorCountry && numeratorCountry !== "") {
        numerator.filters.country = numeratorCountry;
      }
      
      if (numeratorDevice && numeratorDevice !== "") {
        numerator.filters.device = numeratorDevice;
      }
      
      // Remove filters object if it's empty
      if (Object.keys(numerator.filters).length === 0) {
        delete numerator.filters;
      }
      
      // Build denominator (only include fields that have values)
      const denominator: any = {
        source: denominatorSource,
        metricType: denominatorType,
        filters: {},
      };
      
      // Only add metric/event fields if they have actual values
      if (denominatorType === "metric" && denominatorMetric) {
        denominator.gaMetric = denominatorMetric;
      } else if (denominatorType === "event" && denominatorEvent && denominatorEvent !== "") {
        denominator.gaEventName = denominatorEvent;
      }
      
      // Only add filters if they have actual values
      if (denominatorCountry && denominatorCountry !== "") {
        denominator.filters.country = denominatorCountry;
      }
      
      if (denominatorDevice && denominatorDevice !== "") {
        denominator.filters.device = denominatorDevice;
      }
      
      // Remove filters object if it's empty
      if (Object.keys(denominator.filters).length === 0) {
        delete denominator.filters;
      }
      
      const metricData: any = {
        organizationId,
        name: metricName,
        section,
        numerator,
        denominator,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Only add description if it's not empty (Firestore doesn't allow undefined)
      if (description && description.trim()) {
        metricData.description = description.trim();
      }
      
      console.log("Saving metric data:", metricData);
      console.log("Numerator object:", JSON.stringify(numerator, null, 2));
      console.log("Denominator object:", JSON.stringify(denominator, null, 2));
      
      const docRef = await addDoc(collection(db, "custom_metrics"), metricData);
      
      console.log("Metric saved with ID:", docRef.id);
      
      if (onSave) {
        onSave({ ...metricData, id: docRef.id } as any);
      }
      
      onClose();
    } catch (error) {
      console.error("Error saving metric:", error);
      alert("Error saving metric: " + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  
  const getDisplayLabel = (selector: { type: "metric" | "event"; metric?: GAMetric; event?: string; source: DataSource }) => {
    if (selector.source !== "google-analytics") return selector.source;
    if (selector.type === "event" && selector.event) return `Event: ${selector.event}`;
    if (selector.type === "metric" && selector.metric) {
      const option = gaMetricOptions.find(o => o.value === selector.metric);
      return option?.label || selector.metric;
    }
    return "Select...";
  };
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0, 0, 0, 0.5)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
          style={{ background: "var(--background)" }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between p-6 border-b"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
          >
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                Create Conversion Metric
              </h2>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                Build a custom metric by selecting a numerator and denominator
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--background-secondary)] transition-colors"
            >
              <X className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Metric Name & Description */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  Metric Name
                </label>
                <input
                  type="text"
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  placeholder="e.g., Visit to Trial Conversion"
                  className="w-full px-4 py-2 rounded-lg"
                  style={{
                    background: "var(--background-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Percentage of new visitors who sign up for trial"
                  className="w-full px-4 py-2 rounded-lg"
                  style={{
                    background: "var(--background-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            </div>
            
            {/* Formula Builder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Numerator (Top) */}
              <div
                className="p-5 rounded-lg border-2"
                style={{ 
                  background: "var(--background-secondary)",
                  borderColor: "#10b981",
                }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5" style={{ color: "#10b981" }} />
                  <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                    Numerator (What you're counting)
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {/* Data Source */}
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                      Data Source
                    </label>
                    <select
                      value={numeratorSource}
                      onChange={(e) => setNumeratorSource(e.target.value as DataSource)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    >
                      {dataSourceOptions.map((source) => (
                        <option key={source.value} value={source.value}>
                          {source.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Type Selector (Metric vs Event) */}
                  {numeratorSource === "google-analytics" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                          Type
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setNumeratorType("metric")}
                            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: numeratorType === "metric" ? "var(--accent)" : "var(--background)",
                              color: numeratorType === "metric" ? "#ffffff" : "var(--foreground-muted)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            Metric
                          </button>
                          <button
                            onClick={() => setNumeratorType("event")}
                            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: numeratorType === "event" ? "var(--accent)" : "var(--background)",
                              color: numeratorType === "event" ? "#ffffff" : "var(--foreground-muted)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            Event
                          </button>
                        </div>
                      </div>
                      
                      {/* Metric/Event Selector */}
                      {numeratorType === "metric" ? (
                        <div>
                          <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                            Metric
                          </label>
                          <select
                            value={numeratorMetric}
                            onChange={(e) => setNumeratorMetric(e.target.value as GAMetric)}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                            }}
                          >
                            {gaMetricOptions.map((metric) => (
                              <option key={metric.value} value={metric.value}>
                                {metric.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                            Event Name
                          </label>
                          <select
                            value={numeratorEvent}
                            onChange={(e) => setNumeratorEvent(e.target.value)}
                            disabled={loadingFilters}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                            }}
                          >
                            <option value="">Select event...</option>
                            {availableEvents.map((event) => (
                              <option key={event} value={event}>
                                {event}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {/* Filters */}
                      <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                          Filters (Optional)
                        </label>
                        <div className="space-y-2">
                          <select
                            value={numeratorCountry}
                            onChange={(e) => setNumeratorCountry(e.target.value)}
                            disabled={loadingFilters}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                            }}
                          >
                            <option value="">All Countries</option>
                            {availableCountries.map((country) => (
                              <option key={country} value={country}>
                                {country}
                              </option>
                            ))}
                          </select>
                          
                          <select
                            value={numeratorDevice}
                            onChange={(e) => setNumeratorDevice(e.target.value)}
                            disabled={loadingFilters}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                            }}
                          >
                            <option value="">All Devices</option>
                            {availableDevices.map((device) => (
                              <option key={device} value={device}>
                                {device.charAt(0).toUpperCase() + device.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Denominator (Bottom) */}
              <div
                className="p-5 rounded-lg border-2"
                style={{ 
                  background: "var(--background-secondary)",
                  borderColor: "#3b82f6",
                }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5" style={{ color: "#3b82f6" }} />
                  <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                    Denominator (Total universe)
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {/* Data Source */}
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                      Data Source
                    </label>
                    <select
                      value={denominatorSource}
                      onChange={(e) => setDenominatorSource(e.target.value as DataSource)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    >
                      {dataSourceOptions.map((source) => (
                        <option key={source.value} value={source.value}>
                          {source.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Type Selector (Metric vs Event) */}
                  {denominatorSource === "google-analytics" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                          Type
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDenominatorType("metric")}
                            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: denominatorType === "metric" ? "var(--accent)" : "var(--background)",
                              color: denominatorType === "metric" ? "#ffffff" : "var(--foreground-muted)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            Metric
                          </button>
                          <button
                            onClick={() => setDenominatorType("event")}
                            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: denominatorType === "event" ? "var(--accent)" : "var(--background)",
                              color: denominatorType === "event" ? "#ffffff" : "var(--foreground-muted)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            Event
                          </button>
                        </div>
                      </div>
                      
                      {/* Metric/Event Selector */}
                      {denominatorType === "metric" ? (
                        <div>
                          <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                            Metric
                          </label>
                          <select
                            value={denominatorMetric}
                            onChange={(e) => setDenominatorMetric(e.target.value as GAMetric)}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                            }}
                          >
                            {gaMetricOptions.map((metric) => (
                              <option key={metric.value} value={metric.value}>
                                {metric.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                            Event Name
                          </label>
                          <select
                            value={denominatorEvent}
                            onChange={(e) => setDenominatorEvent(e.target.value)}
                            disabled={loadingFilters}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                            }}
                          >
                            <option value="">Select event...</option>
                            {availableEvents.map((event) => (
                              <option key={event} value={event}>
                                {event}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {/* Filters */}
                      <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
                          Filters (Optional)
                        </label>
                        <div className="space-y-2">
                          <select
                            value={denominatorCountry}
                            onChange={(e) => setDenominatorCountry(e.target.value)}
                            disabled={loadingFilters}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                            }}
                          >
                            <option value="">All Countries</option>
                            {availableCountries.map((country) => (
                              <option key={country} value={country}>
                                {country}
                              </option>
                            ))}
                          </select>
                          
                          <select
                            value={denominatorDevice}
                            onChange={(e) => setDenominatorDevice(e.target.value)}
                            disabled={loadingFilters}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              color: "var(--foreground)",
                            }}
                          >
                            <option value="">All Devices</option>
                            {availableDevices.map((device) => (
                              <option key={device} value={device}>
                                {device.charAt(0).toUpperCase() + device.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Formula Preview */}
            <div
              className="p-6 rounded-lg border"
              style={{ 
                background: "var(--background-secondary)",
                borderColor: "var(--border)",
              }}
            >
              <div className="text-xs font-medium mb-3" style={{ color: "var(--foreground-muted)" }}>
                Preview (Last 30 Days)
              </div>
              
              <div className="flex items-center justify-center gap-4">
                {/* Numerator */}
                <div className="text-center">
                  <div className="text-xs font-medium mb-1" style={{ color: "#10b981" }}>
                    {getDisplayLabel({ 
                      type: numeratorType, 
                      metric: numeratorMetric, 
                      event: numeratorEvent,
                      source: numeratorSource,
                    })}
                  </div>
                  {loadingPreview ? (
                    <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>...</div>
                  ) : previewNumerator !== null ? (
                    <div className="text-lg font-bold" style={{ color: "#10b981" }}>
                      {previewNumerator.toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>-</div>
                  )}
                </div>
                
                <Divide className="w-6 h-6" style={{ color: "var(--foreground-muted)" }} />
                
                {/* Denominator */}
                <div className="text-center">
                  <div className="text-xs font-medium mb-1" style={{ color: "#3b82f6" }}>
                    {getDisplayLabel({ 
                      type: denominatorType, 
                      metric: denominatorMetric, 
                      event: denominatorEvent,
                      source: denominatorSource,
                    })}
                  </div>
                  {loadingPreview ? (
                    <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>...</div>
                  ) : previewDenominator !== null ? (
                    <div className="text-lg font-bold" style={{ color: "#3b82f6" }}>
                      {previewDenominator.toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>-</div>
                  )}
                </div>
                
                {/* Result */}
                <div className="text-center">
                  <div className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    = Conversion Rate
                  </div>
                  {loadingPreview ? (
                    <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>...</div>
                  ) : previewNumerator !== null && previewDenominator !== null && previewDenominator > 0 ? (
                    <div className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
                      {((previewNumerator / previewDenominator) * 100).toFixed(2)}%
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: "var(--foreground-muted)" }}>-</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div
            className="sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: "var(--background-secondary)",
                color: "var(--foreground-muted)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !metricName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#ffffff",
              }}
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Create Metric"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

