"use client";

import React from "react";
import { Video, Plus, Calendar, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionCardType = "new_meeting" | "join" | "schedule" | "share_screen";

interface MeetingActionCardProps {
  type: ActionCardType;
  title: string;
  subtitle?: string;
  onClick: () => void;
  isLoading?: boolean;
}

export function MeetingActionCard({
  type,
  title,
  subtitle,
  onClick,
  isLoading = false,
}: MeetingActionCardProps) {
  const getIcon = () => {
    switch (type) {
      case "new_meeting":
        return <Video className="w-7 h-7 sm:w-8 sm:h-8 text-white fill-white stroke-none" />;
      case "join":
        return <Plus className="w-7 h-7 sm:w-8 sm:h-8 text-white stroke-[2.4]" />;
      case "schedule":
        return <Calendar className="w-7 h-7 sm:w-8 sm:h-8 text-white stroke-[2.2]" />;
      case "share_screen":
        return <Share2 className="w-7 h-7 sm:w-8 sm:h-8 text-white stroke-[2.2]" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case "new_meeting":
        return {
          bg: "bg-[#F26D21] hover:bg-[#E05D17] active:bg-[#C94F12]",
          shadow: "shadow-xs hover:shadow-md",
        };
      case "join":
      case "schedule":
      case "share_screen":
      default:
        return {
          bg: "bg-[#2D8CFF] hover:bg-[#1A73E8] active:bg-[#1557B0]",
          shadow: "shadow-xs hover:shadow-md",
        };
    }
  };

  const colors = getColors();

  return (
    <div className="flex flex-col items-center select-none">
      <button
        onClick={onClick}
        disabled={isLoading}
        aria-label={title}
        className={cn(
          "relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:pointer-events-none active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2D8CFF]",
          colors.bg,
          colors.shadow
        )}
      >
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <div className="transition-transform duration-200 hover:scale-105">
            {getIcon()}
          </div>
        )}
      </button>

      {/* Title */}
      <span className="mt-2.5 text-xs sm:text-sm font-semibold text-slate-800 text-center tracking-tight">
        {title}
      </span>
      {subtitle && (
        <span className="text-[11px] text-slate-500 text-center hidden sm:block">
          {subtitle}
        </span>
      )}
    </div>
  );
}
