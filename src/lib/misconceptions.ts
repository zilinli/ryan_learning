/**
 * CA-6 — G4 misconception tag library + hidden ~~~misconception fences.
 */

export type MisconceptionTag = {
  id: string;
  skillIds: string[];
  label: string;
  promptHint: string;
};

/** ~25 G4-aligned tags (additive; ids stable). */
export const MISCONCEPTION_SEED: MisconceptionTag[] = [
  {
    id: "frac-add-denom",
    skillIds: ["fractions-concepts", "equivalent-fractions"],
    label: "Adding across denominators",
    promptHint: "Student may add numerators AND denominators (1/2+1/3→2/5). Probe with same-denominator contrast first.",
  },
  {
    id: "frac-bigger-denom",
    skillIds: ["fractions-concepts", "equivalent-fractions"],
    label: "Bigger denominator = bigger fraction",
    promptHint: "Student thinks 1/8 > 1/4 because 8>4. Use pizza/sharing or number line.",
  },
  {
    id: "frac-whole-vs-part",
    skillIds: ["fractions-concepts", "fraction-word-problems"],
    label: "Part/whole confusion",
    promptHint: "Student mixes what is the whole vs the part in word problems.",
  },
  {
    id: "equiv-frac-cross",
    skillIds: ["equivalent-fractions"],
    label: "Cross-multiply without meaning",
    promptHint: "Student cross-multiplies mechanically; ask what equal shares mean.",
  },
  {
    id: "place-value-tenths",
    skillIds: ["place-value", "decimals"],
    label: "Tenths/hundredths swap",
    promptHint: "Student confuses 0.3 with 0.03 or reads decimal places left-to-right wrong.",
  },
  {
    id: "place-value-carry",
    skillIds: ["place-value", "decimals"],
    label: "Carry into wrong place",
    promptHint: "When adding decimals, carry lands in wrong column — line up decimal points.",
  },
  {
    id: "mult-carry",
    skillIds: ["multiplication-facts"],
    label: "Multi-digit multiply carry error",
    promptHint: "Carry forgotten or written in product. Slow down place-by-place.",
  },
  {
    id: "mult-zero-placeholder",
    skillIds: ["multiplication-facts"],
    label: "Missing zero placeholder",
    promptHint: "In 2-digit×2-digit, student skips the tens-place zero shift.",
  },
  {
    id: "div-remainder-ignore",
    skillIds: ["division-basics"],
    label: "Ignores remainder",
    promptHint: "Student drops remainder or treats it as the answer. Ask what is left over.",
  },
  {
    id: "div-divisor-dividend-swap",
    skillIds: ["division-basics"],
    label: "Divisor/dividend swap",
    promptHint: "Student divides the wrong way (e.g. 3÷12 vs 12÷3).",
  },
  {
    id: "word-op-choice",
    skillIds: ["multi-step-word-problems", "fraction-word-problems"],
    label: "Wrong operation from keywords",
    promptHint: "Keywords like 'left'/'more' mis-trigger +/−. Ask what the story is asking.",
  },
  {
    id: "bar-part-whole-swap",
    skillIds: ["multi-step-word-problems", "fraction-word-problems"],
    label: "Bar model part/whole swap",
    promptHint: "Comparison bar vs part-whole bar confused — redraw with labels.",
  },
  {
    id: "angle-right-vs-acute",
    skillIds: ["geometry-angles"],
    label: "Right vs acute mix-up",
    promptHint: "Student calls any sharp corner a right angle. Use square-corner test.",
  },
  {
    id: "angle-measure-from-wrong-ray",
    skillIds: ["geometry-angles"],
    label: "Protractor from wrong ray",
    promptHint: "Reads the outer scale or starts from the wrong baseline.",
  },
  {
    id: "measure-unit-mix",
    skillIds: ["measurement-units", "geometry-measure"],
    label: "Unit mix cm/m/mm",
    promptHint: "Converts by moving decimal the wrong number of places.",
  },
  {
    id: "volume-area-confuse",
    skillIds: ["volume-intro", "geometry-measure"],
    label: "Volume vs area",
    promptHint: "Uses L×W for volume or L×W×H for area. Ask dimensions count.",
  },
  {
    id: "reading-quote-not-evidence",
    skillIds: ["reading-evidence"],
    label: "Quote without answering",
    promptHint: "Copies a sentence but does not link it to the question. Ask 'how does that prove…?'",
  },
  {
    id: "reading-outside-text",
    skillIds: ["reading-evidence"],
    label: "Prior knowledge instead of text",
    promptHint: "Answers from memory, not the passage. Point back to Photo/paragraph.",
  },
  {
    id: "writing-runon",
    skillIds: ["narrative-writing"],
    label: "Run-on / missing periods",
    promptHint: "Ideas glued without stops. Ask where a reader needs a breath.",
  },
  {
    id: "writing-no-detail",
    skillIds: ["narrative-writing"],
    label: "Vague feelings only",
    promptHint: "Says 'happy/sad' without sensory detail. Ask for one see/hear/touch moment.",
  },
  {
    id: "science-earth-scale",
    skillIds: ["earth-moon-sun"],
    label: "Earth/Moon/Sun scale myth",
    promptHint: "Thinks Moon makes its own light or Sun orbits Earth. Quick model check.",
  },
  {
    id: "science-eco-foodchain",
    skillIds: ["ecosystems"],
    label: "Food-chain arrow direction",
    promptHint: "Arrows point to who eats whom wrong. Energy flows TO the eater.",
  },
  {
    id: "decimal-money-cent",
    skillIds: ["decimals", "place-value"],
    label: "Money cents as whole dollars",
    promptHint: "Writes $0.5 as 50 cents or $3.5 as 3 dollars 5 cents inconsistently.",
  },
  {
    id: "frac-of-set",
    skillIds: ["fraction-word-problems", "fractions-concepts"],
    label: "Fraction of a set off-by-one",
    promptHint: "When finding 1/4 of 12, counts wrong group size. Act out sharing.",
  },
  {
    id: "ancient-timeline-order",
    skillIds: ["ancient-civ"],
    label: "Timeline order reverse",
    promptHint: "Earlier/later civilizations swapped. Use a simple before/after line.",
  },
];

