"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Video, Settings, Search, Check, Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_USER_NAME,
  DEFAULT_USER_INITIALS,
  DEFAULT_USER_EMAIL,
} from "@/lib/constants";

interface NavbarProps {
  onOpenSettings?: () => void;
}

export function Navbar({ onOpenSettings }: NavbarProps) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Meetings", href: "/meetings" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-[#2D8CFF] flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105">
                <Video className="w-4.5 h-4.5 fill-white stroke-none" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#2D8CFF] select-none lowercase">
                zoom
              </span>
            </Link>

            {/* Navigation links */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors",
                      isActive
                        ? "text-[#2D8CFF] bg-blue-50/80 font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="hidden md:flex items-center relative w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200/70 focus:bg-white border border-transparent focus:border-[#2D8CFF] rounded-full outline-none transition-all placeholder:text-slate-400"
                readOnly
                title="Search is available across your meeting history"
              />
            </div>

            {/* Settings Button */}
            <button
              onClick={() => {
                if (onOpenSettings) onOpenSettings();
                else setSettingsOpen(true);
              }}
              title="Settings"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Profile Avatar Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
              >
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-[#2D8CFF] text-white font-semibold text-[11px] flex items-center justify-center shadow-xs">
                    {DEFAULT_USER_INITIALS}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1.5 ring-white" />
                </div>
                <span className="text-xs font-medium text-slate-700 hidden sm:inline-block">
                  {DEFAULT_USER_NAME}
                </span>
              </button>

              {/* Profile Menu Popup */}
              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2.5 z-50 text-xs animate-slide-up">
                    <div className="px-4 py-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#2D8CFF] text-white font-semibold text-xs flex items-center justify-center shrink-0">
                          {DEFAULT_USER_INITIALS}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-slate-900 truncate">{DEFAULT_USER_NAME}</p>
                          <p className="text-[11px] text-slate-500 truncate">{DEFAULT_USER_EMAIL}</p>
                          <span className="inline-block mt-0.5 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-blue-50 text-[#2D8CFF] rounded">
                            Guest Session
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="py-1 px-1 text-slate-600">
                      <div className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 rounded-md">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Status: Available
                        </span>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div
                        onClick={() => {
                          setProfileOpen(false);
                          setSettingsOpen(true);
                        }}
                        className="px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 rounded-md cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        Settings & Audio/Video
                      </div>
                      <div className="px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 rounded-md cursor-pointer">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        WebRTC Security Details
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 px-1">
                      <div
                        onClick={() => setProfileOpen(false)}
                        className="px-3 py-1.5 flex items-center gap-2 text-slate-500 hover:bg-slate-50 rounded-md cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Close Menu
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Settings Dialog Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#2D8CFF]" />
                Zoom Settings & Audio/Video
              </h3>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-medium cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-semibold text-slate-800 text-xs mb-1">WebRTC Media Pipeline</p>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Audio & video streams use browser native <code className="font-mono text-[#2D8CFF]">RTCPeerConnection</code> with VP8 video codec and Opus high-definition audio.
                </p>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="rounded text-[#2D8CFF] focus:ring-[#2D8CFF]" />
                  <span>Mute microphone when joining meetings</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="rounded text-[#2D8CFF] focus:ring-[#2D8CFF]" />
                  <span>Turn off video when joining meetings</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="rounded text-[#2D8CFF] focus:ring-[#2D8CFF]" />
                  <span>Automatic echo cancellation & noise suppression</span>
                </label>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 bg-[#2D8CFF] hover:bg-[#1A73E8] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
