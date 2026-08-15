/**
 * P0 — "今天想探索什么？" interest catalog (report §9.1.1).
 * Kid-facing topics the student can pick freely in the empty-chat state.
 * Each topic maps to catalog skills so the LLM can frame a ZPD-flavored
 * exploration instead of an open-ended lecture.
 */

import { getSkillDef } from "./skill-catalog";
import type { LearningMemory, SkillMastery } from "./learning-memory";
import type { InterestRecord } from "./interest-store";
import { CURIOSITY_HOOK_LINE } from "./curiosity-hook";

/** Derivative-window: interests explored within this many days count as "recent". */
export const INTEREST_DERIVATIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type ExploreTopic = {
  id: string;
  label: string;
  emoji: string;
  /** Keywords used to match a free-text exploration too */
  keywords: string[];
  /** Catalog skill ids thematically related to this interest */
  skillIds: string[];
  /** How the tutor should frame this exploration (fed to the kickoff prompt) */
  framing: string;
};

export const EXPLORE_TOPICS: ExploreTopic[] = [
  {
    id: "physics",
    label: "Forces & motion",
    emoji: "⚡",
    keywords: ["physics", "force", "motion", "gravity", "energy", "push", "物理", "力", "运动", "能量", "重力"],
    skillIds: ["forces-motion", "energy-transfer", "physics-6-8", "scientific-method"],
    framing:
      "Start from a push or a collision: what makes things start, stop, or bounce — predict before you explain.",
  },
  {
    id: "space",
    label: "Space & planets",
    emoji: "🚀",
    keywords: ["space", "planet", "moon", "stars", "solar", "宇宙", "太空", "行星", "月亮"],
    skillIds: ["earth-moon-sun", "forces-motion", "physics-6-8", "scientific-method"],
    framing:
      "Start from a wonder question (why is the sky dark at night, how far is the Moon, why do planets orbit).",
  },
  {
    id: "dinosaurs",
    label: "Dinosaurs & fossils",
    emoji: "🦖",
    keywords: ["dinosaur", "fossil", "prehistoric", "extinct", "恐龙", "化石", "史前"],
    skillIds: ["science-observations", "ecosystems", "ancient-civ"],
    framing:
      "Use evidence: how do we know dinosaurs existed, how fossils form, why they went extinct.",
  },
  {
    id: "oceans",
    label: "Oceans & sea life",
    emoji: "🌊",
    keywords: ["ocean", "sea", "whale", "fish", "coral", "海洋", "大海", "鱼"],
    skillIds: ["ecosystems", "science-observations", "biology-6-8"],
    framing:
      "Explore food chains in the sea, buoyancy, tides, and why the ocean is salty.",
  },
  {
    id: "vehicles",
    label: "Cars, planes & machines",
    emoji: "🚗",
    keywords: ["car", "plane", "train", "engine", "machine", "车", "飞机", "汽车", "机器"],
    skillIds: ["forces-motion", "physics-6-8", "measurement-units", "geometry-angles"],
    framing:
      "Connect to motion and measurement: speed, distance, angles, and how machines multiply force.",
  },
  {
    id: "music",
    label: "Music & rhythm",
    emoji: "🎵",
    keywords: ["music", "song", "rhythm", "beat", "note", "音乐", "节奏", "歌"],
    skillIds: ["fractions-concepts", "ratios-proportions"],
    framing:
      "Find the math in music: note lengths as fractions of a beat, tempo as a rate.",
  },
  {
    id: "magic",
    label: "Magic & number tricks",
    emoji: "🪄",
    keywords: ["magic", "trick", "illusion", "card", "魔术", "戏法", "扑克"],
    skillIds: ["statistics-intro", "prealgebra", "multi-step-word-problems"],
    framing:
      "Figure out how the trick works using math and logic — don't just reveal it.",
  },
  {
    id: "animals",
    label: "Amazing animals",
    emoji: "🦁",
    keywords: ["animal", "lion", "tiger", "insect", "bird", "动物", "狮子", "昆虫"],
    skillIds: ["ecosystems", "biology-6-8", "science-observations"],
    framing:
      "Compare adaptations, habitats, and food chains; make it a classification puzzle.",
  },
  {
    id: "sports",
    label: "Sports & statistics",
    emoji: "⚽",
    keywords: ["sport", "football", "basketball", "soccer", "game", "运动", "足球", "篮球", "比赛"],
    skillIds: ["statistics-intro", "ratios-proportions", "measurement-units"],
    framing:
      "Use real sports numbers: averages, percentages, unit rates (goals per game, speed).",
  },
  {
    id: "food",
    label: "Cooking & fractions",
    emoji: "🍕",
    keywords: ["food", "pizza", "recipe", "cook", "bake", "食物", "披萨", "食谱", "做饭", "蛋糕"],
    skillIds: ["fractions-concepts", "ratios-proportions", "measurement-units"],
    framing:
      "Double a recipe, split a pizza fairly, convert units — cooking is fractions in real life.",
  },
  {
    id: "robots",
    label: "Robots & coding",
    emoji: "🤖",
    keywords: ["robot", "code", "coding", "program", "computer", "机器人", "编程", "代码", "电脑"],
    skillIds: ["expressions-equations", "algebra-i", "scientific-method"],
    framing:
      "Think like a program: sequences, variables, if-then logic, and how machines decide.",
  },
  {
    id: "money",
    label: "Money & shopping",
    emoji: "💰",
    keywords: ["money", "dollar", "price", "discount", "shop", "钱", "美元", "价格", "购物", "打折"],
    skillIds: ["decimals", "ratios-proportions", "multi-step-word-problems"],
    framing:
      "Real shopping math: discounts, tax, change, comparing prices — keep numbers exact.",
  },
  {
    id: "weather",
    label: "Weather & climate",
    emoji: "🌦️",
    keywords: ["weather", "rain", "storm", "temperature", "cloud", "天气", "下雨", "温度", "气候"],
    skillIds: ["env-science", "measurement-units", "statistics-intro"],
    framing:
      "Measure and predict: temperature scales, averages, and why seasons happen.",
  },
];

