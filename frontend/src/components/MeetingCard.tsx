"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Clock, Copy, Check, Video, Calendar, User, Trash2 } from "lucide-react";
import { Meeting } from "@/lib/types";
import { formatDateTime, copyToClipboard, formatMeetingId } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface MeetingCardProps {
  meeting: Meeting;
  onDelete?: (meetingId: string) => void;
  isUpcoming?: boolean;
}

export function MeetingCard({ meeting, onDelete, isUpcoming = true }: MeetingCardProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { date, time } = formatDateTime(meeting.scheduled_at || meeting.created_at);

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const inviteUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/meeting/${meeting.meeting_id}`
        : meeting.invite_link;
    const success = await copyToClipboard(inviteUrl);
    if (success) {
      setCopied(true);
      showToast("Meeting invite link copied!", "success");
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast("Failed to copy link", "error");
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete meeting "${meeting.title}"?`)) {
      setDeleting(true);
      if (onDelete) {
        onDelete(meeting.meeting_id);
      }
    }
  };

  const getStatusBadge = () => {
    switch (meeting.status) {
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        );
      case "scheduled":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-[#2D8CFF] border border-blue-100">
            Scheduled
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Ended
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Header: Date/Time & Status */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {date}
            </span>
            {time && (
              <span className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {time}
              </span>
            )}
            <span className="text-slate-400">· {meeting.duration}m</span>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {/* Meeting Title & Description */}
        <h3 className="font-semibold text-slate-900 text-sm group-hover:text-[#2D8CFF] transition-colors line-clamp-1">
          {meeting.title}
        </h3>
        {meeting.description && (
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
            {meeting.description}
          </p>
        )}

        {/* Meeting Meta (ID and Host) */}
        <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px]">ID:</span>
            <span className="font-mono font-medium text-slate-700 text-[11px]">
              {formatMeetingId(meeting.meeting_id)}
            </span>
          </div>
          <div className="flex items-center gap-1 max-w-[150px] truncate text-[11px]">
            <User className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{meeting.host_name}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          {isUpcoming || meeting.status === "in_progress" ? (
            <Link
              href={`/meeting/${meeting.meeting_id}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#2D8CFF] hover:bg-[#1A73E8] active:bg-[#1557B0] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Video className="w-3.5 h-3.5 fill-white stroke-none" />
              <span>{meeting.status === "in_progress" ? "Join" : "Start"}</span>
            </Link>
          ) : (
            <Link
              href={`/meeting/${meeting.meeting_id}`}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              Start Again
            </Link>
          )}

          <button
            onClick={handleCopyLink}
            title="Copy Invite Link"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Invite</span>
              </>
            )}
          </button>
        </div>

        {onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete Meeting"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
