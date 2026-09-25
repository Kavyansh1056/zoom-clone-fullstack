import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Zoom - Video Conferencing, Cloud Phone, Webinars, Chat",
  description: "Modern, professional video conferencing platform clone inspired by Zoom.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#F7F9FA] text-slate-800">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
