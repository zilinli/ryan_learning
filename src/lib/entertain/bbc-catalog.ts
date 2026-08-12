/**
 * Curated BBC documentary clip catalog for BBC Doc Lab.
 * Sourced from official BBC YouTube channels (BBC Earth, BBC, BBC Ideas).
 * Only clips with usable English captions (manual or auto-CC) — required for
 * transcript-grounded challenges.
 */

export type BbcTopic =
  | "nature"
  | "science"
  | "history"
  | "geography"
  | "technology"
  | "culture";

export type BbcClip = {
  videoId: string;
  title: string;
  series: string;
  topic: BbcTopic;
  durationSec: number;
  gradeMin: number;
  gradeMax: number;
  blurb: string;
  channel: string;
};

export function bbcVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export const BBC_CATALOG: BbcClip[] = [
  // ── BBC Earth: Planet Earth & Blue Planet ──
  {
    videoId: "cTQ3Ko9ZKg8",
    title: "Penguins: Spy in the Huddle — Emperor Penguins",
    series: "Spy in the Wild",
    topic: "nature",
    durationSec: 240,
    gradeMin: 3,
    gradeMax: 8,
    blurb: "Robot penguin cameras capture emperor penguins up close as they huddle to survive the Antarctic winter.",
    channel: "BBC Earth",
  },
  {
    videoId: "o767PuYbEXg",
    title: "Octopus vs Seabird — Blue Planet II",
    series: "Blue Planet II",
    topic: "nature",
    durationSec: 210,
    gradeMin: 3,
    gradeMax: 8,
    blurb: "An octopus uses an incredible camouflage strategy to escape a hungry seabird in the kelp forest.",
    channel: "BBC Earth",
  },
  {
    videoId: "Qzxy3GtSzt0",
    title: "Dolphins Beach Hunting — The Hunt",
    series: "The Hunt",
    topic: "nature",
    durationSec: 250,
    gradeMin: 3,
    gradeMax: 8,
    blurb: "Bottlenose dolphins in South Carolina have learned a rare hunting technique: beaching themselves to catch fish.",
    channel: "BBC Earth",
  },
  {
    videoId: "6Osj24S1k1U",
    title: "Humpback Whales Bubble-Net Feeding",
    series: "Seven Worlds One Planet",
    topic: "nature",
    durationSec: 230,
    gradeMin: 3,
    gradeMax: 8,
    blurb: "A pod of humpback whales works together to create a bubble net — one of nature's most spectacular feeding strategies.",
    channel: "BBC Earth",
  },
  {
    videoId: "pkhE14Rou-E",
    title: "Lions Attack a Buffalo — Dynasties",
    series: "Dynasties",
    topic: "nature",
    durationSec: 280,
    gradeMin: 4,
    gradeMax: 9,
    blurb: "The Marsh Pride of lions takes on a buffalo in a dramatic hunt. David Attenborough narrates the struggle for survival.",
    channel: "BBC Earth",
  },
  {
    videoId: "MfstYSUscBc",
    title: "Cuttlefish Hypnotises Crab — Blue Planet II",
    series: "Blue Planet II",
    topic: "nature",
    durationSec: 180,
    gradeMin: 3,
    gradeMax: 8,
    blurb: "A cuttlefish uses a dazzling color-changing display to hypnotize a crab before striking with lightning speed.",
    channel: "BBC Earth",
  },
  // ── BBC Earth: Science & Technology ──
  {
    videoId: "N8JD_P2J24g",
    title: "Why Do We Dream?",
    series: "BBC Ideas",
    topic: "science",
    durationSec: 300,
    gradeMin: 5,
    gradeMax: 10,
    blurb: "Scientists are still debating why we dream. Explore the leading theories: memory consolidation, threat simulation, and more.",
    channel: "BBC Ideas",
  },
  {
    videoId: "ebeNeQFUMa0",
    title: "How Do Bees Make Honey?",
    series: "BBC Earth Unplugged",
    topic: "science",
    durationSec: 220,
    gradeMin: 3,
    gradeMax: 7,
    blurb: "Inside the hive: follow the journey from flower nectar to the golden honey on your toast.",
    channel: "BBC Earth",
  },
  {
    videoId: "a7XuXi3mqYM",
    title: "Earth's Magnetic Field Is Flipping",
    series: "BBC Ideas",
    topic: "science",
    durationSec: 300,
    gradeMin: 6,
    gradeMax: 11,
    blurb: "Earth's magnetic poles have flipped hundreds of times. Scientists explain what happens when they flip again.",
    channel: "BBC Ideas",
  },
  // ── BBC Earth: History ──
  {
    videoId: "FwOoC0QdeG4",
    title: "How the Pyramids Were Built",
    series: "BBC Explore",
    topic: "history",
    durationSec: 260,
    gradeMin: 4,
    gradeMax: 9,
    blurb: "New evidence reveals how ancient Egyptians cut and transported massive stone blocks to build the pyramids.",
    channel: "BBC",
  },
  {
    videoId: "G7L4YzGAvMA",
    title: "The Lost City of Petra",
    series: "BBC Travel Show",
    topic: "history",
    durationSec: 240,
    gradeMin: 4,
    gradeMax: 9,
    blurb: "The rose-red city of Petra was carved into desert cliffs over 2,000 years ago. How did the Nabataeans build it?",
    channel: "BBC",
  },
  // ── BBC Ideas: Culture & Society ──
  {
    videoId: "3uzucyoUe6Q",
    title: "The History of Tea",
    series: "BBC Ideas",
    topic: "culture",
    durationSec: 280,
    gradeMin: 5,
    gradeMax: 10,
    blurb: "From Chinese emperors to British afternoon tea — the story of how a single plant changed global culture.",
    channel: "BBC Ideas",
  },
  // ── BBC Earth: Geography ──
  {
    videoId: "tqlC_JGPSlk",
    title: "The Amazon: Lungs of the Earth",
    series: "BBC Earth",
    topic: "geography",
    durationSec: 250,
    gradeMin: 4,
    gradeMax: 9,
    blurb: "From the forest floor to the canopy, discover how the Amazon creates its own weather and sustains millions of species.",
    channel: "BBC Earth",
  },
  // ── BBC Ideas: Technology ──
  {
    videoId: "d_FEaFgJyfA",
    title: "The Internet: Under the Sea",
    series: "BBC Click",
    topic: "technology",
    durationSec: 240,
    gradeMin: 5,
    gradeMax: 10,
    blurb: "99% of international data travels through cables on the ocean floor. Here's how they were laid.",
    channel: "BBC",
  },
  // ── More Nature Clips ──
  {
    videoId: "ja4GNdU2vYc",
    title: "Fire Ants Create Living Raft",
    series: "BBC Earth",
    topic: "nature",
    durationSec: 190,
    gradeMin: 3,
    gradeMax: 7,
    blurb: "When floods hit, fire ants lock their bodies together to create a floating raft that can survive for weeks.",
    channel: "BBC Earth",
  },
  {
    videoId: "Uj0EVT-Ekog",
    title: "Snow Leopards: Ghosts of the Mountain",
    series: "Planet Earth",
    topic: "nature",
    durationSec: 220,
    gradeMin: 3,
    gradeMax: 8,
    blurb: "Snow leopards are among the most elusive big cats on Earth. Camera traps reveal their secret lives in the Himalayas.",
    channel: "BBC Earth",
  },
  {
    videoId: "WCcLMNcWZOc",
    title: "How the Moon Controls Ocean Tides",
    series: "BBC Earth Lab",
    topic: "science",
    durationSec: 230,
    gradeMin: 5,
    gradeMax: 10,
    blurb: "The Moon's gravity pulls Earth's oceans into two daily bulges. A clear explainer of tidal mechanics.",
    channel: "BBC Earth",
  },
  // ── BBC: History & Discovery ──
  {
    videoId: "DW-BSDZ7iqc",
    title: "The Rosetta Stone: Key to Hieroglyphics",
    series: "BBC Explore",
    topic: "history",
    durationSec: 260,
    gradeMin: 5,
    gradeMax: 10,
    blurb: "How a single stone tablet — written in three scripts — unlocked the secrets of ancient Egyptian hieroglyphics.",
    channel: "BBC",
  },
  {
    videoId: "fJ6emHEBAeo",
    title: "How GPS Actually Works",
    series: "BBC Earth Lab",
    topic: "technology",
    durationSec: 240,
    gradeMin: 6,
    gradeMax: 11,
    blurb: "Your phone knows where you are thanks to atomic clocks orbiting Earth at 14,000 km/h. Here's how GPS triangulation works.",
    channel: "BBC Earth",
  },
  {
    videoId: "zut9g6z7KIc",
    title: "Antarctica: The Frozen Continent",
    series: "Frozen Planet",
    topic: "geography",
    durationSec: 270,
    gradeMin: 4,
    gradeMax: 9,
    blurb: "Antarctica holds 90% of Earth's ice. Explore the coldest, windiest, driest continent and the life that survives there.",
    channel: "BBC Earth",
  },
  {
    videoId: "EUtx6_fDXMY",
    title: "The Science of Lightning",
    series: "BBC Earth Lab",
    topic: "science",
    durationSec: 210,
    gradeMin: 4,
    gradeMax: 9,
    blurb: "Every second, 100 lightning bolts strike Earth. A clear explanation of how lightning forms and why it's so powerful.",
    channel: "BBC Earth",
  },
];

export const BBC_TOPICS: BbcTopic[] = [
  "nature",
  "science",
  "history",
  "geography",
  "technology",
  "culture",
];

export const BBC_TOPIC_LABELS: Record<BbcTopic, string> = {
  nature: "Nature",
  science: "Science",
  history: "History",
  geography: "Geography",
  technology: "Technology",
  culture: "Culture",
};

export function findBbcClip(videoId: string): BbcClip | undefined {
  return BBC_CATALOG.find((c) => c.videoId === videoId);
}

export function searchBbcCatalog(
  query: string,
  topic?: BbcTopic,
): BbcClip[] {
  const q = query.trim().toLowerCase();
  let results = BBC_CATALOG;
  if (topic) results = results.filter((c) => c.topic === topic);
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    results = results.filter(
      (c) =>
        words.every((w) => c.title.toLowerCase().includes(w)) ||
        words.every((w) => c.blurb.toLowerCase().includes(w)),
    );
  }
  return results;
}
