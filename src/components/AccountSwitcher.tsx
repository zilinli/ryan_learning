"use client";

import { useEffect, useRef, useState } from "react";
import AccountAvatar from "./AccountAvatar";
import { RYAN_ACCOUNT_ID, type AccountRecord } from "@/lib/student-profile";

export default function AccountSwitcher({
  accounts,
  activeId,
  accountName,
  onSwitch,
  onManage,
}: {
  accounts: AccountRecord[];
  activeId: string;
  accountName: string;
  onSwitch: (accountId: string) => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [open]);

  const active = accounts.find((a) => a.id === activeId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-[var(--ink-muted)] transition hover:bg-[var(--mist)] hover:text-[var(--ink)]"
        aria-label={`${accountName} — switch account`}
        title="Switch account"
      >
        {active ? (
          <AccountAvatar accountId={active.id} name={active.profile.name} size={22} />
        ) : null}
        <span className="hidden sm:inline text-[13px] font-medium">{accountName}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-[var(--line)] bg-white/95 shadow-xl backdrop-blur z-50 animate-fade-up">
          <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            Switch student
          </p>
          <ul className="space-y-0.5 px-2 pb-2">
            {accounts.map((a) => {
              const isActive = a.id === activeId;
              const isRyan = a.id === RYAN_ACCOUNT_ID;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={isActive}
                    onClick={() => {
                      onSwitch(a.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      isActive
                        ? "bg-[var(--mist)] font-medium text-[var(--ink)] cursor-default"
                        : "hover:bg-[var(--mist)] text-[var(--ink)]"
                    }`}
                  >
                    <AccountAvatar accountId={a.id} name={a.profile.name} size={24} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {a.profile.name}
                        {isRyan ? (
                          <span className="ml-1 text-[10px] text-[var(--ink-muted)]">
                            default
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-[11px] text-[var(--ink-muted)]">
                        Grade {a.profile.grade}
                      </span>
                    </div>
                    <span className={`text-[11px] ${isActive ? "text-[var(--teal)] font-medium" : "text-[var(--ink-muted)]"}`}>
                      {isActive ? "Active" : "Switch"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[var(--line)]/60 px-2 pb-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onManage();
                setOpen(false);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm text-[var(--ink-muted)] transition hover:bg-[var(--mist)] hover:text-[var(--ink)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Manage accounts
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
