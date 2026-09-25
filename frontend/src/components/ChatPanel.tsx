"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Send, MessageSquare } from "lucide-react";
import { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
}

export function ChatPanel({
  isOpen,
  onClose,
  messages,
  onSendMessage,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
  };

  return (
    <div className="w-72 sm:w-80 h-full bg-[#18181B] border-l border-zinc-800 flex flex-col z-20 animate-fade-in shadow-2xl font-sans">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#2D8CFF]" />
          <h3 className="font-semibold text-white text-xs sm:text-sm">Meeting Chat</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs px-4">
            <MessageSquare className="w-7 h-7 text-zinc-600 mb-1.5 stroke-[1.5]" />
            <p className="font-medium text-slate-400">No messages yet</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Messages will appear here for all attendees in this room.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.is_self ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-slate-400">
                <span className="font-medium text-slate-300">{msg.sender_name}</span>
                <span>•</span>
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs leading-relaxed break-words ${
                  msg.is_self
                    ? "bg-[#2D8CFF] text-white rounded-br-xs"
                    : "bg-[#27272A] text-slate-100 rounded-bl-xs border border-zinc-700/60"
                }`}
              >
                {msg.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <form onSubmit={handleSend} className="p-2.5 border-t border-zinc-800 bg-[#141417]">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="w-full pl-3 pr-9 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#2D8CFF] transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-1.5 p-1 text-[#2D8CFF] hover:text-blue-400 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
