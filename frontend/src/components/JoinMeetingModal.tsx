"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, X, AlertCircle, Loader2 } from "lucide-react";
import { extractMeetingId } from "@/lib/utils";
import { getMeetingById } from "@/lib/api";
import { DEFAULT_USER_NAME } from "@/lib/constants";

interface JoinMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMeetingId?: string;
}

export function JoinMeetingModal({ isOpen, onClose, defaultMeetingId = "" }: JoinMeetingModalProps) {
  const router = useRouter();
  const [meetingInput, setMeetingInput] = useState(defaultMeetingId);
  const [displayName, setDisplayName] = useState(DEFAULT_USER_NAME);
  const [turnOffVideo, setTurnOffVideo] = useState(false);
  const [muteAudio, setMuteAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const meetingId = extractMeetingId(meetingInput);
    if (!meetingId) {
      setError("Please enter a valid 10-digit Meeting ID or invite URL.");
      return;
    }

    if (!displayName.trim()) {
      setError("Please enter your display name.");
      return;
    }

    setLoading(true);

    try {
      // Validate meeting exists in backend
      await getMeetingById(meetingId);

      // Successfully validated - navigate to meeting room
      const params = new URLSearchParams({
        name: displayName.trim(),
        audio: muteAudio ? "0" : "1",
        video: turnOffVideo ? "0" : "1",
      });

      router.push(`/meeting/${encodeURIComponent(meetingId)}?${params.toString()}`);
    } catch (err: any) {
      setError(err?.message || "Meeting does not exist or has expired. Please verify your ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={() => !loading && onClose()}
      />
      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden z-10 animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2D8CFF] flex items-center justify-center">
              <Video className="w-4 h-4 fill-current stroke-none" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Join Meeting</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700 animate-slide-up">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Meeting ID or Personal Link Name
            </label>
            <input
              type="text"
              value={meetingInput}
              onChange={(e) => setMeetingInput(e.target.value)}
              placeholder="e.g. 849-204-1928 or paste invite link"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 focus:border-[#2D8CFF] focus:bg-white transition-all font-mono"
              autoFocus
              required
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Paste the invite link or enter the 10-digit meeting ID.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 focus:border-[#2D8CFF] focus:bg-white transition-all"
              required
            />
          </div>

          {/* Join Options */}
          <div className="pt-2 border-t border-slate-100 space-y-2 text-xs text-slate-600">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={muteAudio}
                onChange={(e) => setMuteAudio(e.target.checked)}
                className="w-4 h-4 rounded text-[#2D8CFF] border-slate-300 focus:ring-[#2D8CFF]"
              />
              <span>Do not connect to audio</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={turnOffVideo}
                onChange={(e) => setTurnOffVideo(e.target.checked)}
                className="w-4 h-4 rounded text-[#2D8CFF] border-slate-300 focus:ring-[#2D8CFF]"
              />
              <span>Turn off my video</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#2D8CFF] hover:bg-[#1A73E8] active:bg-[#1557B0] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Join</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
