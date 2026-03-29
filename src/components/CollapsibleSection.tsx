"use client";

import React, { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";

interface CollapsibleSectionProps {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export default function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  badge,
  children,
  className = "",
  headerClassName = "",
  contentClassName = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [height, setHeight] = useState<number | "auto">(defaultOpen ? "auto" : 0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    if (isOpen) {
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(contentHeight);
      
      // After transition completes, set to auto so it can resize organically
      const timer = setTimeout(() => {
        setHeight("auto");
      }, 300); // matches transition duration
      return () => clearTimeout(timer);
    } else {
      // If was auto, set to explicit height first so transition can happen
      if (height === "auto") {
        setHeight(contentRef.current.scrollHeight);
        // Force reflow
        void contentRef.current.offsetHeight;
      }
      // Then set back to 0
      setHeight(0);
    }
  }, [isOpen]);

  return (
    <div className={`overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 transition-colors hover:border-white/15 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5 outline-none focus-visible:ring-2 focus-visible:ring-lime-300/50 ${headerClassName}`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lime-100">
              <Icon icon={icon} className="text-xl" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {badge && <div className="shrink-0">{badge}</div>}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/50 transition-transform duration-300" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
            <Icon icon="solar:alt-arrow-down-bold-duotone" className="text-lg" />
          </div>
        </div>
      </button>
      <div
        className="transition-[height] duration-300 ease-in-out will-change-[height]"
        style={{ height }}
      >
        <div ref={contentRef} className={`border-t border-white/5 p-4 sm:p-5 ${contentClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
