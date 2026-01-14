"use client";

import { useState, useEffect } from "react";
import { X, Target } from "lucide-react";

interface Priority {
  id?: string;
  title: string;
  whatsImportant: string;
  howAreWeDoing: string;
  prioritiesToImprove: string[];
  category: "growth" | "efficiency" | "risk" | "innovation";
  owner: string;
  alignedInitiatives: string[];
}

interface PriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (priority: Priority) => void;
  priority?: Priority | null;
}

export default function PriorityModal({ isOpen, onClose, onSave, priority }: PriorityModalProps) {
  const [formData, setFormData] = useState<Priority>({
    title: "",
    whatsImportant: "",
    howAreWeDoing: "",
    prioritiesToImprove: [""],
    category: "growth",
    owner: "",
    alignedInitiatives: [],
  });

  useEffect(() => {
    if (priority) {
      setFormData(priority);
    } else {
      setFormData({
        title: "",
        whatsImportant: "",
        howAreWeDoing: "",
        prioritiesToImprove: [""],
        category: "growth",
        owner: "",
        alignedInitiatives: [],
      });
    }
  }, [priority, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty improvement items
    const cleanedData = {
      ...formData,
      prioritiesToImprove: formData.prioritiesToImprove.filter(item => item.trim() !== ""),
    };
    
    onSave(cleanedData);
  };

  const addImprovementItem = () => {
    setFormData({
      ...formData,
      prioritiesToImprove: [...formData.prioritiesToImprove, ""],
    });
  };

  const updateImprovementItem = (index: number, value: string) => {
    const newItems = [...formData.prioritiesToImprove];
    newItems[index] = value;
    setFormData({ ...formData, prioritiesToImprove: newItems });
  };

  const removeImprovementItem = (index: number) => {
    const newItems = formData.prioritiesToImprove.filter((_, i) => i !== index);
    setFormData({ ...formData, prioritiesToImprove: newItems });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4" 
      style={{ background: "rgba(0, 0, 0, 0.7)" }}
    >
      <div 
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl overflow-hidden"
        style={{ 
          background: "var(--background-secondary)", 
          border: "1px solid var(--border)"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(59, 130, 246, 0.1)" }}>
              <Target className="w-5 h-5" style={{ color: "#3b82f6" }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                {priority ? "Edit Priority" : "New Priority"}
              </h2>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                Define a strategic company-level priority
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "var(--foreground-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Priority Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Accelerate Revenue Growth"
                required
                className="w-full px-4 py-2 rounded-lg border text-sm"
                style={{ 
                  background: "var(--background-tertiary)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)"
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  required
                  className="w-full px-4 py-2 rounded-lg border text-sm capitalize"
                  style={{ 
                    background: "var(--background-tertiary)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)"
                  }}
                >
                  <option value="growth">Growth</option>
                  <option value="efficiency">Efficiency</option>
                  <option value="risk">Risk</option>
                  <option value="innovation">Innovation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  Owner *
                </label>
                <input
                  type="text"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                  placeholder="e.g., CEO, CTO"
                  required
                  className="w-full px-4 py-2 rounded-lg border text-sm"
                  style={{ 
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)"
                  }}
                />
              </div>
            </div>
          </div>

          {/* What's Important */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              What's Important *
            </label>
            <textarea
              value={formData.whatsImportant}
              onChange={(e) => setFormData({ ...formData, whatsImportant: e.target.value })}
              placeholder="Describe the strategic problem or goal in detail..."
              required
              rows={3}
              className="w-full px-4 py-2 rounded-lg border text-sm"
              style={{ 
                background: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)"
              }}
            />
          </div>

          {/* How Are We Doing */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              How Are We Doing *
            </label>
            <textarea
              value={formData.howAreWeDoing}
              onChange={(e) => setFormData({ ...formData, howAreWeDoing: e.target.value })}
              placeholder="Describe current performance with specific metrics..."
              required
              rows={3}
              className="w-full px-4 py-2 rounded-lg border text-sm"
              style={{ 
                background: "var(--background-tertiary)",
                borderColor: "var(--border)",
                color: "var(--foreground)"
              }}
            />
          </div>

          {/* Priorities to Improve */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Priorities to Improve
            </label>
            <div className="space-y-2">
              {formData.prioritiesToImprove.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateImprovementItem(index, e.target.value)}
                    placeholder="Action item to improve this priority..."
                    className="flex-1 px-4 py-2 rounded-lg border text-sm"
                    style={{ 
                      background: "var(--background-tertiary)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)"
                    }}
                  />
                  {formData.prioritiesToImprove.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeImprovementItem(index)}
                      className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ 
                        color: "#ef4444",
                        background: "rgba(239, 68, 68, 0.1)"
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addImprovementItem}
                className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{ 
                  color: "#3b82f6",
                  background: "rgba(59, 130, 246, 0.1)"
                }}
              >
                + Add Item
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              style={{ 
                color: "var(--foreground-muted)",
                backgroundColor: "var(--muted)"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-80"
              style={{ 
                backgroundColor: "#3b82f6",
                color: "white"
              }}
            >
              {priority ? "Save Changes" : "Create Priority"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
