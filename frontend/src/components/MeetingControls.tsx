"use client";

import React, { useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  MessageSquare,
  Share2,
  PhoneOff,
  Shield,
  Copy,
  Check,
} from "lucide-react";
import { copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface MeetingControlsProps {
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHost: boolean;
  participantCount: number;
  unreadChatCount?: number;
  inviteLink: string;
  isParticipantsOpen: boolean;
  isChatOpen: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleParticipants: () => void;
  onToggleChat: () => void;
  onLeaveMeeting: () => void;
  onHostMuteAll?: () => void;
}

export function MeetingControls({
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  isHost,
  participantCount,
  unreadChatCount = 0,
  inviteLink,
  isParticipantsOpen,
  isChatOpen,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleParticipants,
  onToggleChat,
  onLeaveMeeting,
  onHostMuteAll,
}: MeetingControlsProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [securityMenuOpen, setSecurityMenuOpen] = useState(false);

  const handleCopyLink = async () => {
    const actualInviteLink =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : inviteLink;
    const success = await copyToClipboard(actualInviteLink);
    if (success) {
      setCopied(true);
      showToast("Meeting invitation copied!", "success");
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast("Failed to copy invite link", "error");
    }
  };

  return (
    <div className="relative h-16 sm:h-18 bg-[#18181B] border-t border-zinc-800 px-2 sm:px-6 flex items-center justify-between z-30 select-none font-sans">
      {/* Left: Audio & Video controls */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {/* Audio Toggle */}
        <button
          onClick={onToggleAudio}
          title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
          className={`flex flex-col items-center justify-center w-12 sm:w-14 h-12 rounded-lg transition-colors cursor-pointer ${
            isAudioMuted
              ? "text-red-400 hover:bg-zinc-800"
              : "text-slate-200 hover:text-white hover:bg-zinc-800"
          }`}
        >
          {isAudioMuted ? <MicOff className="w-4.5 h-4.5 text-red-500" /> : <Mic className="w-4.5 h-4.5" />}
          <span className="text-[10px] sm:text-[11px] mt-0.5 font-normal tracking-tight">
            {isAudioMuted ? "Unmute" : "Mute"}
          </span>
        </button>

        {/* Video Toggle */}
        <button
          onClick={onToggleVideo}
          title={isVideoOff ? "Start Video" : "Stop Video"}
          className={`flex flex-col items-center justify-center w-12 sm:w-14 h-12 rounded-lg transition-colors cursor-pointer ${
            isVideoOff
              ? "text-red-400 hover:bg-zinc-800"
              : "text-slate-200 hover:text-white hover:bg-zinc-800"
          }`}
        >
          {isVideoOff ? <VideoOff className="w-4.5 h-4.5 text-red-500" /> : <Video className="w-4.5 h-4.5" />}
          <span className="text-[10px] sm:text-[11px] mt-0.5 font-normal tracking-tight">
            {isVideoOff ? "Start Video" : "Stop Video"}
          </span>
        </button>
      </div>

      {/* Center: In-meeting actions */}
      <div className="flex items-center gap-0.5 sm:gap-1.5">
        {/* Security / Host controls */}
        {isHost && (
          <div className="relative hidden xs:block">
            <button
              onClick={() => setSecurityMenuOpen(!securityMenuOpen)}
              title="Security Controls"
              className={`flex flex-col items-center justify-center w-12 sm:w-14 h-12 rounded-lg transition-colors cursor-pointer ${
                securityMenuOpen ? "bg-zinc-800 text-white" : "text-slate-300 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <Shield className="w-4.5 h-4.5" />
              <span className="text-[10px] sm:text-[11px] mt-0.5 font-normal">Security</span>
            </button>

            {securityMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setSecurityMenuOpen(false)}
                />
                <div className="absolute bottom-14 left-1/2 transform -translate-x-1/2 w-52 bg-[#242731] border border-zinc-700 rounded-xl shadow-xl p-1.5 z-40 text-xs text-slate-200 animate-slide-up">
                  <div className="px-3 py-1 font-semibold text-slate-400 uppercase text-[9px] tracking-wider border-b border-zinc-700">
                    Host Controls
                  </div>
                  <div className="py-1">
                    {onHostMuteAll && (
                      <button
                        onClick={() => {
                          onHostMuteAll();
                          setSecurityMenuOpen(false);
                          showToast("All participants muted", "info");
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-zinc-700/60 rounded-md flex items-center justify-between text-amber-300 cursor-pointer"
                      >
                        <span>Mute All</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSecurityMenuOpen(false);
                        showToast("Meeting locked to new participants", "info");
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-zinc-700/60 rounded-md flex items-center justify-between cursor-pointer"
                    >
                      <span>Lock Meeting</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Participants Panel Toggle */}
        <button
          onClick={onToggleParticipants}
          title="Participants"
          className={`relative flex flex-col items-center justify-center w-12 sm:w-14 h-12 rounded-lg transition-colors cursor-pointer ${
            isParticipantsOpen ? "bg-zinc-800 text-[#2D8CFF]" : "text-slate-300 hover:text-white hover:bg-zinc-800"
          }`}
        >
          <div className="relative">
            <Users className="w-4.5 h-4.5" />
            <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-[#2D8CFF] text-white rounded-full text-[9px] font-bold">
              {participantCount}
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] mt-0.5 font-normal">Participants</span>
        </button>

        {/* Chat Panel Toggle */}
        <button
          onClick={onToggleChat}
          title="Chat"
          className={`relative flex flex-col items-center justify-center w-12 sm:w-14 h-12 rounded-lg transition-colors cursor-pointer ${
            isChatOpen ? "bg-zinc-800 text-[#2D8CFF]" : "text-slate-300 hover:text-white hover:bg-zinc-800"
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-4.5 h-4.5" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-red-500 text-white rounded-full text-[9px] font-bold animate-pulse">
                {unreadChatCount}
              </span>
            )}
          </div>
          <span className="text-[10px] sm:text-[11px] mt-0.5 font-normal">Chat</span>
        </button>

        {/* Share Screen */}
        <button
          onClick={onToggleScreenShare}
          title="Share Screen"
          className={`hidden sm:flex flex-col items-center justify-center w-14 h-12 rounded-lg transition-colors cursor-pointer ${
            isScreenSharing
              ? "bg-emerald-600 text-white"
              : "text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800"
          }`}
        >
          <Share2 className="w-4.5 h-4.5" />
          <span className="text-[10px] sm:text-[11px] mt-0.5 font-normal">
            {isScreenSharing ? "Stop Share" : "Share"}
          </span>
        </button>

        {/* Copy Invite Link */}
        <button
          onClick={handleCopyLink}
          title="Copy Invitation Link"
          className="hidden xs:flex flex-col items-center justify-center w-12 sm:w-14 h-12 rounded-lg text-slate-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-4.5 h-4.5 text-emerald-400" /> : <Copy className="w-4.5 h-4.5" />}
          <span className="text-[10px] sm:text-[11px] mt-0.5 font-normal">
            {copied ? "Copied" : "Invite"}
          </span>
        </button>
      </div>

      {/* Right: Leave / End Meeting button */}
      <div>
        <button
          onClick={onLeaveMeeting}
          className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-[#E02828] hover:bg-red-600 active:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span>{isHost ? "End" : "Leave"}</span>
        </button>
      </div>
    </div>
  );
}
