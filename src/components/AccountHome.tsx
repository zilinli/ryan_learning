"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AccountAvatar from "./AccountAvatar";
import {
  createAccount,
  getActiveAccount,
  gradeBandForGrade,
  hydrateAccountsFromServer,
  loadAccounts,
  RYAN_ACCOUNT_ID,
  saveAccounts,
  saveRyanAccount,
  switchAccount,
  type AccountsStore,
} from "@/lib/student-profile";
import { TenantStorage } from "@/lib/tenant-storage";

const MAX_ACCOUNTS = 6;
const SUBJECTS = ["math", "science", "reading", "writing", "general"] as const;

export function AccountHome() {
  const [initialStore] = useState<AccountsStore>(loadAccounts);
  const [store, setStore] = useState<AccountsStore | null>(initialStore);
  const activeProfile = getActiveAccount(initialStore).profile;
  const [name, setName] = useState(activeProfile.name);
  const [grade, setGrade] = useState(activeProfile.grade);
  const [school, setSchool] = useState(activeProfile.school || "");
  const [subjects, setSubjects] = useState<string[]>(
    activeProfile.curriculum?.subjects?.length
      ? [...activeProfile.curriculum.subjects]
      : ["math"],
  );
  const [notice, setNotice] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void hydrateAccountsFromServer().then((hydrated) => {
      if (!cancelled) setStore(hydrated);
    });
    return () => {
      cancelled = true;
    };
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
    const prof = getActiveAccount(next).profile;
    setName(prof.name);
    setGrade(prof.grade);
    setSchool(prof.school || "");
    setSubjects(prof.curriculum?.subjects?.length
      ? [...prof.curriculum.subjects]
      : ["math"]);
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice("Type a name first.");
      return;
    }
    if (store.accounts.length >= MAX_ACCOUNTS) {
      setNotice(`${MAX_ACCOUNTS} accounts max. Remove one to add another.`);
      return;
    }
    refresh(createAccount(trimmed, {
      grade,
      school: school.trim(),
      curriculum: {
        label: school.trim() ? `${school.trim()} G${grade}` : `Grade ${grade}`,
        grade,
        subjects,
      },
    }, store));
    setNotice(`Created account "${trimmed}" (Grade ${grade}).`);
  };

  const handleUpdate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice("Type a name first.");
      return;
    }
    const now = Date.now();
    const next: AccountsStore = {
      ...store,
      accounts: store.accounts.map((a) =>
        a.id === store.activeId
          ? {
              ...a,
              profile: {
                ...a.profile,
                name: trimmed,
                grade,
                gradeBand: gradeBandForGrade(grade),
                school: school.trim(),
                curriculum: {
                  label: school.trim() ? `${school.trim()} G${grade}` : `Grade ${grade}`,
                  grade,
                  subjects,
                },
              },
              updatedAt: now,
            }
          : a,
      ),
    };
    saveAccounts(next);
    refresh(next);
    setNotice(`Updated ${trimmed}'s account.`);
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

  const handleDeleteStart = (id: string) => {
    const acct = store.accounts.find((a) => a.id === id);
    if (!acct || id === RYAN_ACCOUNT_ID) return;
    setDeleteConfirm(id);
    setDeleteStep(1);
  };

  const handleDeleteConfirm = () => {
    if (deleteStep === 1) {
      setDeleteStep(2);
    } else if (deleteStep === 2 && deleteConfirm) {
      // Do the deletion
      const storage = new TenantStorage(deleteConfirm);
      storage.clearAll();
      const remaining = store.accounts.filter((a) => a.id !== deleteConfirm);
      const nextActiveId = remaining[0]?.id || RYAN_ACCOUNT_ID;
      const next: AccountsStore = {
        version: 1,
        activeId: nextActiveId,
        accounts: remaining,
      };
      saveAccounts(next);
      refresh(next);
      setNotice(`Account deleted. Switched to ${getActiveAccount(next).profile.name}.`);
      setDeleteConfirm(null);
      setDeleteStep(0);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
    setDeleteStep(0);
  };

  const canCreate = store.accounts.length < MAX_ACCOUNTS;
  const isExisting = active.profile.name.trim().length > 0;
  const deleteTarget = deleteConfirm
    ? store.accounts.find((a) => a.id === deleteConfirm)
    : null;

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

        <div className="mt-8 space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 shadow-[0_16px_50px_-28px_rgba(15,60,70,0.5)] backdrop-blur animate-fade-up-delay">
          <p className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
            <AccountAvatar accountId={active.id} name={active.profile.name} size={20} />
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
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--teal)]"
              autoComplete="nickname"
            />
          </label>

          <label className="block text-sm text-[var(--ink-muted)]">
            Grade (1–12)
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--teal)]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-[var(--ink-muted)]">
            School (optional)
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. BASIS International"
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--teal)]"
            />
          </label>

          <fieldset className="text-sm text-[var(--ink-muted)]">
            <legend className="mb-1.5">Learning focus (pick subject areas)</legend>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => {
                const checked = subjects.includes(s);
                const label = s.charAt(0).toUpperCase() + s.slice(1);
                return (
                  <label
                    key={s}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                      checked
                        ? "border-[var(--teal)] bg-[var(--teal)]/5 text-[var(--teal)]"
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)] hover:border-[var(--teal)]/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSubjects((prev) =>
                          prev.includes(s)
                            ? prev.filter((x) => x !== s)
                            : [...prev, s],
                        );
                        setNotice("");
                      }}
                      className="sr-only"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 sm:flex-row">
            {isExisting ? (
              <button
                type="button"
                onClick={handleUpdate}
                className="flex-1 rounded-full bg-[var(--teal)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-105"
              >
                Update account
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate}
                className="flex-1 rounded-full bg-[var(--teal)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-50"
              >
                {canCreate ? "Make account" : `${MAX_ACCOUNTS} max`}
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveRyan}
              className="flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-3 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
            >
              Save Ryan
            </button>
          </div>

          {notice ? (
            <p className="text-sm text-[var(--teal)]">{notice}</p>
          ) : null}

          {/* Delete confirmation dialog */}
          {deleteTarget && deleteStep > 0 ? (
            <div className="rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/5 p-4 space-y-3">
              {deleteStep === 1 ? (
                <>
                  <p className="text-sm font-medium text-[var(--ink)]">
                    Delete {deleteTarget.profile.name}&apos;s account?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteConfirm}
                      className="flex-1 rounded-full bg-[var(--coral)] px-4 py-2 text-xs font-medium text-white transition hover:brightness-105"
                    >
                      Yes, continue
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCancel}
                      className="flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-[var(--coral)]">
                    All chat history, learning progress, and photos will be permanently removed.
                    This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteConfirm}
                      className="flex-1 rounded-full bg-[var(--coral)] px-4 py-2 text-xs font-medium text-white transition hover:brightness-105"
                    >
                      Delete forever
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCancel}
                      className="flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
                    >
                      Keep account
                    </button>
                  </div>
                </>
              )}
            </div>
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
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isActive}
                        onClick={() => handleSwitch(a.id)}
                        className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition focus-visible:ring-2 focus-visible:ring-[var(--teal)] ${
                          isActive
                            ? "bg-[var(--mist)] font-medium text-[var(--ink)]"
                            : "hover:bg-[var(--surface-muted)] text-[var(--ink)]"
                        } disabled:cursor-default`}
                      >
                        <AccountAvatar accountId={a.id} name={a.profile.name} size={22} />
                        <span className="flex-1 truncate">
                          {a.profile.name}
                          {isRyan ? (
                            <span className="ml-1.5 text-[11px] text-[var(--ink-muted)]">
                              saved
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[11px] text-[var(--teal)] shrink-0">
                          {isActive ? "Current" : "Switch"}
                        </span>
                      </button>
                      {!isRyan ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteStart(a.id)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--coral)]/10 hover:text-[var(--coral)]"
                          aria-label={`Delete ${a.profile.name}`}
                          title={`Delete ${a.profile.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-full bg-[var(--action-bg)] px-5 py-3 text-sm font-medium text-[var(--action-ink)] transition hover:opacity-90"
          >
            Continue to tutor →
          </Link>
        </div>
      </div>
    </div>
  );
}
