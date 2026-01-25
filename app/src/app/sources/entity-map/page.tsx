"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import { Link2, RefreshCw, Plus, Trash2, Search, Filter } from "lucide-react";

interface EntityMapping {
  canonical_entity_id: string;
  entity_type: string;
  sources: Array<{
    source: string;
    source_entity_id: string;
    source_metadata: any;
  }>;
}

export default function EntityMapPage() {
  const { currentOrg } = useOrganization();
  const [mappings, setMappings] = useState<EntityMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (currentOrg) {
      fetchMappings();
    }
  }, [currentOrg, filter]);

  const fetchMappings = async () => {
    if (!currentOrg) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        organizationId: currentOrg.id,
        ...(filter !== "all" && { entityType: filter })
      });

      const response = await fetch(`/api/entity-map?${params}`);
      const data = await response.json();
      setMappings(data.mappings || []);
    } catch (error) {
      console.error("Error fetching mappings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedMappings = async () => {
    if (!currentOrg) return;
    
    setSeeding(true);
    try {
      const response = await fetch("/api/entity-map/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: currentOrg.id })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Successfully created ${result.total_mappings} entity mappings!\n\n` +
              `Pages: ${result.breakdown.pages}\n` +
              `Campaigns: ${result.breakdown.campaigns}\n` +
              `Keywords: ${result.breakdown.keywords}\n` +
              `Products: ${result.breakdown.products}\n` +
              `Emails: ${result.breakdown.emails}`);
        fetchMappings();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error seeding mappings:", error);
      alert("❌ Failed to seed mappings. Check console for details.");
    } finally {
      setSeeding(false);
    }
  };

  const filteredMappings = mappings.filter(mapping =>
    searchTerm === "" ||
    mapping.canonical_entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mapping.sources.some(s => 
      s.source_entity_id.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const getEntityTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      page: "bg-blue-100 text-blue-700",
      campaign: "bg-green-100 text-green-700",
      keyword: "bg-purple-100 text-purple-700",
      product: "bg-orange-100 text-orange-700",
      email: "bg-pink-100 text-pink-700"
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      ga4: "bg-blue-50 text-blue-600",
      google_ads: "bg-green-50 text-green-600",
      dataforseo: "bg-purple-50 text-purple-600",
      stripe: "bg-orange-50 text-orange-600",
      activecampaign: "bg-pink-50 text-pink-600"
    };
    return colors[source] || "bg-gray-50 text-gray-600";
  };

  return (
    <AppLayout title="Entity Mapping" subtitle="Manage cross-channel entity mappings">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Actions */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Link2 className="w-6 h-6" />
                Entity Mappings
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Link entities across different platforms for cross-channel analysis
              </p>
            </div>
            <button
              onClick={handleSeedMappings}
              disabled={seeding}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              {seeding ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Seeding...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Seed from Firestore
                </>
              )}
            </button>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {["all", "page", "campaign", "keyword", "product", "email"].map(type => {
            const count = type === "all" 
              ? mappings.length 
              : mappings.filter(m => m.entity_type === type).length;
            
            return (
              <Card key={type}>
                <div className="text-center">
                  <p className="text-3xl font-bold">{count}</p>
                  <p className="text-sm text-gray-600 capitalize">{type === "all" ? "Total" : `${type}s`}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card>
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All Types</option>
              <option value="page">Pages</option>
              <option value="campaign">Campaigns</option>
              <option value="keyword">Keywords</option>
              <option value="product">Products</option>
              <option value="email">Emails</option>
            </select>

            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search entity IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded"
              />
            </div>

            <button
              onClick={fetchMappings}
              className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </Card>

        {/* Mappings List */}
        <Card>
          <h3 className="font-semibold mb-4">Entity Mappings ({filteredMappings.length})</h3>
          
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-600 mt-2">Loading mappings...</p>
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No entity mappings found.</p>
              <p className="text-sm text-gray-500 mt-2">
                Click &quot;Seed from Firestore&quot; to create mappings from your existing data.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMappings.map((mapping, idx) => (
                <div
                  key={mapping.canonical_entity_id}
                  className="p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getEntityTypeColor(mapping.entity_type)}`}>
                          {mapping.entity_type}
                        </span>
                        <code className="text-sm font-mono">{mapping.canonical_entity_id}</code>
                      </div>

                      <div className="space-y-2">
                        {mapping.sources.map((source, sidx) => (
                          <div
                            key={sidx}
                            className="flex items-center gap-3 text-sm pl-4 border-l-2 border-gray-200"
                          >
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSourceColor(source.source)}`}>
                              {source.source}
                            </span>
                            <span className="text-gray-700">→</span>
                            <code className="text-gray-600">{source.source_entity_id}</code>
                            {source.source_metadata && typeof source.source_metadata === 'object' && (
                              <span className="text-gray-500 text-xs">
                                {JSON.stringify(source.source_metadata).slice(0, 50)}...
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
