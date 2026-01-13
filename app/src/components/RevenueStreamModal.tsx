"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RevenueStream } from "@/types/revenue-streams";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

interface RevenueStreamModalProps {
  organizationId: string;
  onClose: () => void;
  onSave?: (stream: RevenueStream) => void;
  existingStream?: RevenueStream;
}

interface Product {
  id: string;
  name: string;
  productId: string;
}

const colorOptions = [
  { value: "#10b981", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#f97316", label: "Orange" },
];

export default function RevenueStreamModal({
  organizationId,
  onClose,
  onSave,
  existingStream,
}: RevenueStreamModalProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [name, setName] = useState(existingStream?.name || "");
  const [color, setColor] = useState(existingStream?.color || colorOptions[0].value);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(existingStream?.productIds || []);
  
  // Available products
  const [products, setProducts] = useState<Product[]>([]);

  // Fetch available products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const productsQuery = query(
          collection(db, "stripe_products"),
          where("organizationId", "==", organizationId)
        );
        const productsSnap = await getDocs(productsQuery);
        
        const productsList: Product[] = productsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || "Unnamed Product",
          productId: doc.data().productId,
        }));
        
        setProducts(productsList);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      fetchProducts();
    }
  }, [organizationId]);

  const handleSave = async () => {
    if (!name.trim() || !user) {
      alert("Please provide a stream name and ensure you are logged in.");
      return;
    }

    setSaving(true);
    try {
      const streamData: any = {
        organizationId,
        name: name.trim(),
        color,
        productIds: selectedProductIds,
        updatedAt: serverTimestamp(),
      };

      if (existingStream) {
        // Update existing stream
        await updateDoc(doc(db, "revenue_streams", existingStream.id), streamData);
        
        if (onSave) {
          onSave({ ...existingStream, ...streamData } as RevenueStream);
        }
      } else {
        // Create new stream
        streamData.createdAt = serverTimestamp();
        streamData.createdBy = user.uid;
        
        const docRef = await addDoc(collection(db, "revenue_streams"), streamData);
        
        if (onSave) {
          onSave({ ...streamData, id: docRef.id } as RevenueStream);
        }
      }

      onClose();
    } catch (error) {
      console.error("Error saving revenue stream:", error);
      alert(`Error saving revenue stream: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      // Deselect all
      setSelectedProductIds([]);
    } else {
      // Select all
      setSelectedProductIds(products.map(p => p.productId));
    }
  };

  const allSelected = products.length > 0 && selectedProductIds.length === products.length;

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
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
          style={{ background: "var(--background)" }}
        >
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between p-6 border-b"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
          >
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                {existingStream ? "Edit Revenue Stream" : "Create Revenue Stream"}
              </h2>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                Group products into logical revenue streams
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
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Stream Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Job Listings, Subscriptions, Consulting"
                className="w-full px-4 py-2 rounded-lg"
                style={{
                  background: "var(--background-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
            
            {/* Color */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setColor(option.value)}
                    className="w-10 h-10 rounded-lg transition-all"
                    style={{
                      background: option.value,
                      border: color === option.value ? "3px solid var(--accent)" : "2px solid transparent",
                      opacity: color === option.value ? 1 : 0.6,
                    }}
                    title={option.label}
                  />
                ))}
              </div>
            </div>
            
            {/* Products */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                Products ({selectedProductIds.length} selected)
              </label>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
                </div>
              ) : products.length === 0 ? (
                <div 
                  className="text-center py-8 rounded-lg"
                  style={{ background: "var(--background-secondary)" }}
                >
                  <Layers className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--foreground-muted)" }} />
                  <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                    No products found. Connect Stripe and sync data to see products.
                  </p>
                </div>
              ) : (
                <div 
                  className="max-h-64 overflow-y-auto rounded-lg p-3"
                  style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
                >
                  {/* Select All */}
                  <label
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[var(--background-tertiary)] transition-colors mb-2 border-b"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Select All
                    </span>
                  </label>
                  
                  {/* Individual Products */}
                  <div className="space-y-1">
                    {products.map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[var(--background-tertiary)] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.productId)}
                          onChange={() => toggleProduct(product.productId)}
                          className="w-4 h-4 rounded"
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <span className="text-sm" style={{ color: "var(--foreground)" }}>
                          {product.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer */}
          <div
            className="sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: "var(--background-secondary)",
                color: "var(--foreground-muted)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--accent)",
                color: "#ffffff",
              }}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {existingStream ? "Update Stream" : "Create Stream"}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

