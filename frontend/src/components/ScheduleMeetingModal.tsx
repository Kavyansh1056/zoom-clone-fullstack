"use client";

import React, { useState } from "react";
import { Calendar, X, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { format, addHours, isBefore, startOfToday } from "date-fns";
import { createMeeting } from "@/lib/api";
import { Meeting } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { DEFAULT_HOST_NAME } from "@/lib/constants";

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingCreated: (meeting: Meeting) => void;
}

export function ScheduleMeetingModal({
  isOpen,
  onClose,
  onMeetingCreated,
}: ScheduleMeetingModalProps) {
  const { showToast } = useToast();

  const now = new Date();
  const nextHour = addHours(now, 1);
  const defaultDate = format(nextHour, "yyyy-MM-dd");
  const defaultTime = format(nextHour, "HH:mm");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState("30");
  const [hostName, setHostName] = useState(DEFAULT_HOST_NAME);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please provide a meeting title");
      return;
    }

    // Validate date & time
    const scheduledDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(scheduledDateTime.getTime())) {
      setError("Please select a valid date and time");
      return;
    }

    if (isBefore(scheduledDateTime, new Date(Date.now() - 5 * 60 * 1000))) {
      setError("Cannot schedule a meeting in the past");
      return;
    }

    setLoading(true);

    try {
      const newMeeting = await createMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        host_name: hostName.trim() || "Guest User (Host)",
        scheduled_at: scheduledDateTime.toISOString(),
        duration: parseInt(duration, 10),
        is_instant: false,
      });

      showToast("Meeting scheduled successfully!", "success");
      onMeetingCreated(newMeeting);
      onClose();
      // Reset form
      setTitle("");
      setDescription("");
    } catch (err: any) {
      setError(err?.message || "Failed to schedule meeting");
    } finally {
      setLoading(false);
    }
  };

  const todayStr = format(startOfToday(), "yyyy-MM-dd");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="fixed inset-0" onClick={() => !loading && onClose()} />
      <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden z-10 animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2D8CFF] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Schedule Meeting</h2>
              <p className="text-xs text-slate-500">Plan a session and generate an invite link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700 animate-slide-up">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Topic / Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product Architecture & Sprint Review"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 focus:border-[#2D8CFF] focus:bg-white transition-all"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add meeting agenda or notes for participants..."
              rows={2}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 focus:border-[#2D8CFF] focus:bg-white transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                min={todayStr}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 focus:border-[#2D8CFF] focus:bg-white transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 focus:border-[#2D8CFF] focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 focus:border-[#2D8CFF] focus:bg-white transition-all"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Host Name
              </label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 focus:border-[#2D8CFF] focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-[#2D8CFF] flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#2D8CFF] shrink-0" />
            <span className="text-[11px]">A unique 10-digit meeting ID and shareable invite URL will be generated.</span>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
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
              <span>Save & Schedule</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
