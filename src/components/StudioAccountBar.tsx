"use client";

import { useEffect, useState } from "react";
import AccountAvatar from "@/components/AccountAvatar";
import {
  getActiveAccount,
  hydrateAccountsFromServer,
  loadAccounts,
  type AccountRecord,
} from "@/lib/student-profile";

type Props = {
  /** Dark cinema / studio surfaces use light-on-dark styling */
  tone?: "light" | "dark";
  /** Optional back control (e.g. leave a TED phase) */
  onBack?: () => void;
  backLabel?: string;
  className?: string;
};

/**
 * Persistent account strip for Studio / Entertainments pages.
 * Shows who owns the learning stats (TED + writing → BKT subjects).
 */
export function StudioAccountBar({
  tone = "light",
  onBack,
  backLabel = "Back",
  className = "",
}: Props) {
  const [acct, setAcct] = useState<AccountRecord | null>(null);

  useEffect(() => {
    const local = getActiveAccount(loadAccounts());
    setAcct(local);
    void hydrateAccountsFromServer().then((store) => {
      setAcct(getActiveAccount(store));
    });
  }, []);

  const name = acct?.profile.name || "Student";
  const grade = acct?.profile.grade;
  const id = acct?.id || "acct_ryan";
  const dark = tone === "dark";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium transition ${
              dark
                ? "text-[#a8b9ad] hover:bg-white/10 hover:text-[#eef6f0]"
                : "text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
            }`}
            aria-label={backLabel}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden
            >
              <polyline points="15,18 9,12 15,6" />
            </svg>
            <span className="hidden sm:inline">{backLabel}</span>
          </button>
        ) : null}
        <a
          href="/account"
          className={`flex min-w-0 items-center gap-2 rounded-full border px-2 py-1 transition ${
            dark
              ? "border-white/15 bg-black/25 hover:border-[#8fb896]/45"
              : "border-[var(--line)] bg-[var(--surface-muted)] hover:border-[var(--teal)]/40"
          }`}
          title="Switch or manage account — Studio learning counts toward this student"
        >
          <AccountAvatar accountId={id} name={name} size={26} />
          <span className="min-w-0">
            <span
              className={`block truncate text-[12px] font-semibold leading-tight sm:text-[13px] ${
                dark ? "text-[#f3faf5]" : "text-[var(--ink)]"
              }`}
            >
              {name}
            </span>
            <span
              className={`block truncate text-[10px] leading-tight ${
                dark ? "text-[#8fb896]" : "text-[var(--teal)]"
              }`}
            >
              {grade != null ? `G${grade}` : "Learner"} · subjects tracked
            </span>
          </span>
        </a>
      </div>
      <div className="flex items-center gap-1.5">
        <a
          href="/dashboard"
          className={`inline-flex min-h-9 items-center rounded-lg px-2.5 text-[11px] font-medium sm:text-[12px] ${
            dark
              ? "text-[#a8b9ad] hover:bg-white/10 hover:text-[#eef6f0]"
              : "text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
          }`}
        >
          Dashboard
        </a>
        <a
          href="/"
          className={`inline-flex min-h-9 items-center rounded-lg px-2.5 text-[11px] font-medium sm:text-[12px] ${
            dark
              ? "text-[#a8b9ad] hover:bg-white/10 hover:text-[#eef6f0]"
              : "text-[var(--ink-muted)] hover:bg-[var(--mist)] hover:text-[var(--ink)]"
          }`}
        >
          Home
        </a>
      </div>
    </div>
  );
}

/** Hook: active account id for Studio API calls */
export function useActiveStudioAccount(): {
  accountId: string;
  name: string;
  grade?: number;
} {
  const [state, setState] = useState({
    accountId: "acct_ryan",
    name: "Student",
    grade: undefined as number | undefined,
  });

  useEffect(() => {
    const apply = (a: AccountRecord) => {
      setState({
        accountId: a.id,
        name: a.profile.name,
        grade: a.profile.grade,
      });
    };
    apply(getActiveAccount(loadAccounts()));
    void hydrateAccountsFromServer().then((s) => apply(getActiveAccount(s)));
  }, []);

  return state;
}
