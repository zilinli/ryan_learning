"use client";

/**
 * AccountAvatar — colored circle with initial letter.
 * Color is derived deterministically from accountId hash, so the same
 * account always gets the same color across tabs/devices.
 */

const COLORS = [
  "bg-[var(--teal)]",
  "bg-[var(--coral)]",
  "bg-amber-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-fuchsia-500",
] as const;

function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(h) % COLORS.length]!;
}

export function getInitial(name: string): string {
  return (name || "?").charAt(0).toUpperCase();
}

export default function AccountAvatar({
  accountId,
  name,
  size = 28,
}: {
  accountId: string;
  name: string;
  size?: number;
}) {
  const initial = getInitial(name);
  const color = hashColor(accountId);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-white text-xs font-semibold ${color}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
