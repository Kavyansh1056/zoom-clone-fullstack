"use client";

import { useState, useEffect, useRef } from "react";

export type ConnectionQualityLevel = "excellent" | "good" | "poor" | "connecting";

export interface ConnectionQualityStats {
  quality: ConnectionQualityLevel;
  rttMs: number | null;
  packetsLost: number | null;
  packetsReceived: number | null;
  packetLossPercent: number | null;
  iceState: string;
  connectionState: string;
  isAvailable: boolean;
  peerCount: number;
}

interface UseConnectionQualityProps {
  peerConnections?: React.MutableRefObject<Map<string, RTCPeerConnection>> | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  peerCount: number;
}

export function useConnectionQuality({
  peerConnections,
  connectionStatus,
  peerCount,
}: UseConnectionQualityProps): ConnectionQualityStats {
  const [stats, setStats] = useState<ConnectionQualityStats>({
    quality: connectionStatus === "connected" ? "good" : "connecting",
    rttMs: null,
    packetsLost: null,
    packetsReceived: null,
    packetLossPercent: null,
    iceState: "connected",
    connectionState: connectionStatus,
    isAvailable: false,
    peerCount,
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (connectionStatus !== "connected") {
      setStats((prev) => ({
        ...prev,
        quality: "connecting",
        connectionState: connectionStatus,
        peerCount,
      }));
      return;
    }

    if (!peerConnections || !peerConnections.current || peerConnections.current.size === 0) {
      setStats({
        quality: "good",
        rttMs: null,
        packetsLost: null,
        packetsReceived: null,
        packetLossPercent: null,
        iceState: "connected",
        connectionState: "connected",
        isAvailable: true,
        peerCount,
      });
      return;
    }

    let intervalId: NodeJS.Timeout;

    const pollWebRTCStats = async () => {
      try {
        if (!peerConnections.current) return;

        let totalRttMs = 0;
        let rttSamples = 0;
        let totalLost = 0;
        let totalReceived = 0;
        let primaryIceState = "connected";
        let primaryConnState = "connected";
        let hasValidStats = false;

        const pcs = Array.from(peerConnections.current.values());

        for (const pc of pcs) {
          if (!pc || pc.signalingState === "closed") continue;

          primaryIceState = pc.iceConnectionState || primaryIceState;
          primaryConnState = pc.connectionState || primaryConnState;

          // Check if peer is currently connecting/checking
          if (
            pc.iceConnectionState === "checking" ||
            pc.connectionState === "connecting"
          ) {
            primaryConnState = "connecting";
          }

          // Query WebRTC getStats()
          const report = await pc.getStats().catch(() => null);
          if (!report) continue;

          report.forEach((stat: any) => {
            // 1. Candidate-Pair for Round Trip Time (RTT)
            if (
              stat.type === "candidate-pair" &&
              (stat.state === "succeeded" || stat.nominated || stat.selected)
            ) {
              const rttSeconds = stat.currentRoundTripTime ?? stat.roundTripTime;
              if (typeof rttSeconds === "number" && rttSeconds >= 0) {
                totalRttMs += Math.round(rttSeconds * 1000);
                rttSamples++;
                hasValidStats = true;
              }
            }

            // 2. Inbound RTP for packet loss calculation
            if (stat.type === "inbound-rtp") {
              if (typeof stat.packetsLost === "number" && stat.packetsLost >= 0) {
                totalLost += stat.packetsLost;
                hasValidStats = true;
              }
              if (typeof stat.packetsReceived === "number" && stat.packetsReceived >= 0) {
                totalReceived += stat.packetsReceived;
                hasValidStats = true;
              }
            }
          });
        }

        if (!isMountedRef.current) return;

        // Calculate averages
        const avgRtt = rttSamples > 0 ? Math.round(totalRttMs / rttSamples) : null;
        const totalPackets = totalReceived + totalLost;
        const packetLossRate =
          totalPackets > 0 ? (totalLost / totalPackets) * 100 : null;

        // Determine simple, understandable connection quality level
        let computedQuality: ConnectionQualityLevel = "good";

        if (
          primaryConnState === "connecting" ||
          primaryIceState === "checking" ||
          primaryIceState === "new"
        ) {
          computedQuality = "connecting";
        } else if (
          primaryConnState === "failed" ||
          primaryIceState === "failed" ||
          (avgRtt !== null && avgRtt > 350) ||
          (packetLossRate !== null && packetLossRate > 7)
        ) {
          computedQuality = "poor";
        } else if (
          (avgRtt === null || avgRtt < 120) &&
          (packetLossRate === null || packetLossRate < 1.5)
        ) {
          computedQuality = "excellent";
        } else {
          computedQuality = "good";
        }

        setStats({
          quality: computedQuality,
          rttMs: avgRtt,
          packetsLost: totalPackets > 0 ? totalLost : null,
          packetsReceived: totalPackets > 0 ? totalReceived : null,
          packetLossPercent:
            packetLossRate !== null
              ? parseFloat(packetLossRate.toFixed(1))
              : null,
          iceState: primaryIceState,
          connectionState: primaryConnState,
          isAvailable: hasValidStats || primaryConnState === "connected",
          peerCount,
        });
      } catch (err) {
        if (isMountedRef.current) {
          setStats((prev) => ({
            ...prev,
            quality: "good",
            isAvailable: false,
            peerCount,
          }));
        }
      }
    };

    // Initial check and periodic poll every 2.5 seconds
    pollWebRTCStats();
    intervalId = setInterval(pollWebRTCStats, 2500);

    return () => {
      clearInterval(intervalId);
    };
  }, [peerConnections, connectionStatus, peerCount]);

  return stats;
}
