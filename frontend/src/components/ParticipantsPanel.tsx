"use client";

import React, { useState } from "react";
import { X, Mic, MicOff, Video, VideoOff, UserX, Search } from "lucide-react";
import { PeerInfo } from "@/lib/types";
import { getInitials } from "@/lib/utils";

interface ParticipantsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  localName: string;
  isHost: boolean;
  localAudioMuted: boolean;
  localVideoOff: boolean;
  peers: PeerInfo[];
  onHostMuteAll?: () => void;
  onRemoveParticipant?: (peerId: string) => void;
}

export function ParticipantsPanel({
  isOpen,
  onClose,
  localName,
  isHost,
  localAudioMuted,
  localVideoOff,
  peers,
  onHostMuteAll,
  onRemoveParticipant,
}: ParticipantsPanelProps) {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const allParticipants = [
    {
      peer_id: "local",
      display_name: localName,
      is_host: isHost,
      is_self: true,
      audio_enabled: !localAudioMuted,
      video_enabled: !localVideoOff,
    },
    ...peers.map((p) => ({
      peer_id: p.peer_id,
      display_name: p.display_name,
      is_host: p.is_host,
      is_self: false,
      audio_enabled: p.audio_enabled ?? true,
      video_enabled: p.video_enabled ?? true,
    })),
  ];

  const filtered = allParticipants.filter((p) =>
    p.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-72 sm:w-80 h-full bg-[#18181B] border-l border-zinc-800 flex flex-col z-20 animate-fade-in shadow-2xl font-sans">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-white text-xs sm:text-sm">
          Participants ({allParticipants.length})
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2.5 border-b border-zinc-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-8 pr-3 py-1 bg-zinc-900 border border-zinc-700/80 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#2D8CFF] transition-colors"
          />
        </div>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.map((p) => (
          <div
            key={p.peer_id}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/60 transition-colors group"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#2D8CFF]/25 text-[#2D8CFF] border border-[#2D8CFF]/30 text-[11px] font-semibold flex items-center justify-center shrink-0">
                {getInitials(p.display_name)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {p.display_name.replace(/\s*\((You|Host)\)/gi, "").trim()} {p.is_self && "(You)"}
                </p>
                <div className="flex items-center gap-1">
                  {p.is_host && (
                    <span className="text-[9px] text-[#2D8CFF] font-semibold uppercase tracking-wider">
                      Host
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Media status indicators & host kick action */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Audio Status */}
              <span className={`p-1 rounded ${!p.audio_enabled ? "text-red-400" : "text-slate-400"}`}>
                {!p.audio_enabled ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </span>

              {/* Video Status */}
              <span className={`p-1 rounded ${!p.video_enabled ? "text-red-400" : "text-slate-400"}`}>
                {!p.video_enabled ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              </span>

              {/* Host Kick Option */}
              {isHost && !p.is_self && onRemoveParticipant && (
                <button
                  onClick={() => onRemoveParticipant(p.peer_id)}
                  title="Remove from meeting"
                  className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-all ml-0.5 cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Host Actions */}
      {isHost && (
        <div className="p-2.5 border-t border-zinc-800 bg-[#141417]">
          <button
            onClick={onHostMuteAll}
            className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-slate-200 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <MicOff className="w-3.5 h-3.5 text-amber-400" />
            <span>Mute All</span>
          </button>
        </div>
      )}
    </div>
  );
}
