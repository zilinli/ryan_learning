import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { addCreation } from "./creations-store";
import { buildTimeline, localDay, timelineMonths } from "./journal-model";
import {
  appendCreationToJournal,
  createJournalEntry,
  deleteJournalEntry,
  loadJournal,
  removeJournalMadeBlock,
  updateJournalEntry,
} from "./journal-store";

const ACCT = "acct_test_journal";
const dir = path.join(process.cwd(), "data", "accounts", ACCT);
const journalFile = path.join(dir, "journal.json");
const creationsFile = path.join(dir, "creations.json");

async function wipe() {
  for (const f of [journalFile, creationsFile]) {
    try {
      await fs.unlink(f);
    } catch {
      /* ok */
    }
  }
}

describe("journal-store", () => {
  beforeEach(wipe);
  afterEach(wipe);

  it("creates a student entry", async () => {
    const row = await createJournalEntry(ACCT, {
      body: "Rain on the bus window.",
      date: "2026-08-12",
    });
    expect(row.id).toMatch(/^je_/);
    expect(row.source).toBe("student");
    expect(row.date).toBe("2026-08-12");
    const store = await loadJournal(ACCT);
    expect(store.items).toHaveLength(1);
  });

  it("appends a Creation to today without a second empty day", async () => {
    await createJournalEntry(ACCT, {
      body: "What I noticed.",
      date: localDay(),
    });
    const song = await addCreation(ACCT, {
      type: "song",
      title: "Hold the light",
      lyrics: "[Verse]\nhello",
      caption: "Hip-hop",
    });
    const day = await appendCreationToJournal(ACCT, song);
    expect(day.body).toMatch(/noticed/i);
    expect(day.made).toHaveLength(1);
    expect(day.made[0]?.title).toBe("Hold the light");
    expect(day.source).toBe("mixed");
    const store = await loadJournal(ACCT);
    expect(store.items.filter((e) => e.date === localDay())).toHaveLength(1);
  });

  it("creates a creation-only day when journal is empty", async () => {
    const day = await appendCreationToJournal(
      ACCT,
      {
        id: "cr_fake_1",
        type: "song",
        title: "Untitled song",
        createdAt: Date.parse("2026-01-02T12:00:00"),
        accountId: ACCT,
        lyrics: "[Chorus]\nx",
      },
      "2026-01-02",
    );
    expect(day.source).toBe("creation");
    expect(day.made).toHaveLength(1);
    expect(day.body).toBe("");
    expect(day.date).toBe("2026-01-02");
  });

  it("does not duplicate the same creationId", async () => {
    const song = await addCreation(ACCT, {
      type: "song",
      title: "Once",
      lyrics: "x",
    });
    await appendCreationToJournal(ACCT, song, "2026-03-01");
    await appendCreationToJournal(ACCT, song, "2026-03-01");
    const store = await loadJournal(ACCT);
    expect(store.items[0]?.made).toHaveLength(1);
  });

  it("update and delete leave creations alone", async () => {
    const row = await createJournalEntry(ACCT, { body: "Hi", date: "2026-08-01" });
    const updated = await updateJournalEntry(ACCT, row.id, { body: "Hello there" });
    expect(updated?.body).toBe("Hello there");
    expect(await deleteJournalEntry(ACCT, row.id)).toBe(true);
    expect((await loadJournal(ACCT)).items).toHaveLength(0);
  });

  it("removes a made block but keeps prose on the entry", async () => {
    const row = await createJournalEntry(ACCT, {
      body: "I wrote this.",
      date: "2026-08-02",
    });
    const day = await appendCreationToJournal(
      ACCT,
      {
        id: "cr_prose_made",
        type: "song",
        title: "Sing",
        createdAt: Date.parse("2026-08-02T10:00:00"),
        accountId: ACCT,
        lyrics: "x",
      },
      "2026-08-02",
    );
    expect(day.id).toBe(row.id);
    const ok = await removeJournalMadeBlock(ACCT, row.id, "cr_prose_made");
    expect(ok).toBe(true);
    const store = await loadJournal(ACCT);
    expect(store.items).toHaveLength(1);
    expect(store.items[0]?.body).toBe("I wrote this.");
    expect(store.items[0]?.made).toHaveLength(0);
    expect(store.items[0]?.source).toBe("student");
  });

  it("deletes the whole entry when the made block was the only content", async () => {
    const day = await appendCreationToJournal(
      ACCT,
      {
        id: "cr_fake_only",
        type: "image",
        title: "Drawing",
        createdAt: Date.parse("2026-08-03T10:00:00"),
        accountId: ACCT,
        caption: "sunset",
      },
      "2026-08-03",
    );
    const ok = await removeJournalMadeBlock(ACCT, day.id, "cr_fake_only");
    expect(ok).toBe(true);
    const store = await loadJournal(ACCT);
    expect(store.items.filter((e) => e.id === day.id)).toHaveLength(0);
  });

  it("returns false when the made block is not present", async () => {
    const row = await createJournalEntry(ACCT, {
      body: "Only prose",
      date: "2026-08-04",
    });
    const ok = await removeJournalMadeBlock(ACCT, row.id, "cr_unknown");
    expect(ok).toBe(false);
    expect((await loadJournal(ACCT)).items).toHaveLength(1);
  });

  it("buildTimeline clusters by day newest first", () => {
    const days = buildTimeline([
      {
        id: "a",
        accountId: ACCT,
        date: "2026-07-01",
        createdAt: 1,
        updatedAt: 1,
        body: "July",
        source: "student",
        made: [],
      },
      {
        id: "b",
        accountId: ACCT,
        date: "2026-08-12",
        createdAt: 2,
        updatedAt: 2,
        body: "Aug",
        source: "student",
        made: [],
      },
    ]);
    expect(days[0]?.date).toBe("2026-08-12");
    expect(days[1]?.date).toBe("2026-07-01");
    expect(timelineMonths(days)).toEqual(["2026-08", "2026-07"]);
  });

  it("merges a same-title creation row into its journal prose (Formula One case)", () => {
    const days = buildTimeline([
      {
        id: "wc",
        accountId: ACCT,
        date: "2026-08-12",
        createdAt: 1,
        updatedAt: 3,
        body: "The World Cup diary",
        source: "mixed",
        title: "The World Cup",
        made: [
          {
            kind: "video",
            creationId: "cr_wc",
            title: "The World Cup",
            style: "",
            bodySnapshot: "",
            at: 1,
          },
        ],
      },
      {
        id: "f1_prose",
        accountId: ACCT,
        date: "2026-08-12",
        createdAt: 2,
        updatedAt: 4,
        body: "Formula One diary with lyrics",
        source: "student",
        title: "Formula One",
        made: [],
      },
      {
        id: "f1_song_row",
        accountId: ACCT,
        date: "2026-08-12",
        createdAt: 1,
        updatedAt: 2,
        body: "",
        source: "creation",
        title: "Formula One",
        made: [
          {
            kind: "song",
            creationId: "cr_f1_song",
            title: "Formula One",
            style: "Indie anthem",
            bodySnapshot: "[Verse]",
            audioMediaId: "audio_1",
            at: 2,
          },
        ],
      },
    ]);
    const entries = days[0]!.entries;
    // Formula One prose + its song become ONE entry, and it sorts before World Cup.
    expect(entries).toHaveLength(2);
    const f1 = entries.find((e) => e.title === "Formula One");
    expect(f1?.id).toBe("f1_prose");
    expect(f1?.body).toContain("Formula One diary");
    expect(f1?.made).toHaveLength(1);
    expect(f1?.made[0]?.creationId).toBe("cr_f1_song");
    expect(entries[0]?.id).toBe("f1_prose");
  });

  it("keeps two distinct prose rows separate even when titles match", () => {
    const days = buildTimeline([
      {
        id: "p1",
        accountId: ACCT,
        date: "2026-08-12",
        createdAt: 1,
        updatedAt: 2,
        body: "first entry",
        source: "student",
        title: "Formula One",
        made: [],
      },
      {
        id: "p2",
        accountId: ACCT,
        date: "2026-08-12",
        createdAt: 2,
        updatedAt: 1,
        body: "second entry",
        source: "student",
        title: "Formula One",
        made: [],
      },
    ]);
    expect(days[0]!.entries).toHaveLength(2);
  });

  it("attaches a creation to the same-titled journal entry on that day", async () => {
    const prose = await createJournalEntry(ACCT, {
      body: "Formula One diary",
      title: "Formula One",
      date: "2026-08-05",
    });
    await createJournalEntry(ACCT, {
      body: "World Cup diary",
      title: "The World Cup",
      date: "2026-08-05",
    });
    const song = await addCreation(ACCT, {
      type: "song",
      title: "Formula One",
      lyrics: "[Chorus]\nx",
    });
    const day = await appendCreationToJournal(ACCT, song, "2026-08-05");
    expect(day.id).toBe(prose.id);
    expect(day.made).toHaveLength(1);
    expect(day.made[0]?.title).toBe("Formula One");
    const store = await loadJournal(ACCT);
    expect(store.items.filter((e) => e.date === "2026-08-05")).toHaveLength(2);
  });

  it("loadJournal merges a legacy orphan creation row into its same-title prose", async () => {
    // Simulate old on-disk data: prose row + orphan creation row with the same
    // title (created before the same-title matching existed).
    await fs.writeFile(
      journalFile,
      JSON.stringify({
        version: 1,
        items: [
          {
            id: "f1_prose",
            accountId: ACCT,
            date: "2026-08-06",
            createdAt: 1,
            updatedAt: 2,
            body: "Formula One diary",
            source: "student",
            title: "Formula One",
            made: [],
            writingType: "narrative",
          },
          {
            id: "f1_orphan",
            accountId: ACCT,
            date: "2026-08-06",
            createdAt: 1,
            updatedAt: 1,
            body: "",
            source: "creation",
            title: "Formula One",
            made: [
              {
                kind: "song",
                creationId: "cr_f1_orphan",
                title: "Formula One",
                style: "Indie anthem",
                bodySnapshot: "[Verse]",
                audioMediaId: "audio_1",
                at: 1,
              },
            ],
          },
        ],
      }),
    );
    const store = await loadJournal(ACCT);
    const day = store.items.filter((e) => e.date === "2026-08-06");
    expect(day).toHaveLength(1);
    expect(day[0]?.id).toBe("f1_prose");
    expect(day[0]?.body).toContain("Formula One diary");
    expect(day[0]?.made).toHaveLength(1);
    expect(day[0]?.made[0]?.creationId).toBe("cr_f1_orphan");
  });
});
