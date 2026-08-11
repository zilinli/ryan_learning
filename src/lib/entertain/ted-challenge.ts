/**
 * Advanced TED listening challenge builders (BASIS / international-school).
 */

import type { TedTalk } from "./ted-catalog";

export type ChallengeKind = "literal" | "structure" | "critique" | "retell";

export type ChallengeItem = {
  id: string;
  kind: ChallengeKind;
  prompt: string;
  rubricHint: string;
  choices?: string[];
};

export type TedChallenge = {
  talkSlug: string;
  title: string;
  items: ChallengeItem[];
  generatedFromTranscript: boolean;
};

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40)
    .slice(0, 40);
}

/** Local high-quality fallback when LLM / transcript is thin. */
export function buildFallbackChallenge(
  talk: TedTalk,
  transcript: string,
): TedChallenge {
  const sents = sentences(transcript);
  const hook = sents[0] || talk.blurb;
  const mid = sents[Math.floor(sents.length / 2)] || talk.blurb;
  const items: ChallengeItem[] = [
    {
      id: "q1",
      kind: "literal",
      prompt: `In one precise sentence, what is ${talk.speaker}'s central claim in “${talk.title}”?`,
      rubricHint: "Name the claim, not a vague theme. Quote a key phrase if you can.",
    },
    {
      id: "q2",
      kind: "structure",
      prompt: `How does the talk move from hook → evidence → takeaway? Sketch the arc in 3 short bullets.`,
      rubricHint: "Look for story, data, or counterexample beats — not a plot summary of jokes.",
    },
    {
      id: "q3",
      kind: "critique",
      prompt: `Steelman the strongest objection someone could raise against the talk's argument. Then answer it in 2–3 sentences.`,
      rubricHint: "Strong objections attack evidence quality, overgeneralization, or missing trade-offs.",
    },
    {
      id: "q4",
      kind: "critique",
      prompt: `Pick one memorable line (or paraphrase of: “${hook.slice(0, 120)}…”). Why does it persuade — rhetoric, evidence, or emotion?`,
      rubricHint: "Separate style from substance; advanced listeners name the technique.",
    },
    {
      id: "q5",
      kind: "retell",
      prompt: `Explain the talk to a sharp classmate who missed it — max 4 sentences. Include one idea from later in the talk (hint near: “${mid.slice(0, 100)}…”).`,
      rubricHint: "Retell should carry the argument, not only the opening joke.",
    },
  ];
  return {
    talkSlug: talk.slug,
    title: talk.title,
    items,
    generatedFromTranscript: transcript.length > 200,
  };
}

export function parseChallengeJson(
  raw: string,
  talk: TedTalk,
): TedChallenge | null {
  const m = /\{[\s\S]*\}/.exec(raw);
  if (!m) return null;
  try {
    const data = JSON.parse(m[0]) as {
      items?: Array<{
        kind?: string;
        prompt?: string;
        rubricHint?: string;
        choices?: string[];
      }>;
    };
    if (!Array.isArray(data.items) || data.items.length < 3) return null;
    const kinds: ChallengeKind[] = [
      "literal",
      "structure",
      "critique",
      "retell",
    ];
    const items: ChallengeItem[] = data.items.slice(0, 5).map((it, i) => ({
      id: `q${i + 1}`,
      kind: kinds.includes(it.kind as ChallengeKind)
        ? (it.kind as ChallengeKind)
        : "critique",
      prompt: String(it.prompt || "").trim() || `Question ${i + 1}`,
      rubricHint: String(it.rubricHint || "Be precise and evidence-aware.").trim(),
      choices: Array.isArray(it.choices)
        ? it.choices.map(String).slice(0, 4)
        : undefined,
    }));
    return {
      talkSlug: talk.slug,
      title: talk.title,
      items,
      generatedFromTranscript: true,
    };
  } catch {
    return null;
  }
}

export function challengeSystemPrompt(talk: TedTalk): string {
  return [
    "You design advanced listening challenges for international-school high achievers (roughly grades 6–10).",
    "Tone: witty, rigorous, never babyish. Socratic — do not reveal answers.",
    "Return ONLY JSON: {\"items\":[{\"kind\":\"literal|structure|critique|retell\",\"prompt\":\"...\",\"rubricHint\":\"...\"}]}",
    "Include 4–5 items mixing kinds. Prefer open response over multiple choice.",
    `Talk: “${talk.title}” by ${talk.speaker}.`,
  ].join("\n");
}
