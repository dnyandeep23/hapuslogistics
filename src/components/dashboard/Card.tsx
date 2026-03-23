"use client";

import React from "react";

type CardProps = {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export default function Card({ title, subtitle, action, children, className = "" }: CardProps) {
  return (
    <section className={`dashboard-surface rounded-2xl p-5 ${className}`}>
      {(title || subtitle || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-semibold text-[#E4E67A]">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-white/70">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