const BY_ID = new Map(MISCONCEPTION_SEED.map((t) => [t.id, t]));

export function getMisconception(id: string): MisconceptionTag | undefined {
  return BY_ID.get(id);
}

export function misconceptionIds(): string[] {
  return MISCONCEPTION_SEED.map((t) => t.id);
}

const FENCE_RE = /~~~misconception\s*\n([\s\S]*?)\n~~~/gi;

export type MisconceptionHit = {
  id: string;
  count: number;
  lastSeen: number;
};

export function parseMisconceptionFence(
  text: string,
  now = Date.now(),
): MisconceptionHit | null {
  if (!text) return null;
  let last: MisconceptionHit | null = null;
  const re = new RegExp(FENCE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = m[1]?.trim();
    if (!body) continue;
    try {
      const o = JSON.parse(body) as { id?: string };
      if (typeof o?.id === "string" && BY_ID.has(o.id)) {
        last = { id: o.id, count: 1, lastSeen: now };
      }
    } catch {
      /* ignore */
    }
  }
  return last;
}

export function stripMisconceptionFence(text: string): string {
  if (!text) return text;
  return text
    .replace(FENCE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function mergeMisconceptionHit(
  prev: MisconceptionHit[] | undefined,
  hit: MisconceptionHit | null,
  max = 8,
): MisconceptionHit[] {
  if (!hit) return (prev || []).slice(0, max);
  const list = [...(prev || [])];
  const i = list.findIndex((h) => h.id === hit.id);
  if (i >= 0) {
    list[i] = {
      id: hit.id,
      count: list[i]!.count + 1,
      lastSeen: Math.max(list[i]!.lastSeen, hit.lastSeen),
    };
  } else {
    list.unshift(hit);
  }
  return list
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, max);
}

export function misconceptionPromptLines(
  hits: MisconceptionHit[] | undefined,
): string[] {
  if (!hits?.length) {
    return [
      "",
      "[Misconceptions — CA-6]",
      "On a clear wrong pattern, you MAY emit a hidden fence (never explain to the student):",
      "~~~misconception",
      '{"id":"frac-add-denom"}',
      "~~~",
      `Known ids include: ${misconceptionIds().slice(0, 8).join(", ")}…`,
    ];
  }
  const bits = hits.slice(0, 4).map((h) => {
    const tag = getMisconception(h.id);
    if (!tag) return h.id;
    if (h.count <= 0 && h.lastSeen === 0) {
      return `${tag.label} (watch) — ${tag.promptHint}`;
    }
    return `${tag.label} (×${h.count}) — ${tag.promptHint}`;
  });
  return [
    "",
    "[Misconceptions — CA-6]",
    `Recent tagged patterns: ${bits.join(" | ")}`,
    "Address the pattern with Socratic probes; do not lecture the tag name to the student.",
    "You may update with ~~~misconception {\"id\":\"…\"} when a new pattern appears.",
  ];
}
