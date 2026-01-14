"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Card from "@/components/Card";
import PriorityModal from "@/components/PriorityModal";
import { motion } from "framer-motion";
import {
  Target,
  TrendingUp,
  Users,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Minus,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
} from "firebase/firestore";

interface Priority {
  id?: string;
  title: string;
  whatsImportant: string;
  howAreWeDoing: {
    status: "on-track" | "at-risk" | "needs-attention";
    description: string;
    trend: "up" | "down" | "stable";
  };
  prioritiesToImprove: string[];
  category: "growth" | "efficiency" | "risk" | "innovation";
  owner: string;
  alignedInitiatives: string[];
  organizationId?: string;
  createdAt?: any;
  updatedAt?: any;
}

const samplePriorities: Priority[] = [
  {
    id: "1",
    title: "Accelerate Revenue Growth",
    whatsImportant: "Revenue growth has plateaued at 15% YoY. We need to reach 40% growth to meet Series B targets and maintain market leadership position.",
    howAreWeDoing: {
      status: "on-track",
      description: "New product line launched successfully with $1.2M in Q1 bookings. European expansion pilot showing 25% faster sales cycles.",
      trend: "up",
    },
    prioritiesToImprove: [
      "Accelerate enterprise sales motion",
      "Expand into 3 new European markets by Q2",
      "Launch premium tier pricing model",
    ],
    category: "growth",
    owner: "CEO",
    alignedInitiatives: ["Launch New Product Line", "Expand to European Markets"],
  },
  {
    id: "2",
    title: "Improve Customer Retention",
    whatsImportant: "Churn rate increased to 8% monthly, up from 5% last quarter. Customer lifetime value is declining, impacting unit economics and investor confidence.",
    howAreWeDoing: {
      status: "at-risk",
      description: "Onboarding completion rate dropped to 62%. Customer health scores show declining engagement in months 2-4 of subscription lifecycle.",
      trend: "down",
    },
    prioritiesToImprove: [
      "Redesign onboarding flow to improve completion rate",
      "Implement proactive CSM outreach at risk indicators",
      "Build automated engagement campaigns",
      "Create customer success playbooks",
    ],
    category: "efficiency",
    owner: "VP Customer Success",
    alignedInitiatives: ["Customer Success Platform"],
  },
  {
    id: "3",
    title: "Build Competitive Moat",
    whatsImportant: "Two major competitors launched similar core features last quarter. We need AI/ML-powered differentiation to maintain our premium positioning and pricing power.",
    howAreWeDoing: {
      status: "on-track",
      description: "Predictive analytics engine in beta with 5 design partners. Early feedback shows 3x improvement in decision-making speed.",
      trend: "up",
    },
    prioritiesToImprove: [
      "Ship AI recommendations engine by Q2",
      "Build predictive forecasting capabilities",
      "Patent key ML algorithms",
    ],
    category: "innovation",
    owner: "CTO",
    alignedInitiatives: ["AI-Powered Analytics Dashboard"],
  },
  {
    id: "4",
    title: "Scale Team Efficiency",
    whatsImportant: "Cost per customer acquisition is rising 20% YoY while team productivity is declining. We're burning $400K monthly on inefficient processes that need automation.",
    howAreWeDoing: {
      status: "needs-attention",
      description: "Average sales cycle extended to 89 days. Support team handling 40% more tickets with same headcount, leading to burnout and quality issues.",
      trend: "down",
    },
    prioritiesToImprove: [
      "Automate lead qualification and routing",
      "Implement self-service support portal",
      "Standardize cross-functional workflows",
      "Build operational dashboards for each team",
    ],
    category: "efficiency",
    owner: "COO",
    alignedInitiatives: [],
  },
  {
    id: "5",
    title: "Reduce Technical Debt",
    whatsImportant: "System performance is degrading. 15% of engineering time is spent firefighting incidents. Platform reliability issues are causing customer escalations and threatening renewals.",
    howAreWeDoing: {
      status: "needs-attention",
      description: "P1 incidents increased 40% this quarter. Average response time degraded to 3.2 seconds. Database query optimization backlog is 6 months deep.",
      trend: "down",
    },
    prioritiesToImprove: [
      "Migrate to microservices architecture",
      "Upgrade database infrastructure",
      "Implement comprehensive monitoring",
      "Establish technical debt sprints",
    ],
    category: "risk",
    owner: "VP Engineering",
    alignedInitiatives: [],
  },
];

