"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card, { CardHeader, StatCard } from "@/components/Card";
import { Search, TrendingUp, TrendingDown, Target, Minus, ArrowUp, ArrowDown, Link as LinkIcon } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface KeywordData {
  keyword: string;
  date: string;
  position: number;
  position_change: number | null;
  search_volume: number;
  cpc: number;
  competition: number;
}

interface DistributionData {
  position_tier: string;
  keyword_count: number;
}

interface StatsData {
  total_keywords: number;
  keywords_top_10: number;
  keywords_top_3: number;
  keywords_striking_distance: number;
  avg_position: number;
  total_search_volume: number;
}

interface BacklinkData {
  date: string;
  backlinks_total: number;
  backlinks_change: number;
  domain_rank: number;
}

interface MoverData {
  keyword: string;
  current_position: number;
  old_position: number;
  position_change: number;
  search_volume: number;
}

const todayISO = () => new Date().toISOString().split("T")[0];
const daysAgoISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
};

export default function SEOPage() {
  const [startDate, setStartDate] = useState(daysAgoISO(30));
  const [endDate, setEndDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [distribution, setDistribution] = useState<DistributionData[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkData[]>([]);
  const [movers, setMovers] = useState<MoverData[]>([]);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/bigquery/seo-keywords?startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();
      
      setKeywords(data.keywords || []);
      setDistribution(data.distribution || []);
      setStats(data.stats || null);
      setBacklinks(data.backlinks || []);
      setMovers(data.movers || []);
    } catch (error) {
      console.error("Error fetching SEO data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "0";
    return new Intl.NumberFormat().format(Math.round(num));
  };

  const formatCurrency = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "$0.00";
    return `$${num.toFixed(2)}`;
  };

  const formatPercent = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "0%";
    return `${(num * 100).toFixed(1)}%`;
  };

  const getPositionChangeIcon = (change: number | null) => {
    if (!change || change === 0) return <Minus className="w-4 h-4 text-gray-400" />;
    if (change > 0) return <ArrowDown className="w-4 h-4 text-red-500" />; // Down is bad (higher number)
    return <ArrowUp className="w-4 h-4 text-green-500" />; // Up is good (lower number)
  };

  const getPositionBadge = (position: number) => {
    if (position <= 3) return "🥇";
    if (position <= 10) return "🎯";
    if (position <= 20) return "📍";
    return "";
  };

  const topRankings = keywords.filter(k => k.position <= 10);
  const strikingDistance = keywords.filter(k => k.position >= 11 && k.position <= 20);
  const winners = movers.filter(m => m.position_change < 0).slice(0, 5); // Negative is good (lower position)
  const losers = movers.filter(m => m.position_change > 0).slice(0, 5); // Positive is bad (higher position)

  return (
    <AppLayout title="SEO Performance">
      <div className="p-6 max-w-[1600px] mx-auto">

        {/* Date Range Selector */}
        <Card>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setStartDate(daysAgoISO(30));
                setEndDate(todayISO());
              }}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: startDate === daysAgoISO(30) ? "var(--accent)" : "var(--background-tertiary)",
                color: startDate === daysAgoISO(30) ? "var(--background)" : "var(--foreground-muted)",
              }}
            >
              Last 30d
            </button>
            <button
              onClick={() => {
                setStartDate(daysAgoISO(90));
                setEndDate(todayISO());
              }}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: startDate === daysAgoISO(90) ? "var(--accent)" : "var(--background-tertiary)",
                color: startDate === daysAgoISO(90) ? "var(--background)" : "var(--foreground-muted)",
              }}
            >
              Last 90d
            </button>
          </div>
        </Card>

        {loading ? (
          <div className="mt-6 text-center" style={{ color: "var(--foreground-muted)" }}>
            Loading SEO data...
          </div>
        ) : (
          <>
            {/* Overview KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <StatCard
                icon={<Search className="w-5 h-5" />}
                label="Total Keywords"
                value={formatNumber(stats?.total_keywords)}
                change="Keywords tracked"
                changeType="neutral"
              />

              <StatCard
                icon={<Target className="w-5 h-5" />}
                label="Top 10 Rankings"
                value={formatNumber(stats?.keywords_top_10)}
                change={`${stats?.keywords_top_3 || 0} in top 3`}
                changeType="neutral"
              />

              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Avg Position"
                value={stats?.avg_position ? stats.avg_position.toFixed(1) : "0"}
                change="Across all keywords"
                changeType="neutral"
              />

              <StatCard
                icon={<LinkIcon className="w-5 h-5" />}
                label="Backlinks"
                value={formatNumber(backlinks[0]?.backlinks_total)}
                change={`Domain rank: ${backlinks[0]?.domain_rank?.toFixed(0) || 0}`}
                changeType="neutral"
              />
            </div>

            {/* Top Rankings Table */}
            <Card className="mt-6">
              <CardHeader
                icon={<TrendingUp className="w-5 h-5" />}
                title="Top Rankings"
                subtitle={`${topRankings.length} keywords in positions 1-10`}
              />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid var(--border)` }}>
                      <th className="text-left p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Rank</th>
                      <th className="text-left p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Keyword</th>
                      <th className="text-center p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Position</th>
                      <th className="text-center p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Change</th>
                      <th className="text-right p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Monthly Searches</th>
                      <th className="text-right p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRankings.slice(0, 15).map((kw, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span>{getPositionBadge(kw.position)}</span>
                            <span className="text-sm font-medium">#{idx + 1}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-medium">{kw.keyword}</span>
                        </td>
                        <td className="text-center p-3">
                          <span className="px-2 py-1 rounded text-sm font-medium" style={{ background: "var(--background-tertiary)" }}>
                            #{Math.round(kw.position)}
                          </span>
                        </td>
                        <td className="text-center p-3">
                          <div className="flex items-center justify-center gap-1">
                            {getPositionChangeIcon(kw.position_change)}
                            {kw.position_change && kw.position_change !== 0 && (
                              <span className="text-sm">{Math.abs(Math.round(kw.position_change))}</span>
                            )}
                          </div>
                        </td>
                        <td className="text-right p-3 text-sm">
                          {formatNumber(kw.search_volume)}/mo
                        </td>
                        <td className="text-right p-3 text-sm">
                          {formatCurrency(kw.cpc)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Striking Distance Table */}
            {strikingDistance.length > 0 && (
              <Card className="mt-6">
                <CardHeader
                  icon={<Target className="w-5 h-5" />}
                  title="Striking Distance Keywords"
                  subtitle={`${strikingDistance.length} keywords in positions 11-20 (page 2)`}
                />
                <div className="mb-4 p-3 rounded" style={{ background: "var(--background-tertiary)" }}>
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    🎯 These keywords are on page 2 - small optimizations could push them to page 1!
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: `1px solid var(--border)` }}>
                        <th className="text-left p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Keyword</th>
                        <th className="text-center p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Position</th>
                        <th className="text-center p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Change</th>
                        <th className="text-right p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Monthly Searches</th>
                        <th className="text-left p-3 text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Opportunity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strikingDistance.slice(0, 10).map((kw, idx) => {
                        const estimatedCurrentTraffic = Math.round(kw.search_volume * 0.05);
                        const estimatedTop10Traffic = Math.round(kw.search_volume * 0.15);
                        const potentialGain = estimatedTop10Traffic - estimatedCurrentTraffic;

                        return (
                          <tr key={idx} style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                            <td className="p-3">
                              <span className="font-medium">{kw.keyword}</span>
                            </td>
                            <td className="text-center p-3">
                              <span className="px-2 py-1 rounded text-sm font-medium" style={{ background: "var(--background-tertiary)" }}>
                                #{Math.round(kw.position)}
                              </span>
                            </td>
                            <td className="text-center p-3">
                              <div className="flex items-center justify-center gap-1">
                                {getPositionChangeIcon(kw.position_change)}
                                {kw.position_change && kw.position_change !== 0 && (
                                  <span className="text-sm">{Math.abs(Math.round(kw.position_change))}</span>
                                )}
                              </div>
                            </td>
                            <td className="text-right p-3 text-sm">
                              {formatNumber(kw.search_volume)}/mo
                            </td>
                            <td className="p-3 text-sm" style={{ color: "var(--foreground-muted)" }}>
                              +{formatNumber(potentialGain)} visits if moved to #10
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Biggest Movers */}
            {movers.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Winners */}
                {winners.length > 0 && (
                  <Card>
                    <CardHeader
                      icon={<TrendingUp className="w-5 h-5 text-green-500" />}
                      title="Biggest Winners"
                      subtitle="Keywords that improved rankings"
                    />
                    <div className="space-y-3">
                      {winners.map((mover, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded"
                          style={{ background: "var(--background-tertiary)" }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{mover.keyword}</div>
                              <div className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                                {formatNumber(mover.search_volume)} searches/month
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2 text-green-500 font-medium">
                                <ArrowUp className="w-4 h-4" />
                                {Math.abs(mover.position_change)} positions
                              </div>
                              <div className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                                #{Math.round(mover.old_position)} → #{Math.round(mover.current_position)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Losers */}
                {losers.length > 0 && (
                  <Card>
                    <CardHeader
                      icon={<TrendingDown className="w-5 h-5 text-red-500" />}
                      title="Biggest Losers"
                      subtitle="Keywords that dropped rankings"
                    />
                    <div className="space-y-3">
                      {losers.map((mover, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded"
                          style={{ background: "var(--background-tertiary)" }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{mover.keyword}</div>
                              <div className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                                {formatNumber(mover.search_volume)} searches/month
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2 text-red-500 font-medium">
                                <ArrowDown className="w-4 h-4" />
                                {Math.abs(mover.position_change)} positions
                              </div>
                              <div className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                                #{Math.round(mover.old_position)} → #{Math.round(mover.current_position)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Backlink Trend */}
            {backlinks.length > 0 && (
              <Card className="mt-6">
                <CardHeader
                  icon={<LinkIcon className="w-5 h-5" />}
                  title="Backlink Trend"
                  subtitle={`${formatNumber(backlinks[0]?.backlinks_total)} total backlinks`}
                />
                <div style={{ height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...backlinks].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        stroke="var(--foreground-muted)"
                        tick={{ fill: "var(--foreground-muted)" }}
                      />
                      <YAxis
                        stroke="var(--foreground-muted)"
                        tick={{ fill: "var(--foreground-muted)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--background-secondary)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="backlinks_total"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={{ fill: "var(--accent)" }}
                        name="Backlinks"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
