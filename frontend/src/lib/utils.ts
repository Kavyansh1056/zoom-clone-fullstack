import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMeetingId(id: string): string {
  if (!id) return "";
  const cleaned = id.replace(/[^0-9]/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return id;
}

export function extractMeetingId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  // Check if it's a URL
  try {
    if (trimmed.includes("/") || trimmed.startsWith("http")) {
      const parts = trimmed.split("/");
      const lastPart = parts[parts.length - 1];
      if (lastPart) return lastPart;
    }
  } catch {
    // Ignore error and fallback
  }
  return trimmed;
}

export function formatDateTime(isoString: string | null | undefined): { date: string; time: string } {
  if (!isoString) {
    return { date: "Not scheduled", time: "" };
  }
  try {
    const d = parseISO(isoString);
    if (!isValid(d)) {
      const fallback = new Date(isoString);
      if (isValid(fallback)) {
        return {
          date: format(fallback, "EEE, MMM d, yyyy"),
          time: format(fallback, "h:mm a"),
        };
      }
      return { date: "Invalid Date", time: "" };
    }
    return {
      date: format(d, "EEE, MMM d, yyyy"),
      time: format(d, "h:mm a"),
    };
  } catch {
    return { date: "TBD", time: "" };
  }
}

export function getInitials(name: string): string {
  if (!name) return "U";
  const cleaned = name.replace(/\(You\)|\(Host\)/gi, "").trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
}