export function getExploreTopic(id: string): ExploreTopic | undefined {
  return EXPLORE_TOPICS.find((t) => t.id === id);
}

/**
 * UX-V4 P0 — free-text explore ("Today, I want to explore ___").
 * Match catalog keywords when possible; otherwise build a temporary custom topic
 * so life interests (Formula One, World Cup, …) still kick off + land in interest profile.
 */
export function resolveFreeExploreTopic(raw: string): ExploreTopic | null {
  const text = raw.trim().replace(/\s+/g, " ").slice(0, 64);
  if (text.length < 2) return null;
  const lower = text.toLowerCase();
  let best: ExploreTopic | null = null;
  let bestScore = 0;
  for (const topic of EXPLORE_TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      const k = kw.toLowerCase();
      if (lower.includes(k) || k.includes(lower)) {
        score = Math.max(score, k.length);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  if (best && bestScore >= 3) return best;
  // Dynamic topic: slug id + general inquiry skills
  const slug = lower
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "custom";
  return {
    id: `custom:${slug}`,
    label: text.slice(0, 48),
    emoji: "✨",
    keywords: [lower],
    skillIds: ["scientific-method", "multi-step-word-problems", "science-observations"],
    framing: `Start from a wonder question about "${text}" — predict before you explain, then dig one layer deeper.`,
  };
}

/**
 * Kid-friendly curated set (grade-aware-ish): prefer topics whose related
 * skills overlap the student's current catalog band, then pad with fresh ones.
 *
 * V2 P0 (report §9.1.1) — interest data feeds back into the ranking:
 * - an interest the child actually picked gets a `count`-weighted boost, so
 *   favorites stay visible and "只进不出" becomes "进则反哺";
 * - a topic that shares skills with a *recently* explored interest gets a
 *   "derivative" boost (dinosaurs → animals/fossils), surfacing neighbors.
 */
export function pickExploreTopics(
  mem: LearningMemory | null | undefined,
  limit = 4,
  interests: InterestRecord[] = [],
): ExploreTopic[] {
  const ids = new Set((mem?.skills || []).map((s) => s.id));
  const interestById = new Map(interests.map((i) => [i.topicId, i]));
  const recentIds = new Set(
    interests
      .filter(
        (i) =>
          i.exploredAt >= Date.now() - INTEREST_DERIVATIVE_WINDOW_MS,
      )
      .map((i) => i.topicId),
  );
  const topicById = new Map(EXPLORE_TOPICS.map((t) => [t.id, t]));

  const sharesSkills = (a: ExploreTopic, b: ExploreTopic): boolean =>
    a.skillIds.some((s) => b.skillIds.includes(s));

  const scored = EXPLORE_TOPICS.map((t) => {
    let score = t.skillIds.filter((id) => ids.has(id)).length;
    // interest count boost (up to +3)
    const own = interestById.get(t.id);
    if (own) score += Math.min(3, own.count);
    // derivative boost: neighbor of a recently-explored interest (+1 each)
    for (const rid of recentIds) {
      if (rid === t.id) continue;
      const rTopic = topicById.get(rid);
      if (rTopic && sharesSkills(t, rTopic)) score += 1;
    }
    return { topic: t, score };
  })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.topic.skillIds.length - a.topic.skillIds.length,
    )
    .map((x) => x.topic);
  // De-duplicate: keep one topic per emoji, then round-robin from varied picks
  const seen = new Set<string>();
  const out: ExploreTopic[] = [];
  for (const t of scored) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The most recent interest that led us to this topic (same topic, or a
 * recently-explored neighbor sharing skills) — drives the continuation copy.
 */
export function leadingInterestForTopic(
  topic: ExploreTopic,
  interests: InterestRecord[],
): InterestRecord | null {
  if (!interests?.length) return null;
  const topicById = new Map(EXPLORE_TOPICS.map((t) => [t.id, t]));
  const recent = interests
    .filter((i) => i.exploredAt >= Date.now() - INTEREST_DERIVATIVE_WINDOW_MS)
    .sort((a, b) => b.exploredAt - a.exploredAt);
  for (const i of recent) {
    if (i.topicId === topic.id) return i;
    const other = topicById.get(i.topicId);
    if (other && other.skillIds.some((s) => topic.skillIds.includes(s))) {
      return i;
    }
  }
  return null;
}

/** Human list of related skill labels for the kickoff prompt (max 3). */
export function relatedSkillLabels(topic: ExploreTopic): string[] {
  const out: string[] = [];
  for (const id of topic.skillIds) {
    const def = getSkillDef(id);
    if (def) out.push(def.label);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Kid-facing kickoff sent when a student picks an interest chip. Frames the
 * exploration as a ZPD challenge linked to catalog skills, not a lecture.
 * V2 P0 — when this topic continues a recent interest, the kickoff says so
 * ("因为你上次喜欢 X，我准备了它的邻居 Y", report §9.1.1).
 * V2 P2 — an optional `zpdSkill` (the mid-mastery skill chosen by
 * `planExploreSequence`, report §9.3.3) pins the start of the ladder.
 */
export function buildExploreKickoffMessage(
  topic: ExploreTopic,
  mem: LearningMemory | null | undefined,
  interests: InterestRecord[] = [],
  zpdSkill?: string | null,
): string {
  const skills = relatedSkillLabels(topic);
  const knownSkills = [...(mem?.skills || [])]
    .filter((s) => s.attempts > 0 && s.pKnown >= 0.4)
    .sort((a, b) => b.pKnown - a.pKnown)
    .slice(0, 3)
    .map((s) => s.label);
  const anchor = knownSkills.length
    ? `Connect it to what I already know (${knownSkills.join(", ")}).`
    : "Keep it right at the edge of what I know.";
  const zpdLine = zpdSkill
    ? `Start from "${zpdSkill}" — that's right at the edge of what I know — then stretch from there.`
    : "";
  const leading = leadingInterestForTopic(topic, interests);
  const continuation = leading
    ? `Because I loved "${leading.label}" last time, this topic is its neighbor — let's keep going.`
    : "";
  return [
    `I chose to explore: ${topic.emoji} ${topic.label}!`,
    continuation,
    `${topic.framing}`,
    CURIOSITY_HOOK_LINE,
    `Use these to shape questions if they fit: ${skills.join(", ")}.`,
    zpdLine,
    anchor,
    "Give me ONE question at a time, Socratic hints only, no spoilers. If I solve it fast, make the next one a little harder; if I'm stuck, give a small nudge.",
    "Make it feel like a real exploration, not a worksheet.",
  ]
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

/**
 * V2 P2 — curriculum sequence vs dialog separation (report §9.3.3).
 * Pure, rule-based planning: choosing the topic AND the ZPD starting point
 * happens here with no LLM call. The LLM only runs the conversation.
 */
export type ExplorePlan = {
  topic: ExploreTopic;
  /** Mid-mastery topic skill to start the ladder (ZPD), else null. */
  zpdSkill: string | null;
  /** Skills the child already knows well enough to anchor on. */
  anchorSkills: string[];
  /** Ready-to-send kickoff for the LLM conversation. */
  kickoff: string;
};

export function planOneExploreTopic(
  topic: ExploreTopic,
  mem: LearningMemory | null | undefined,
  interests: InterestRecord[] = [],
): ExplorePlan {
  const mastery = new Map((mem?.skills || []).map((s) => [s.id, s]));
  // ZPD start: a topic skill with attempts still mid-band (0.35–0.75) —
  // hardest in the zone first, since it's the point of maximum stretch.
  const zpd = topic.skillIds
    .map((id) => mastery.get(id))
    .filter(
      (s): s is SkillMastery =>
        typeof s !== "undefined" && s.attempts > 0,
    )
    .filter((s) => s.pKnown >= 0.35 && s.pKnown < 0.75)
    .sort((a, b) => a.pKnown - b.pKnown)[0];
  const anchorSkills = [...(mem?.skills || [])]
    .filter((s) => s.attempts > 0 && s.pKnown >= 0.4)
    .sort((a, b) => b.pKnown - a.pKnown)
    .slice(0, 3)
    .map((s) => s.label);
  return {
    topic,
    zpdSkill: zpd?.label ?? null,
    anchorSkills,
    kickoff: buildExploreKickoffMessage(topic, mem, interests, zpd?.label ?? null),
  };
}

/** Plan the next `limit` explorations for the empty-chat state. */
export function planExploreSequence(
  mem: LearningMemory | null | undefined,
  interests: InterestRecord[] = [],
  limit = 4,
): ExplorePlan[] {
  return pickExploreTopics(mem, limit, interests).map((topic) =>
    planOneExploreTopic(topic, mem, interests),
  );
}
