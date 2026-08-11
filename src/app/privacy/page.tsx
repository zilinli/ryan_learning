import Link from "next/link";

export const metadata = {
  title: "Privacy & data use · Spark AI Tutor",
  description:
    "Where Spark stores learning data on this private host, who can access it, and how to export or delete an account.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8 text-[var(--ink)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--teal)]">
        Families
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        Privacy &amp; data use
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">
        Spark is a{" "}
        <strong className="font-semibold text-[var(--ink)]">
          private, self-hosted
        </strong>{" "}
        tutor for a small set of family accounts — not a public SaaS. This page
        is the short note we share with parents.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">
          Where data lives
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-[var(--ink-muted)]">
          <li>
            Chat history and learning memory (BKT skills) are stored on{" "}
            <em>this server</em> under account-scoped JSON files, plus browser{" "}
            <code className="text-[13px]">localStorage</code> for the active
            device.
          </li>
          <li>
            Voice transcription for homework can run on a local STT service;
            dialect cloud STT/TTS (when enabled) sends only the audio/text needed
            for that request to the configured provider — not a permanent student
            profile on that vendor.
          </li>
          <li>
            Tutor replies use the Cursor-backed agent; prompts include the
            homework turn and learning-memory hints, not a third-party student
            CRM.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">
          Who can access what
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-[var(--ink-muted)]">
          <li>
            Each child account is isolated from other accounts on the same host.
          </li>
          <li>
            Parent PIN gates Code Agent, account delete, and parent digests /
            learning export on the dashboard.
          </li>
          <li>
            The host operator (family admin) can access server files for backup
            and recovery — treat the VPS like a home filing cabinet.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">
          Export &amp; delete
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-[var(--ink-muted)]">
          <li>
            Unlock the parent view on{" "}
            <Link
              href="/dashboard"
              className="font-medium text-[var(--teal)] underline-offset-2 hover:underline"
            >
              /dashboard
            </Link>{" "}
            to download a JSON learning snapshot for the active account.
          </li>
          <li>
            Account Home can permanently delete a non-default account (with
            confirmations). Ask the host admin if you need server-side history
            wiped as well.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 rounded-2xl border border-[var(--teal)]/25 bg-[var(--teal)]/5 p-4">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">
          For kids (simple version)
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-[var(--ink-muted)]">
          <li>
            Your chats and photos stay on{" "}
            <strong className="font-semibold text-[var(--ink)]">this family computer</strong>
            , not a big public website.
          </li>
          <li>
            Spark helps you think — it does not sell your homework or share it with
            classmates.
          </li>
          <li>
            A parent can turn on a PIN, download your learning notes, or delete an
            account if you ask.
          </li>
          <li>
            If something feels weird, tell a parent — they can open{" "}
            <Link
              href="/family"
              className="font-medium text-[var(--teal)] underline-offset-2 hover:underline"
            >
              Family controls
            </Link>
            .
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">
          Disclaimer
        </h2>
        <p className="text-[14px] leading-relaxed text-[var(--ink-muted)]">
          Spark is a Socratic study helper. It can be wrong — especially on math
          steps or OCR of handwriting. It does not replace teachers, parents, or
          professional advice. Use it as a thinking partner, not an answer key.
        </p>
      </section>

      <p className="mt-10 text-[13px] text-[var(--ink-muted)]">
        <Link
          href="/"
          className="font-medium text-[var(--teal)] underline-offset-2 hover:underline"
        >
          ← Back to tutor
        </Link>
        {" · "}
        Tutoring also supports 粤语, 客家话, 闽南话, 上海话, and more via the
        voice picker.
      </p>
    </main>
  );
}
