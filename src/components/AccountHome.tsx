"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AccountAvatar from "./AccountAvatar";
import {
  createAccount,
  englishLevelForGrade,
  getActiveAccount,
  gradeBandForGrade,
  hydrateAccountsFromServer,
  loadAccounts,
  pushAccountDeletion,
  RYAN_ACCOUNT_ID,
  saveAccounts,
  switchAccount,
  type AccountsStore,
  type EnglishLevel,
} from "@/lib/student-profile";
import { TenantStorage } from "@/lib/tenant-storage";

const MAX_ACCOUNTS = 6;
const SUBJECTS = ["math", "science", "reading", "writing", "general"] as const;

const ENGLISH_LEVEL_OPTIONS: Array<{ value: EnglishLevel; label: string }> = [
  { value: "emerging", label: "Emerging — short sentences, basic listening" },
  { value: "developing", label: "Developing — everyday school English (A2-ish)" },
  { value: "confident", label: "Confident — clear arguments, middle-school" },
  { value: "advanced", label: "Advanced — rigorous critique / debate" },
];

/** "new" = creating a brand-new account; otherwise an existing account id. */
type EditTarget = string | "new";

export function AccountHome() {
  const [initialStore] = useState<AccountsStore>(loadAccounts);
  const [store, setStore] = useState<AccountsStore | null>(initialStore);
  const initialActive = getActiveAccount(initialStore);
  const [editingId, setEditingId] = useState<EditTarget>(initialActive.id);
  const [name, setName] = useState(initialActive.profile.name);
  const [age, setAge] = useState(initialActive.profile.age);
  const [grade, setGrade] = useState(initialActive.profile.grade);
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>(
    initialActive.profile.englishLevel,
  );
  const [school, setSchool] = useState(initialActive.profile.school || "");
  const [subjects, setSubjects] = useState<string[]>(
    initialActive.profile.curriculum?.subjects?.length
      ? [...initialActive.profile.curriculum.subjects]
      : ["math"],
  );
  const [notice, setNotice] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void hydrateAccountsFromServer().then((hydrated) => {
      if (cancelled) return;
      setStore(hydrated);
      // Keep the form in sync unless the user is mid-edit of a local-only account
      // that the server doesn't know about yet.
      const editingStillExists =
        editingId === "new" ||
        hydrated.accounts.some((a) => a.id === editingId);
      if (!editingStillExists) {
        const active = getActiveAccount(hydrated);
        setEditingId(active.id);
        applyProfile(active.profile);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!store) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--ink-muted)]">
        Loading…
      </div>
    );
  }

  const active = getActiveAccount(store);

  const applyProfile = (p: typeof initialActive.profile) => {
    setName(p.name);
    setAge(p.age);
    setGrade(p.grade);
    setEnglishLevel(p.englishLevel);
    setSchool(p.school || "");
    setSubjects(
      p.curriculum?.subjects?.length ? [...p.curriculum.subjects] : ["math"],
    );
  };

  const startEditing = (id: string) => {
    setEditingId(id);
    const acct = store.accounts.find((a) => a.id === id);
    if (acct) applyProfile(acct.profile);
    setNotice("");
  };

  const startAdd = () => {
    if (!canCreate) return;
    setEditingId("new");
    setName("");
    setSchool("");
    setSubjects(["math"]);
    setGrade(4);
    setAge(9);
    setEnglishLevel("developing");
    setNotice("");
  };

  const cancelAdd = () => {
    const acct = getActiveAccount(store);
    setEditingId(acct.id);
    applyProfile(acct.profile);
    setNotice("");
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
    const next = createAccount(
      trimmed,
      {
        age,
        grade,
        englishLevel,
        school: school.trim(),
        curriculum: {
          label: school.trim() ? `${school.trim()} G${grade}` : `Grade ${grade}`,
          grade,
          subjects,
        },
      },
      store,
    );
    setStore(next);
    setEditingId(next.activeId);
    applyProfile(getActiveAccount(next).profile);
    setNotice(`Created account "${trimmed}" (Grade ${grade}).`);
  };

  const handleUpdate = () => {
    if (editingId === "new") return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice("Type a name first.");
      return;
    }
    const now = Date.now();
    const next: AccountsStore = {
      ...store,
      accounts: store.accounts.map((a) =>
        a.id === editingId
          ? {
              ...a,
              profile: {
                ...a.profile,
                name: trimmed,
                age,
                grade,
                gradeBand: gradeBandForGrade(grade),
                englishLevel,
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
    setStore(next);
    applyProfile(getActiveAccount(next).profile);
    setNotice(`Updated ${trimmed}'s account.`);
  };

  const handleSwitch = (id: string) => {
    const next = switchAccount(id, store);
    setStore(next);
    setEditingId(id);
    applyProfile(getActiveAccount(next).profile);
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
      // Notify the server so other devices drop this account too
      pushAccountDeletion(deleteConfirm);
      setStore(next);
      setEditingId(nextActiveId);
      applyProfile(getActiveAccount(next).profile);
      setNotice(
        `Account deleted. Switched to ${getActiveAccount(next).profile.name}.`,
      );
      setDeleteConfirm(null);
      setDeleteStep(0);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
    setDeleteStep(0);
  };

  const canCreate = store.accounts.length < MAX_ACCOUNTS;
  const isNewMode = editingId === "new";
  const editingAccount = isNewMode
    ? null
    : store.accounts.find((a) => a.id === editingId);
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
            Add a profile for each student, edit their details, and switch
            anytime. Ryan&apos;s profile is the default and can&apos;t be deleted.
          </p>
        </div>

        {/* Account list */}
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 shadow-[0_16px_50px_-28px_rgba(15,60,70,0.5)] backdrop-blur animate-fade-up-delay">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
            Profiles
          </p>
          <ul className="flex flex-col gap-1.5">
            {store.accounts.map((a) => {
              const isActive = a.id === store.activeId;
              const isRyan = a.id === RYAN_ACCOUNT_ID;
              return (
                <li key={a.id}>
                  <div
                    className={`flex items-center gap-1 rounded-xl border px-3 py-2.5 transition ${
                      isActive
                        ? "border-[var(--teal)]/30 bg-[var(--teal)]/5"
                        : "border-transparent hover:bg-[var(--surface)]"
                    }`}
                  >
                    <AccountAvatar accountId={a.id} name={a.profile.name} size={30} />
                    <div className="ml-1 min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">
                        {a.profile.name}
                        {isRyan ? (
                          <span className="ml-1.5 rounded-full bg-[var(--mist)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--ink-muted)]">
                            Default
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[11px] text-[var(--ink-muted)]">
                        {isRyan
                          ? "Default profile — always kept"
                          : `Grade ${a.profile.grade}${a.profile.school ? ` · ${a.profile.school}` : ""}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isActive}
                      onClick={() => handleSwitch(a.id)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? "bg-[var(--teal)]/10 text-[var(--teal)]"
                          : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--teal)]"
                      } disabled:cursor-default`}
                    >
                      {isActive ? "Current" : "Switch"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditing(a.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:bg-[var(--mist)] hover:text-[var(--ink)]"
                      aria-label={`Edit ${a.profile.name}`}
                      title={`Edit ${a.profile.name}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
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
          <button
            type="button"
            onClick={startAdd}
            disabled={!canCreate}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] px-4 py-3 text-sm font-medium text-[var(--ink-muted)] transition hover:border-[var(--teal)] hover:text-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {canCreate ? "Add profile" : `${MAX_ACCOUNTS} profiles max`}
          </button>
        </div>

        {/* Edit / create form */}
        <div className="mt-4 space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] p-5 backdrop-blur animate-fade-up-delay">
          <p className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
            {isNewMode ? (
              <>
                <span className="font-medium text-[var(--ink)]">New profile</span>
                — add a student account
              </>
            ) : (
              <>
                <AccountAvatar
                  accountId={editingAccount?.id ?? active.id}
                  name={editingAccount?.profile.name ?? active.profile.name}
                  size={20}
                />
                Editing:{" "}
                <span className="font-medium text-[var(--ink)]">
                  {editingAccount?.profile.name ?? active.profile.name}
                </span>
              </>
            )}
          </p>

          <label className="block text-sm text-[var(--ink-muted)]">
            Name
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
              onChange={(e) => {
                const g = Number(e.target.value);
                setGrade(g);
                // Keep English level aligned with grade band unless parent already
                // picked a non-default; still offer explicit override below.
                setEnglishLevel(englishLevelForGrade(g));
                setNotice("");
              }}
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
            Age (years)
            <input
              type="number"
              min={4}
              max={18}
              value={age}
              onChange={(e) => {
                const n = Number(e.target.value);
                setAge(Number.isFinite(n) ? Math.max(4, Math.min(18, Math.round(n))) : 9);
                setNotice("");
              }}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--teal)]"
            />
          </label>

          <label className="block text-sm text-[var(--ink-muted)]">
            English level (TED & listening)
            <select
              value={englishLevel}
              onChange={(e) => {
                setEnglishLevel(e.target.value as EnglishLevel);
                setNotice("");
              }}
              className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--teal)]"
            >
              {ENGLISH_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
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
            {isNewMode ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate}
                className="flex-1 rounded-full bg-[var(--teal)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-50"
              >
                {canCreate ? "Create profile" : `${MAX_ACCOUNTS} max`}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUpdate}
                className="flex-1 rounded-full bg-[var(--teal)] px-5 py-3 text-sm font-medium text-white transition hover:brightness-105"
              >
                Save changes
              </button>
            )}
            {isNewMode ? (
              <button
                type="button"
                onClick={cancelAdd}
                className="flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-3 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--mist)]"
              >
                Cancel
              </button>
            ) : null}
          </div>

          {notice ? (
            <p className="text-sm text-[var(--teal)]">{notice}</p>
          ) : null}
        </div>

        {/* Delete confirmation dialog */}
        {deleteTarget && deleteStep > 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--coral)]/30 bg-[var(--coral)]/5 p-4 space-y-3">
            {deleteStep === 1 ? (
              <>
                <p className="text-sm font-medium text-[var(--ink)]">
                  Delete {deleteTarget.profile.name}&apos;s profile?
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
                  All chat history, learning progress, and photos will be
                  permanently removed. This cannot be undone.
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
                    Keep profile
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        <Link
          href="/"
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[var(--action-bg)] px-5 py-3 text-sm font-medium text-[var(--action-ink)] transition hover:opacity-90"
        >
          Continue to tutor →
        </Link>
      </div>
    </div>
  );
}
