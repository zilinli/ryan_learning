import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  addCreation,
  deleteCreation,
  loadCreations,
} from "./creations-store";

const TEST_ACCT = "acct_test_studio";
const storeFile = path.join(
  process.cwd(),
  "data",
  "accounts",
  TEST_ACCT,
  "creations.json",
);

describe("creations-store", () => {
  beforeEach(async () => {
    try {
      await fs.unlink(storeFile);
    } catch {
      /* ok */
    }
  });

  afterEach(async () => {
    try {
      await fs.unlink(storeFile);
    } catch {
      /* ok */
    }
  });

  it("adds and lists creations", async () => {
    const empty = await loadCreations(TEST_ACCT);
    expect(empty.items).toHaveLength(0);
    const row = await addCreation(TEST_ACCT, {
      type: "song",
      title: "Demo",
      lyrics: "[Verse]\nhello",
      caption: "Indie mood",
    });
    expect(row.id).toBeTruthy();
    const store = await loadCreations(TEST_ACCT);
    expect(store.items[0].title).toBe("Demo");
  });

  it("deletes by id", async () => {
    const row = await addCreation(TEST_ACCT, {
      type: "ted_challenge",
      title: "TED · Demo",
      talkSlug: "test_talk",
    });
    expect(await deleteCreation(TEST_ACCT, row.id)).toBe(true);
    expect(await deleteCreation(TEST_ACCT, row.id)).toBe(false);
    const store = await loadCreations(TEST_ACCT);
    expect(store.items).toHaveLength(0);
  });
});
