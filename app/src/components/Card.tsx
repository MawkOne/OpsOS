"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: "accent" | "secondary" | "none";
  padding?: "none" | "sm" | "md" | "lg";
  style?: React.CSSProperties;
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export default function Card({ 
  children, 
  className = "", 
  hover = false,
  glow = "none",
  padding = "md",
  style
}: CardProps) {
  const glowClass = glow === "accent" 
    ? "glow-accent" 
    : glow === "secondary" 
    ? "glow-secondary" 
    : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        rounded-xl
        ${paddingMap[padding]}
        ${glowClass}
        ${hover ? "cursor-pointer" : ""}
        ${className}
      `}
      style={{
        background: "var(--background-secondary)",
        border: "1px solid var(--border)",
        ...style
      }}
      whileHover={hover ? { 
        scale: 1.01,
        borderColor: "var(--border-hover)"
      } : undefined}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
}

export function StatCard({ label, value, change, changeType = "neutral", icon }: StatCardProps) {
  const changeColor = changeType === "positive" 
    ? "var(--success)" 
    : changeType === "negative" 
    ? "var(--error)" 
    : "var(--foreground-muted)";

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm mb-1" style={{ color: "var(--foreground-muted)" }}>
            {label}
          </p>
          <p className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
            {value}
          </p>
          {change && (
            <p className="text-sm mt-1" style={{ color: changeColor }}>
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

