"use client";

import { useEffect, useRef, useState } from "react";
import AccountAvatar from "./AccountAvatar";
import { RYAN_ACCOUNT_ID, type AccountRecord } from "@/lib/student-profile";

/**
 * AccountSwitcher — prominent top-right avatar button.
 *
 * Design pattern: follows Khan Academy Kids, ABCmouse, and shadcn/ui's
 * Multi-Account Switcher. Right-aligned avatar + name trigger, dropdown
 * with account list + "Manage accounts" action.
 *
 * Switching between existing accounts is PIN-free (kids can switch siblings).
 * Account creation and deletion remain PIN-gated via the Account page.
 */
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
      {/* Trigger — wide pill button: avatar + name + chevron */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 rounded-full border border-[var(--line)]/60 bg-[var(--surface-muted)] px-2.5 py-1.5 text-sm transition hover:bg-[var(--mist)] hover:border-[var(--teal)]/50 active:scale-95"
        aria-label={`${accountName} — tap to switch student`}
      >
        {active ? (
          <AccountAvatar
            accountId={active.id}
            name={active.profile.name}
            size={26}
          />
        ) : null}
        <span className="hidden sm:inline text-[13px] font-medium text-[var(--ink)] max-w-[80px] truncate">
          {accountName}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="text-[var(--ink-muted)] shrink-0"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] shadow-[0_16px_48px_-16px_rgba(15,60,70,0.35)] backdrop-blur-xl z-50 animate-fade-up origin-top-right">
          {/* Header */}
          <div className="px-4 pt-3.5 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Students
            </p>
          </div>

          {/* Account list */}
          <ul className="px-2 pb-1">
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
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      isActive
                        ? "bg-[var(--teal)]/8 cursor-default"
                        : "hover:bg-[var(--mist)] active:scale-[0.98]"
                    }`}
                  >
                    <AccountAvatar
                      accountId={a.id}
                      name={a.profile.name}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">
                        {a.profile.name}
                        {isRyan ? (
                          <span className="ml-1.5 text-[10px] font-normal text-[var(--ink-muted)]">
                            default
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-[11px] text-[var(--ink-muted)]">
                        {a.profile.school
                          ? `${a.profile.school} · `
                          : ""}
                        Grade {a.profile.grade}
                      </span>
                    </div>
                    {isActive ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[var(--teal)] shrink-0"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span className="text-[11px] text-[var(--ink-muted)] shrink-0">
                        Switch
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Manage accounts footer */}
          <div className="border-t border-[var(--line)]/60 px-2 py-2">
            <button
              type="button"
              onClick={() => {
                onManage();
                setOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[var(--ink-muted)] transition hover:bg-[var(--mist)] hover:text-[var(--ink)] active:scale-[0.98]"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Manage accounts
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
