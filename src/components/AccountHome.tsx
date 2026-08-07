"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createAccount,
  getActiveAccount,
  loadAccounts,
  RYAN_ACCOUNT_ID,
  saveRyanAccount,
  switchAccount,
  type AccountsStore,
} from "@/lib/student-profile";

export function AccountHome() {
  const [store, setStore] = useState<AccountsStore | null>(null);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const loaded = loadAccounts();
    setStore(loaded);
    setName(getActiveAccount(loaded).profile.name);
  }, []);

  if (!store) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--ink-muted)]">
        Loading…
      </div>
    );
  }

  const active = getActiveAccount(store);

  const refresh = (next: AccountsStore) => {
    setStore(next);
    setName(getActiveAccount(next).profile.name);
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice("Type a name first.");
      return;
    }
    refresh(createAccount(trimmed, store));
    setNotice(`Saved account “${trimmed}”.`);
  };

  const handleSaveRyan = () => {
    refresh(saveRyanAccount(false, store));
    setNotice("Ryan is saved as another account — tap Switch to use it.");
  };

  const handleSwitch = (id: string) => {
    const next = switchAccount(id, store);
    refresh(next);
    const acct = next.accounts.find((a) => a.id === id);
    setNotice(`Switched to ${acct?.profile.name ?? "account"}.`);
  };

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="atmosphere-blob atmosphere-blob-a" />
        <div className="atmosphere-blob atmosphere-blob-b" />
        <div className="atmosphere-grain" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-10">
        <div className="animate-fade-up">
          <p className="font-[family-name:var(--font-display)] text-5xl text-[var(--ink)]">
            Accounts
          </p>
          <p className="mt-3 text-[var(--ink-muted)] leading-relaxed">
            Type a name, create an account, and switch anytime. Ryan stays saved
            as another account.
          </p>
        </div>

        <div className="mt-8 space-y-4 rounded-2xl border border-[var(--line)] bg-white/80 p-5 shadow-[0_16px_50px_-28px_rgba(15,60,70,0.5)] backdrop-blur animate-fade-up-delay">
          <p className="text-sm text-[var(--ink-muted)]">
            Active:{" "}
            <span className="font-medium text-[var(--ink)]">{active.profile.name}</span>
          </p>

          <label className="block text-sm text-[var(--ink-muted)]">
            Your name
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNotice("");
              }}
              placeholder="e.g. Alex"
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--teal)]"
              autoComplete="nickname"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleCreate}
              className="flex-1 rounded-full bg-[var(--teal)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-105"
            >
              Make account
            </button>
            <button
              type="button"
              onClick={handleSaveRyan}
              className="flex-1 rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
            >
              Save Ryan
            </button>
          </div>

          {notice ? (
            <p className="text-sm text-[var(--teal)]">{notice}</p>
          ) : null}

          <div className="border-t border-[var(--line)]/70 pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              Switch account
            </p>
            <ul className="flex flex-col gap-1.5">
              {store.accounts.map((a) => {
                const isActive = a.id === store.activeId;
                const isRyan = a.id === RYAN_ACCOUNT_ID;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      disabled={isActive}
                      onClick={() => handleSwitch(a.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
                        isActive
                          ? "bg-[var(--mist)] font-medium text-[var(--ink)]"
                          : "hover:bg-white/90 text-[var(--ink)]"
                      } disabled:cursor-default`}
                    >
                      <span>
                        {a.profile.name}
                        {isRyan ? (
                          <span className="ml-1.5 text-[11px] text-[var(--ink-muted)]">
                            saved
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[11px] text-[var(--teal)]">
                        {isActive ? "Current" : "Switch"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Continue to tutor →
          </Link>
        </div>
      </div>
    </div>
  );
}
