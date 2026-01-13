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
  totalRevenue: number;
  lastCharged: Date | null;
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
        
        // Fetch invoices to calculate revenue and last charged per product
        const invoicesQuery = query(
          collection(db, "stripe_invoices"),
          where("organizationId", "==", organizationId),
          where("status", "==", "paid")
        );
        const invoicesSnap = await getDocs(invoicesQuery);
        
        // Calculate revenue and last charged per product
        const productRevenue = new Map<string, number>();
        const productLastCharged = new Map<string, Date>();
        
        invoicesSnap.docs.forEach(doc => {
          const invoice = doc.data();
          const invoiceDate = invoice.created?.toDate?.() || new Date();
          const lineItems = invoice.lineItems || [];
          
          lineItems.forEach((item: any) => {
            const productId = item.productId;
            if (productId) {
              const amount = (item.amount || 0) / 100;
              productRevenue.set(productId, (productRevenue.get(productId) || 0) + amount);
              
              // Update last charged if this is more recent
              const currentLast = productLastCharged.get(productId);
              if (!currentLast || invoiceDate > currentLast) {
                productLastCharged.set(productId, invoiceDate);
              }
            }
          });
        });
        
        // Map products with revenue and last charged data
        const productsList: Product[] = productsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || "Unnamed Product",
          productId: doc.data().stripeId,
          totalRevenue: productRevenue.get(doc.data().stripeId) || 0,
          lastCharged: productLastCharged.get(doc.data().stripeId) || null,
        }));
        
        // Sort by revenue descending (products with revenue first, then alphabetically)
        const sortedProducts = productsList.sort((a, b) => {
          if (a.totalRevenue !== b.totalRevenue) {
            return b.totalRevenue - a.totalRevenue; // Higher revenue first
          }
          return a.name.localeCompare(b.name); // Alphabetical for same revenue
        });
        
        setProducts(sortedProducts);
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
    if (!name.trim()) {
      alert("Please provide a stream name.");
      return;
    }
    
    if (!user || !user.uid) {
      alert("Please ensure you are logged in.");
      return;
    }
    
    if (!organizationId || organizationId.trim() === "") {
      alert("Organization ID is required.");
      return;
    }
    
    if (!color || color.trim() === "") {
      alert("Please select a color.");
      return;
    }

    setSaving(true);
    try {
      // Debug: Log what we're saving
      console.log("💾 Saving revenue stream:");
      console.log("   Name:", name.trim());
      console.log("   Selected product IDs:", selectedProductIds);
      console.log("   Number of products:", selectedProductIds.length);
      
      // Show which products were selected
      const selectedProducts = products.filter(p => selectedProductIds.includes(p.productId));
      console.log("   Selected products:", selectedProducts.map(p => ({ name: p.name, stripeId: p.productId })));
      
      // Build clean data object
      const streamData: Record<string, any> = {
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
        // Create new stream - add creation fields
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
            {!organizationId && (
              <div 
                className="p-4 rounded-lg mb-4"
                style={{ background: "var(--background-secondary)", borderLeft: "4px solid var(--accent)" }}
              >
                <p className="text-sm" style={{ color: "var(--foreground)" }}>
                  Unable to create revenue stream: Organization not found. Please refresh the page.
                </p>
              </div>
            )}
            
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  Products ({selectedProductIds.length} selected)
                </label>
                <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {products.filter(p => p.totalRevenue > 0).length} with revenue
                </span>
              </div>
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
                    htmlFor="select-all-products-checkbox"
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[var(--background-tertiary)] transition-colors mb-2 border-b"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <input
                      id="select-all-products-checkbox"
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
                    {products.map((product) => {
                      const isChecked = selectedProductIds.includes(product.productId);
                      const checkboxId = `product-checkbox-${product.productId}`;
                      
                      // Format last charged date
                      const lastChargedText = product.lastCharged
                        ? new Intl.DateTimeFormat('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: product.lastCharged.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                          }).format(product.lastCharged)
                        : 'Never';
                      
                      return (
                        <label
                          key={product.productId}
                          htmlFor={checkboxId}
                          className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[var(--background-tertiary)] transition-colors"
                        >
                          <input
                            id={checkboxId}
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleProduct(product.productId);
                            }}
                            className="w-4 h-4 rounded flex-shrink-0"
                            style={{ accentColor: "var(--accent)" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm" style={{ color: "var(--foreground)" }}>
                              {product.name}
                            </div>
                            <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                              <span className={product.totalRevenue > 0 ? "font-medium" : ""}>
                                ${product.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span>•</span>
                              <span>Last: {lastChargedText}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
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
              disabled={saving || !name.trim() || !organizationId}
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

