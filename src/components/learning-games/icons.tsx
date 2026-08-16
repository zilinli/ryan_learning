"use client";

import type { LearningGameId } from "./tokens";

/**
 * Shared SVG icon set for Learning Games (learning-games-v2.md §5.3).
 * Linear, geometric marks — no emoji. Each icon keeps its game's accent tone.
 */

export function GameIcon({
  id,
  size = 28,
  tone = "currentColor",
}: {
  id: LearningGameId | string;
  size?: number;
  tone?: string;
}) {
  switch (id) {
    case "fraction-voyager":
      return <ShipIcon size={size} tone={tone} />;
    case "force-bay":
      return <BargeIcon size={size} tone={tone} />;
    case "energy-chain":
      return <CircuitIcon size={size} tone={tone} />;
    case "orbit-scout":
      return <OrbitIcon size={size} tone={tone} />;
    case "eco-genesis":
      return <LeafIcon size={size} tone={tone} />;
    case "time-vault":
      return <ArchiveIcon size={size} tone={tone} />;
    case "word-echo":
      return <EchoIcon size={size} tone={tone} />;
    default:
      return <DotIcon size={size} tone={tone} />;
  }
}

function ShipIcon({ size, tone }: { size: number; tone: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3 L19 18 L12 13 L5 18 Z" fill={tone} />
      <path d="M12 18 L14 21 L12 19 L10 21 Z" fill={tone} opacity={0.55} />
    </svg>
  );
}

function BargeIcon({ size, tone }: { size: number; tone: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M4 15 L20 15 L17 20 L7 20 Z" fill={tone} />
      <path d="M12 3 L18 12 L12 12 Z" fill={tone} opacity={0.55} />
      <rect x={11} y={3} width={2} height={16} rx={1} fill={tone} opacity={0.4} />
    </svg>
  );
}

function CircuitIcon({ size, tone }: { size: number; tone: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x={3} y={8} width={8} height={9} rx={1.5} fill="none" stroke={tone} strokeWidth={1.8} />
      <rect x={13} y={5} width={8} height={11} rx={1.5} fill="none" stroke={tone} strokeWidth={1.8} />
      <circle cx={7} cy={12.5} r={1.4} fill={tone} />
      <circle cx={17} cy={10.5} r={1.4} fill={tone} />
      <line x1={11} y1={12} x2={13} y2={11} stroke={tone} strokeWidth={1.4} />
    </svg>
  );
}

function OrbitIcon({ size, tone }: { size: number; tone: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={5} fill={tone} opacity={0.85} />
      <ellipse cx={12} cy={12} rx={10} ry={4} fill="none" stroke={tone} strokeWidth={1.6} transform="rotate(-18 12 12)" />
      <circle cx={21} cy={10} r={1.3} fill={tone} />
    </svg>
  );
}

function LeafIcon({ size, tone }: { size: number; tone: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 21 L12 10" stroke={tone} strokeWidth={1.8} />
      <path d="M12 12 C8 12 6 9 6 5 C10 5 12 8 12 12 Z" fill={tone} />
      <path d="M12 10 C16 10 18 7 18 3 C14 3 12 6 12 10 Z" fill={tone} opacity={0.55} />
    </svg>
  );
}

function ArchiveIcon({ size, tone }: { size: number; tone: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x={5} y={6} width={14} height={13} rx={2} fill="none" stroke={tone} strokeWidth={1.8} />
      <rect x={8} y={3} width={8} height={4} rx={1} fill={tone} />
      <line x1={8} y1={11} x2={16} y2={11} stroke={tone} strokeWidth={1.4} />
      <line x1={8} y1={15} x2={16} y2={15} stroke={tone} strokeWidth={1.4} />
    </svg>
  );
}

function EchoIcon({ size, tone }: { size: number; tone: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={3} fill={tone} />
      <path
        d="M7 12 C9 8, 11 7, 12 7 C13 7, 15 8, 17 12 C15 16, 13 17, 12 17 C11 17, 9 16, 7 12 Z"
        fill="none"
        stroke={tone}
        strokeWidth={1.6}
      />
      <path d="M3 12 H6" stroke={tone} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
      <path d="M18 12 H21" stroke={tone} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
    </svg>
  );
}

function DotIcon({ size, tone }: { size: number; tone: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={5} fill={tone} />
    </svg>
  );
}
