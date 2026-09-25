"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, AlertCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Meeting } from "@/lib/types";
import { getInitials } from "@/lib/utils";
import { DEFAULT_USER_NAME } from "@/lib/constants";

interface MeetingPreviewProps {
  meeting: Meeting;
  initialName?: string;
  initialAudio?: boolean;
  initialVideo?: boolean;
  onJoin: (settings: {
    displayName: string;
    audioEnabled: boolean;
    videoEnabled: boolean;
    stream?: MediaStream | null;
  }) => void;
}

export function MeetingPreview({
  meeting,
  initialName = DEFAULT_USER_NAME,
  initialAudio = true,
  initialVideo = true,
  onJoin,
}: MeetingPreviewProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [audioEnabled, setAudioEnabled] = useState(initialAudio);
  const [videoEnabled, setVideoEnabled] = useState(initialVideo);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function setupPreviewStream() {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch (err: any) {
        console.warn("[Preview] Combined getUserMedia failed, trying individual devices:", err);
        let videoTrack: MediaStreamTrack | null = null;
        let audioTrack: MediaStreamTrack | null = null;

        try {
          const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoTrack = vStream.getVideoTracks()[0] || null;
        } catch (vErr) {
          console.warn("[Preview] Video device unavailable:", vErr);
        }

        try {
          const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioTrack = aStream.getAudioTracks()[0] || null;
        } catch (aErr) {
          console.warn("[Preview] Audio device unavailable:", aErr);
        }

        if (videoTrack || audioTrack) {
          stream = new MediaStream();
          if (videoTrack) stream.addTrack(videoTrack);
          if (audioTrack) stream.addTrack(audioTrack);
        } else {
          if (!mounted) return;
          setHasPermission(false);
          if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
            setStreamError("Camera or microphone permission was denied. You can join with media off.");
          } else {
            setStreamError("No physical camera or microphone detected. You can join with media off.");
          }
        }
      }

      if (!mounted) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (stream) {
        streamRef.current = stream;

        // Apply initial toggles
        stream.getAudioTracks().forEach((t) => (t.enabled = initialAudio));
        stream.getVideoTracks().forEach((t) => (t.enabled = initialVideo));
        setHasPermission(true);

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.defaultMuted = true;

          const playVideo = () => {
            if (video.paused) {
              video.play().catch((playErr) => {
                if (playErr.name !== "AbortError") {
                  console.warn("[Preview] Video play() failed:", playErr);
                }
              });
            }
          };

          video.addEventListener("loadedmetadata", playVideo);
          playVideo();
        }
      }
    }

    setupPreviewStream();

    return () => {
      mounted = false;
      // CRITICAL: Only stop preview tracks if the user navigates away WITHOUT joining.
      // If the user clicked Join, the stream is transferred to MeetingRoom.
      if (!hasJoinedRef.current && streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [initialAudio, initialVideo]);

  // Keep video element srcObject synced when toggling video
  useEffect(() => {
    const video = videoRef.current;
    if (video && streamRef.current && videoEnabled) {
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      video.muted = true;
      video.defaultMuted = true;
      video.play().catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("[Preview] Toggle play error:", err);
        }
      });
    }
  }, [videoEnabled]);

  const toggleAudio = () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = nextState));
    }
  };

  const toggleVideo = () => {
    const nextState = !videoEnabled;
    setVideoEnabled(nextState);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => (t.enabled = nextState));
    }
  };

  const handleJoinClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    // Mark as joined so the unmount cleanup DOES NOT stop the camera tracks!
    hasJoinedRef.current = true;

    onJoin({
      displayName: displayName.trim(),
      audioEnabled,
      videoEnabled,
      stream: streamRef.current,
    });
  };

  return (
    <div className="min-h-screen bg-[#18181B] text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      {/* Top Bar */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs sm:text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700/60">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Encrypted WebRTC Session</span>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="max-w-4xl mx-auto w-full my-auto py-6">
        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1.5">
            Ready to join?
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {meeting.title} <span className="text-slate-500 font-mono">({meeting.meeting_id})</span>
          </p>
        </div>

        {streamError && (
          <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{streamError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-[#242731] p-5 sm:p-7 rounded-2xl border border-zinc-700/80 shadow-2xl">
          {/* Video Preview Box (7 cols) */}
          <div className="md:col-span-7 flex flex-col items-center">
            <div className="relative w-full aspect-video bg-[#121316] rounded-xl overflow-hidden border border-zinc-700 shadow-inner flex items-center justify-center">
              {/* Actual Video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  !videoEnabled || hasPermission === false ? "hidden" : "block"
                }`}
              />

              {/* Avatar placeholder when video is off */}
              {(!videoEnabled || hasPermission === false) && (
                <div className="flex flex-col items-center justify-center animate-fade-in select-none">
                  <div className="w-20 h-20 rounded-full bg-[#2D8CFF] text-white font-bold text-2xl flex items-center justify-center shadow-md mb-2">
                    {getInitials(displayName)}
                  </div>
                  <span className="text-xs text-slate-400">
                    {hasPermission === false ? "Camera unavailable" : "Camera is off"}
                  </span>
                </div>
              )}

              {/* Floating Media Toggles */}
              <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-2.5 bg-zinc-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-zinc-700/80 shadow-lg">
                <button
                  type="button"
                  onClick={toggleAudio}
                  title={audioEnabled ? "Mute Microphone" : "Unmute Microphone"}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    audioEnabled
                      ? "bg-zinc-700/80 hover:bg-zinc-600 text-white"
                      : "bg-[#E02828] hover:bg-red-600 text-white"
                  }`}
                >
                  {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  title={videoEnabled ? "Stop Video" : "Start Video"}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    videoEnabled
                      ? "bg-zinc-700/80 hover:bg-zinc-600 text-white"
                      : "bg-[#E02828] hover:bg-red-600 text-white"
                  }`}
                >
                  {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Form and Join Button (5 cols) */}
          <div className="md:col-span-5 flex flex-col justify-center">
            <form onSubmit={handleJoinClick} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full px-3.5 py-2.5 bg-[#18181B] border border-zinc-600 focus:border-[#2D8CFF] rounded-lg text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2D8CFF]/20 transition-all font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5 py-1 text-xs text-slate-400">
                <div className="flex items-center justify-between py-0.5">
                  <span>Microphone:</span>
                  <span className={audioEnabled ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                    {audioEnabled ? "Unmuted" : "Muted"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span>Camera:</span>
                  <span className={videoEnabled ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                    {videoEnabled ? "Video On" : "Video Off"}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#2D8CFF] hover:bg-[#1A73E8] active:bg-[#1557B0] text-white font-semibold text-xs sm:text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Join Meeting</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-4xl mx-auto w-full text-center text-[11px] text-slate-500">
        Zoom Video Conferencing Platform • WebRTC Mesh & WebSocket Gateway
      </div>
    </div>
  );
}