const categoryColors = {
  growth: "#00d4aa",
  efficiency: "#3b82f6",
  risk: "#ef4444",
  innovation: "#8b5cf6",
};

const statusConfig = {
  "on-track": {
    label: "On Track",
    color: "#00d4aa",
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  "at-risk": {
    label: "At Risk",
    color: "#f59e0b",
    icon: <Clock className="w-5 h-5" />,
  },
  "needs-attention": {
    label: "Needs Attention",
    color: "#ef4444",
    icon: <AlertTriangle className="w-5 h-5" />,
  },
};

const trendIcons = {
  up: <TrendingUp className="w-4 h-4" style={{ color: "#00d4aa" }} />,
  down: <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />,
  stable: <Minus className="w-4 h-4" style={{ color: "#6b7280" }} />,
};

export default function PrioritiesPage() {
  const { currentOrg } = useOrganization();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState<Priority | null>(null);

  const organizationId = currentOrg?.id || "";

  // Fetch priorities from Firestore
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    fetchPriorities();
  }, [organizationId]);

  const fetchPriorities = async () => {
    if (!organizationId) return;
    
    setLoading(true);
    try {
      const prioritiesQuery = query(
        collection(db, "priorities"),
        where("organizationId", "==", organizationId)
      );
      const querySnapshot = await getDocs(prioritiesQuery);
      
      const fetchedPriorities: Priority[] = [];
      querySnapshot.forEach((doc) => {
        fetchedPriorities.push({
          id: doc.id,
          ...doc.data()
        } as Priority);
      });
      
      setPriorities(fetchedPriorities);
    } catch (error) {
      console.error("Error fetching priorities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePriority = async (priorityData: Priority) => {
    if (!organizationId) {
      alert("No organization selected");
      return;
    }

    try {
      if (editingPriority?.id) {
        // Update existing priority
        const priorityRef = doc(db, "priorities", editingPriority.id);
        await updateDoc(priorityRef, {
          ...priorityData,
          organizationId,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new priority
        await addDoc(collection(db, "priorities"), {
          ...priorityData,
          organizationId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      
      await fetchPriorities();
      setIsModalOpen(false);
      setEditingPriority(null);
    } catch (error) {
      console.error("Error saving priority:", error);
      alert("Failed to save priority. Please try again.");
    }
  };

  const handleDeletePriority = async (priorityId: string) => {
    if (!confirm("Are you sure you want to delete this priority?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "priorities", priorityId));
      await fetchPriorities();
    } catch (error) {
      console.error("Error deleting priority:", error);
      alert("Failed to delete priority. Please try again.");
    }
  };

  const handleEditClick = (priority: Priority) => {
    setEditingPriority(priority);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingPriority(null);
    setIsModalOpen(true);
  };

  const filteredPriorities = selectedCategory === "all" 
    ? priorities 
    : priorities.filter(p => p.category === selectedCategory);

  const onTrackCount = priorities.filter(p => p.howAreWeDoing.status === "on-track").length;
  const atRiskCount = priorities.filter(p => p.howAreWeDoing.status === "at-risk").length;
  const needsAttentionCount = priorities.filter(p => p.howAreWeDoing.status === "needs-attention").length;

  return (
    <AppLayout 
      title="Strategic Priorities" 
      subtitle="Company-level problems and goals that drive initiatives"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Total Priorities
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {priorities.length}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}
                >
                  <Target className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    On Track
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {onTrackCount}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(0, 212, 170, 0.1)", color: "#00d4aa" }}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    At Risk
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {atRiskCount}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}
                >
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    Needs Attention
                  </p>
                  <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                    {needsAttentionCount}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Filter and Add Button */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Filter:</span>
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedCategory === "all" ? "shadow-sm" : ""}`}
              style={{
                background: selectedCategory === "all" ? "var(--card)" : "transparent",
                color: selectedCategory === "all" ? "var(--foreground)" : "var(--foreground-muted)",
                border: selectedCategory === "all" ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              All
            </button>
            {Object.entries(categoryColors).map(([category, color]) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${selectedCategory === category ? "shadow-sm" : ""}`}
                style={{
                  background: selectedCategory === category ? `${color}15` : "transparent",
                  color: selectedCategory === category ? color : "var(--foreground-muted)",
                  border: selectedCategory === category ? `1px solid ${color}` : "1px solid transparent",
                }}
              >
                {category}
              </button>
            ))}
            </div>
            
            <button
              onClick={handleAddClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80"
              style={{ 
                background: "#3b82f6",
                color: "white"
              }}
            >
              <Plus className="w-4 h-4" />
              Add Priority
            </button>
          </div>
        </motion.div>

        {/* Priority Cards Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Loading priorities...</p>
          </div>
        ) : filteredPriorities.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <div className="text-center py-12">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  No priorities yet
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--foreground-muted)" }}>
                  Create your first strategic priority to get started
                </p>
                <button
                  onClick={handleAddClick}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80"
                  style={{ 
                    background: "#3b82f6",
                    color: "white"
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add Priority
                </button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredPriorities.map((priority, index) => (
            <motion.div 
              key={priority.id}
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.5 + (index * 0.1) }}
            >
              <Card>
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="px-2 py-1 rounded-full text-xs font-medium capitalize"
                          style={{ 
                            background: `${categoryColors[priority.category]}15`,
                            color: categoryColors[priority.category]
                          }}
                        >
                          {priority.category}
                        </div>
                        <div className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                          {priority.owner}
                        </div>
                      </div>
                      <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                        {priority.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusConfig[priority.howAreWeDoing.status].icon}
                      <button
                        onClick={() => handleEditClick(priority)}
                        className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                        style={{ color: "var(--foreground-muted)" }}
                        title="Edit priority"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => priority.id && handleDeletePriority(priority.id)}
                        className="p-2 rounded-lg transition-colors hover:bg-red-50"
                        style={{ color: "#ef4444" }}
                        title="Delete priority"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* What's Important */}
                  <div>
                    <h4 className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                      What's Important
                    </h4>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                      {priority.whatsImportant}
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="border-t" style={{ borderColor: "var(--border)" }}></div>

                  {/* How Are We Doing */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                        How Are We Doing
                      </h4>
                      <div className="flex items-center gap-2">
                        {trendIcons[priority.howAreWeDoing.trend]}
                        <span 
                          className="text-xs font-medium px-2 py-1 rounded-full"
                          style={{ 
                            background: `${statusConfig[priority.howAreWeDoing.status].color}15`,
                            color: statusConfig[priority.howAreWeDoing.status].color
                          }}
                        >
                          {statusConfig[priority.howAreWeDoing.status].label}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                      {priority.howAreWeDoing.description}
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="border-t" style={{ borderColor: "var(--border)" }}></div>

                  {/* Priorities to Improve */}
                  <div>
                    <h4 className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                      Priorities to Improve
                    </h4>
                    <ul className="space-y-1.5">
                      {priority.prioritiesToImprove.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: "var(--foreground)" }}>
                          <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: categoryColors[priority.category] }}></span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Aligned Initiatives */}
                  {priority.alignedInitiatives.length > 0 && (
                    <>
                      <div className="border-t" style={{ borderColor: "var(--border)" }}></div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                          Initiatives:
                        </span>
                        {priority.alignedInitiatives.map((initiative, idx) => (
                          <span 
                            key={idx}
                            className="px-2 py-1 rounded-full text-xs flex items-center gap-1"
                            style={{ 
                              background: "var(--muted)",
                              color: "var(--foreground)"
                            }}
                          >
                            <Zap className="w-3 h-3" />
                            {initiative}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  {priority.alignedInitiatives.length === 0 && (
                    <>
                      <div className="border-t" style={{ borderColor: "var(--border)" }}></div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: "#f59e0b" }}>
                        <AlertTriangle className="w-4 h-4" />
                        <span>No aligned initiatives yet</span>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
          </div>
        )}

        {/* Link to Initiatives */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
                  Ready to execute?
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  Create and prioritize initiatives that align with these strategic priorities.
                </p>
              </div>
              <a 
                href="/planning/initiatives"
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:opacity-80"
                style={{ 
                  background: "#8b5cf6",
                  color: "white"
                }}
              >
                View Initiatives
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Priority Modal */}
      <PriorityModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPriority(null);
        }}
        onSave={handleSavePriority}
        priority={editingPriority}
      />
    </AppLayout>
  );
}
