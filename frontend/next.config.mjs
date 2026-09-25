/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Avoid double invocation of WebRTC effects in dev mode
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000",
  },
};

export default nextConfig;
