import { it } from "vitest";
import { loadJournal } from "./journal-store";
import { buildTimeline } from "./journal-model";

// Manual verification helper against real per-account journal data on the
// live server (data/ is not committed). Skip in CI/sandbox by default.
const runRealData = process.env.RUN_REAL_DATA === "1";

it.runIf(runRealData)("real data merge check", async () => {
  const store = await loadJournal("acct_ryan");
  const days = buildTimeline(store.items);
  const day = days[0];
  console.log("Day:", day.date);
  for (const e of day.entries) {
    console.log(
      "  entry:",
      e.id.slice(-6),
      "| title:",
      e.title,
      "| made:",
      e.made.map((m) => m.kind + ":" + m.title).join(", "),
    );
  }
});
