import { NextResponse } from "next/server";
import {
  deleteServerAccount,
  readServerAccounts,
  readServerDeletedIds,
  writeServerAccounts,
} from "@/lib/accounts-store";
import type { AccountsStore } from "@/lib/student-profile";

/** GET — return the server-side accounts store (or null if none). */
export async function GET() {
  try {
    const store = await readServerAccounts();
    const deleted = await readServerDeletedIds();
    return NextResponse.json(
      store
        ? { accounts: store.accounts, deleted, version: store.version }
        : { accounts: null, deleted },
    );
  } catch {
    return NextResponse.json({ error: "Failed to read accounts" }, { status: 500 });
  }
}

/** PUT — upsert the full accounts store (last-write-wins, per-account merge). */
export async function PUT(req: Request) {
  let body: AccountsStore;
  try {
    body = (await req.json()) as AccountsStore;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || body.version !== 1 || !Array.isArray(body.accounts)) {
    return NextResponse.json({ error: "Invalid accounts payload" }, { status: 400 });
  }

  try {
    await writeServerAccounts(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to write accounts" }, { status: 500 });
  }
}

/** DELETE — permanently delete an account (?id=...) so other devices drop it too. */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    await deleteServerAccount(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
