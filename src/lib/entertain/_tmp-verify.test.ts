import { it } from "vitest";
import { loadJournal } from "./journal-store";
import { buildTimeline } from "./journal-model";

it("real data merge check", async () => {
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
