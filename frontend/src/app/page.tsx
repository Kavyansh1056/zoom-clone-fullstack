"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { MeetingActionCard } from "@/components/MeetingActionCard";
import { MeetingCard } from "@/components/MeetingCard";
import { JoinMeetingModal } from "@/components/JoinMeetingModal";
import { ScheduleMeetingModal } from "@/components/ScheduleMeetingModal";
import { getUpcomingMeetings, getRecentMeetings, createMeeting, deleteMeeting } from "@/lib/api";
import { Meeting } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { extractMeetingId } from "@/lib/utils";
import { DEFAULT_USER_NAME, DEFAULT_HOST_NAME } from "@/lib/constants";

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "recent">("upcoming");
  const [loading, setLoading] = useState(true);
  const [creatingInstant, setCreatingInstant] = useState(false);

  // Modals
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [quickMeetingInput, setQuickMeetingInput] = useState("");

  // Live Clock effect
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch meetings
  const loadMeetings = React.useCallback(async () => {
    try {
      setLoading(true);
      const [upcoming, recent] = await Promise.all([
        getUpcomingMeetings(),
        getRecentMeetings(),
      ]);
      setUpcomingMeetings(upcoming);
      setRecentMeetings(recent);
    } catch (err: any) {
      console.error("Failed to load meetings:", err);
      showToast("Could not connect to backend API. Please make sure backend is running.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Handle Instant Meeting
  const handleNewMeeting = async () => {
    try {
      setCreatingInstant(true);
      const meeting = await createMeeting({
        title: `${DEFAULT_USER_NAME}'s Instant Meeting`,
        host_name: DEFAULT_USER_NAME,
        is_instant: true,
        duration: 45,
      });

      showToast("Instant meeting created! Connecting...", "success");
      const queryName = encodeURIComponent(DEFAULT_USER_NAME);
      router.push(`/meeting/${meeting.meeting_id}?name=${queryName}&is_host=1`);
    } catch (err: any) {
      console.error("Error creating instant meeting:", err);
      showToast(err?.message || "Failed to create new meeting", "error");
      setCreatingInstant(false);
    }
  };

  // Handle Quick Join
  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractMeetingId(quickMeetingInput);
    if (!id) {
      showToast("Please enter a valid Meeting ID or link", "error");
      return;
    }
    router.push(`/meeting/${encodeURIComponent(id)}`);
  };

  // Handle Delete
  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      await deleteMeeting(meetingId);
      setUpcomingMeetings((prev) => prev.filter((m) => m.meeting_id !== meetingId));
      setRecentMeetings((prev) => prev.filter((m) => m.meeting_id !== meetingId));
      showToast("Meeting removed", "info");
    } catch (err: any) {
      showToast(err?.message || "Failed to delete meeting", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Main Action Hub & Clock Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* 4 Iconic Zoom Action Buttons (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 justify-items-center">
              <MeetingActionCard
                type="new_meeting"
                title="New Meeting"
                subtitle="Start instant call"
                onClick={handleNewMeeting}
                isLoading={creatingInstant}
              />
              <MeetingActionCard
                type="join"
                title="Join"
                subtitle="Via ID or URL"
                onClick={() => setJoinModalOpen(true)}
              />
              <MeetingActionCard
                type="schedule"
                title="Schedule"
                subtitle="Plan for later"
                onClick={() => setScheduleModalOpen(true)}
              />
              <MeetingActionCard
                type="share_screen"
                title="Share Screen"
                subtitle="Direct presentation"
                onClick={() => setJoinModalOpen(true)}
              />
            </div>

            {/* Quick Join Input Bar */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <form onSubmit={handleQuickJoin} className="flex items-center gap-2">
                <input
                  type="text"
                  value={quickMeetingInput}
                  onChange={(e) => setQuickMeetingInput(e.target.value)}
                  placeholder="Enter Meeting ID (e.g. 849-204-1928) or paste invite link..."
                  className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 focus:border-[#2D8CFF] focus:bg-white transition-all font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2D8CFF] hover:bg-[#1A73E8] active:bg-[#1557B0] text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>Join</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>

          {/* Compact Calendar & Live Clock Card (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span className="font-medium uppercase tracking-wider text-[10px] text-slate-500">Live Clock</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-mono">
                {currentTime ? format(currentTime, "hh:mm:ss a") : "--:--:--"}
              </div>
              <div className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                {currentTime ? format(currentTime, "EEEE, MMMM d, yyyy") : "Loading date..."}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Scheduled Today:</span>
              <span className="font-semibold text-slate-800">
                {upcomingMeetings.length} meeting{upcomingMeetings.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </section>

        {/* Meetings Sections (Tabs: Upcoming & Recent) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 border-b border-slate-200 w-full sm:w-auto">
              <button
                onClick={() => setActiveTab("upcoming")}
                className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  activeTab === "upcoming"
                    ? "border-[#2D8CFF] text-[#2D8CFF]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Upcoming Meetings</span>
                <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-blue-50 text-[#2D8CFF] font-medium border border-blue-100">
                  {upcomingMeetings.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("recent")}
                className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  activeTab === "recent"
                    ? "border-[#2D8CFF] text-[#2D8CFF]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Recent Meetings</span>
                <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-slate-100 text-slate-600 font-medium border border-slate-200">
                  {recentMeetings.length}
                </span>
              </button>
            </div>

            <button
              onClick={loadMeetings}
              title="Refresh meetings"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#2D8CFF]" : ""}`} />
            </button>
          </div>

          {/* Cards Grid */}
          {loading && upcomingMeetings.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 animate-pulse h-40" />
              ))}
            </div>
          ) : (
            <>
              {activeTab === "upcoming" && (
                upcomingMeetings.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-sm font-semibold text-slate-800">No upcoming meetings</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Schedule a meeting in advance or launch an instant meeting whenever you&apos;re ready.
                    </p>
                    <button
                      onClick={() => setScheduleModalOpen(true)}
                      className="mt-3.5 px-3.5 py-1.5 bg-[#2D8CFF] hover:bg-[#1A73E8] text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Schedule a Meeting
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {upcomingMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        isUpcoming={true}
                        onDelete={handleDeleteMeeting}
                      />
                    ))}
                  </div>
                )
              )}

              {activeTab === "recent" && (
                recentMeetings.length === 0 ? (
                  <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
                    <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h3 className="text-sm font-semibold text-slate-800">No recent meeting history</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Completed meetings will automatically appear here for your records.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        isUpcoming={false}
                        onDelete={handleDeleteMeeting}
                      />
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </section>
      </main>

      {/* Modals */}
      <JoinMeetingModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
      />

      <ScheduleMeetingModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onMeetingCreated={(newMeeting) => {
          setUpcomingMeetings((prev) => [newMeeting, ...prev]);
        }}
      />
    </div>
  );
}
