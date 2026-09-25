"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, Video } from "lucide-react";
import { getMeetingById } from "@/lib/api";
import { Meeting } from "@/lib/types";
import { MeetingPreview } from "@/components/MeetingPreview";
import { MeetingRoom } from "@/components/MeetingRoom";
import { DEFAULT_USER_NAME } from "@/lib/constants";

export default function MeetingEntryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawMeetingId = params.meetingId as string;
  const meetingId = decodeURIComponent(rawMeetingId);

  const queryName = searchParams.get("name") || DEFAULT_USER_NAME;
  const queryAudio = searchParams.get("audio") !== "0";
  const queryVideo = searchParams.get("video") !== "0";
  const queryIsHost = searchParams.get("is_host") === "1";

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hasJoined, setHasJoined] = useState(false);
  const [preloadedStream, setPreloadedStream] = useState<MediaStream | null>(null);
  const [joinSettings, setJoinSettings] = useState({
    displayName: queryName,
    audioEnabled: queryAudio,
    videoEnabled: queryVideo,
    isHost: queryIsHost,
  });

  useEffect(() => {
    async function fetchMeeting() {
      try {
        setLoading(true);
        setError(null);
        const data = await getMeetingById(meetingId);
        setMeeting(data);

        // If user is designated host or meeting host matches name
        if (queryIsHost || data.host_name.includes(queryName)) {
          setJoinSettings((prev) => ({ ...prev, isHost: true }));
        }
      } catch (err: any) {
        console.error("Meeting fetch error:", err);
        setError(err?.message || "Meeting does not exist or has already ended.");
      } finally {
        setLoading(false);
      }
    }

    if (meetingId) {
      fetchMeeting();
    }
  }, [meetingId, queryName, queryIsHost]);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#18181B] text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-11 h-11 rounded-xl bg-[#2D8CFF] flex items-center justify-center mb-3 shadow-lg animate-pulse">
          <Video className="w-5 h-5 fill-white stroke-none" />
        </div>
        <h2 className="text-base font-semibold text-slate-100 mb-1">Connecting to Zoom Meeting...</h2>
        <p className="text-xs text-slate-400 font-mono mb-4">Meeting ID: {meetingId}</p>
        <Loader2 className="w-5 h-5 text-[#2D8CFF] animate-spin" />
      </div>
    );
  }

  // Error / Not Found Screen
  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-[#18181B] text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-[#242731] border border-slate-700/80 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl animate-slide-up">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-3 border border-red-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Meeting Not Found</h2>
          <p className="text-xs text-slate-300 mb-5 leading-relaxed">
            {error || "The meeting ID or link you entered could not be found. It may have expired or been deleted."}
          </p>
          <div>
            <Link
              href="/"
              className="w-full py-2.5 bg-[#2D8CFF] hover:bg-[#1A73E8] active:bg-[#1557B0] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Pre-join Preview Screen
  if (!hasJoined) {
    return (
      <MeetingPreview
        meeting={meeting}
        initialName={joinSettings.displayName}
        initialAudio={joinSettings.audioEnabled}
        initialVideo={joinSettings.videoEnabled}
        onJoin={(settings) => {
          setJoinSettings((prev) => ({
            ...prev,
            displayName: settings.displayName,
            audioEnabled: settings.audioEnabled,
            videoEnabled: settings.videoEnabled,
          }));
          if (settings.stream) {
            setPreloadedStream(settings.stream);
          }
          setHasJoined(true);
        }}
      />
    );
  }

  // Active WebRTC Meeting Room
  return (
    <MeetingRoom
      meeting={meeting}
      displayName={joinSettings.displayName}
      initialAudioEnabled={joinSettings.audioEnabled}
      initialVideoEnabled={joinSettings.videoEnabled}
      isHost={joinSettings.isHost}
      initialStream={preloadedStream}
    />
  );
}
