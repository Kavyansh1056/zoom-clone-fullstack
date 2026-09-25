import { Meeting, CreateMeetingInput, Participant } from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    try {
      const errData = await res.json();
      if (errData?.detail) {
        errorMsg = errData.detail;
      }
    } catch {
      // Ignore json parse error
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function getUpcomingMeetings(): Promise<Meeting[]> {
  return fetchJson<Meeting[]>("/api/meetings/upcoming");
}

export async function getRecentMeetings(): Promise<Meeting[]> {
  return fetchJson<Meeting[]>("/api/meetings/recent");
}

export async function getAllMeetings(): Promise<Meeting[]> {
  return fetchJson<Meeting[]>("/api/meetings");
}

export async function getMeetingById(meetingId: string): Promise<Meeting> {
  return fetchJson<Meeting>(`/api/meetings/${encodeURIComponent(meetingId)}`);
}

export async function createMeeting(data: CreateMeetingInput): Promise<Meeting> {
  return fetchJson<Meeting>("/api/meetings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function joinMeeting(meetingId: string, displayName: string, peerId?: string, isHost?: boolean): Promise<Participant> {
  return fetchJson<Participant>(`/api/meetings/${encodeURIComponent(meetingId)}/join`, {
    method: "POST",
    body: JSON.stringify({
      display_name: displayName,
      peer_id: peerId,
      is_host: !!isHost,
    }),
  });
}

export async function leaveMeeting(meetingId: string, displayName?: string, peerId?: string): Promise<{ message: string }> {
  return fetchJson<{ message: string }>(`/api/meetings/${encodeURIComponent(meetingId)}/leave`, {
    method: "POST",
    body: JSON.stringify({
      display_name: displayName,
      peer_id: peerId,
    }),
  });
}

export async function deleteMeeting(meetingId: string): Promise<{ message: string }> {
  return fetchJson<{ message: string }>(`/api/meetings/${encodeURIComponent(meetingId)}`, {
    method: "DELETE",
  });
}
