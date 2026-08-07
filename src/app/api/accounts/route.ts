import { NextResponse } from "next/server";
import { readServerAccounts, writeServerAccounts } from "@/lib/accounts-store";
import type { AccountsStore } from "@/lib/student-profile";

/** GET — return the server-side accounts store (or null if none). */
export async function GET() {
  try {
    const store = await readServerAccounts();
    return NextResponse.json(store ? { accounts: store.accounts, version: store.version } : { accounts: null });
  } catch {
    return NextResponse.json({ error: "Failed to read accounts" }, { status: 500 });
  }
}

/** PUT — upsert the full accounts store (last-write-wins). */
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
