"use client";

import React, { useState, useRef, useEffect } from "react";
import { ConnectionQualityStats } from "@/hooks/useConnectionQuality";
import { Activity, Wifi, WifiOff, HelpCircle } from "lucide-react";

interface ConnectionQualityIndicatorProps {
  stats: ConnectionQualityStats;
}

export function ConnectionQualityIndicator({ stats }: ConnectionQualityIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getStatusColor = () => {
    switch (stats.quality) {
      case "excellent":
        return {
          dot: "bg-emerald-400",
          text: "text-emerald-400",
          border: "border-emerald-500/30",
          bg: "bg-emerald-500/10",
        };
      case "good":
        return {
          dot: "bg-emerald-500",
          text: "text-slate-300",
          border: "border-zinc-700/60",
          bg: "bg-zinc-800/60",
        };
      case "poor":
        return {
          dot: "bg-rose-500",
          text: "text-rose-400",
          border: "border-rose-500/30",
          bg: "bg-rose-500/10",
        };
      case "connecting":
      default:
        return {
          dot: "bg-blue-400 animate-pulse",
          text: "text-blue-400",
          border: "border-blue-500/30",
          bg: "bg-blue-500/10",
        };
    }
  };

  const colors = getStatusColor();

  const labelText =
    stats.quality === "excellent"
      ? "Excellent"
      : stats.quality === "good"
      ? "Good"
      : stats.quality === "poor"
      ? "Poor"
      : "Connecting";

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Badge */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-all cursor-pointer ${colors.bg} ${colors.border} ${colors.text} hover:brightness-110`}
        title="WebRTC Connection Quality"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        <span className="hidden xs:inline">{labelText}</span>
      </button>

      {/* Popover / Tooltip */}
      {isOpen && (
        <div
          onMouseLeave={() => setIsOpen(false)}
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-[#1A1D24] border border-zinc-700/80 rounded-xl shadow-xl z-50 text-left font-sans animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Activity className="w-3.5 h-3.5 text-[#2D8CFF]" />
              <span>Connection Quality</span>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${colors.bg} ${colors.text}`}
            >
              {labelText}
            </span>
          </div>

          {/* Metrics Content */}
          <div className="mt-2.5 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span>Connection State:</span>
              <span className="font-mono font-medium text-slate-200 capitalize">
                {stats.connectionState || "Active"}
              </span>
            </div>

            {stats.peerCount === 0 ? (
              <div className="pt-1 text-[11px] text-slate-400 italic">
                Waiting for peers to join call.
              </div>
            ) : stats.isAvailable ? (
              <>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Round-Trip Time (RTT):</span>
                  <span className="font-mono font-medium text-slate-200">
                    {stats.rttMs !== null ? `${stats.rttMs} ms` : "Unavailable"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>Packet Loss:</span>
                  <span className="font-mono font-medium text-slate-200">
                    {stats.packetLossPercent !== null
                      ? `${stats.packetLossPercent}%`
                      : "0.0%"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>ICE Traversal:</span>
                  <span className="font-mono font-medium text-slate-200 capitalize">
                    {stats.iceState}
                  </span>
                </div>
              </>
            ) : (
              <div className="pt-1 flex items-center gap-1.5 text-slate-400 italic text-[10px]">
                <HelpCircle className="w-3 h-3 text-slate-500 shrink-0" />
                <span>Connection information unavailable</span>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="mt-2.5 pt-2 border-t border-zinc-800 text-[10px] text-slate-500 leading-tight">
            Derived directly from RTCPeerConnection statistics and candidate-pair metrics.
          </div>
        </div>
      )}
    </div>
  );
}
