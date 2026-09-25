"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { MeetingCard } from "@/components/MeetingCard";
import { ScheduleMeetingModal } from "@/components/ScheduleMeetingModal";
import { getAllMeetings, deleteMeeting } from "@/lib/api";
import { Meeting } from "@/lib/types";
import { Calendar, Plus, RefreshCw } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function MeetingsPage() {
  const { showToast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed">("all");
  const [loading, setLoading] = useState(true);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const loadMeetings = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllMeetings();
      setMeetings(data);
    } catch (err: any) {
      showToast("Failed to fetch meetings", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleDelete = async (meetingId: string) => {
    try {
      await deleteMeeting(meetingId);
      setMeetings((prev) => prev.filter((m) => m.meeting_id !== meetingId));
      showToast("Meeting deleted successfully", "info");
    } catch (err: any) {
      showToast(err?.message || "Failed to delete meeting", "error");
    }
  };

  const filtered = meetings.filter((m) => {
    if (filter === "scheduled") return m.status === "scheduled" || m.status === "in_progress";
    if (filter === "completed") return m.status === "completed" || m.status === "cancelled";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F7F9FA] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Meetings
            </h1>
            <p className="text-xs text-slate-500">
              Manage your upcoming schedule, active sessions, and previous meeting history.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setScheduleModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#2D8CFF] hover:bg-[#1A73E8] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule a Meeting</span>
            </button>
            <button
              onClick={loadMeetings}
              title="Refresh"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#2D8CFF]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          <button
            onClick={() => setFilter("all")}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              filter === "all"
                ? "border-[#2D8CFF] text-[#2D8CFF]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            All Meetings ({meetings.length})
          </button>
          <button
            onClick={() => setFilter("scheduled")}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              filter === "scheduled"
                ? "border-[#2D8CFF] text-[#2D8CFF]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Upcoming & Live ({meetings.filter((m) => m.status === "scheduled" || m.status === "in_progress").length})
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              filter === "completed"
                ? "border-[#2D8CFF] text-[#2D8CFF]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Previous ({meetings.filter((m) => m.status === "completed" || m.status === "cancelled").length})
          </button>
        </div>

        {/* Meetings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 animate-pulse h-40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No meetings found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You do not have any meetings in this view.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                isUpcoming={meeting.status !== "completed"}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <ScheduleMeetingModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onMeetingCreated={(newMeeting) => {
          setMeetings((prev) => [newMeeting, ...prev]);
        }}
      />
    </div>
  );
}
