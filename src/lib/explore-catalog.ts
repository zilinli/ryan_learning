/**
 * P0 — "今天想探索什么？" interest catalog (report §9.1.1).
 * Kid-facing topics the student can pick freely in the empty-chat state.
 * Each topic maps to catalog skills so the LLM can frame a ZPD-flavored
 * exploration instead of an open-ended lecture.
 */

import { getSkillDef } from "./skill-catalog";
import type { LearningMemory } from "./learning-memory";

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
    id: "space",
    label: "Space & planets",
    emoji: "🚀",
    keywords: ["space", "planet", "moon", "stars", "solar", "宇宙", "太空", "行星", "月亮"],
    skillIds: ["earth-moon-sun", "physics-6-8", "scientific-method"],
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
    skillIds: ["physics-6-8", "measurement-units", "geometry-angles"],
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
 * Kid-friendly curated set (grade-aware-ish): prefer topics whose related
 * skills overlap the student's current catalog band, then pad with fresh ones.
 */
export function pickExploreTopics(
  mem: LearningMemory | null | undefined,
  limit = 4,
): ExploreTopic[] {
  const ids = new Set((mem?.skills || []).map((s) => s.id));
  const scored = EXPLORE_TOPICS.map((t) => {
    const overlap = t.skillIds.filter((id) => ids.has(id)).length;
    return { topic: t, score: overlap };
  })
    .sort((a, b) => b.score - a.score)
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
 */
export function buildExploreKickoffMessage(
  topic: ExploreTopic,
  mem: LearningMemory | null | undefined,
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
  return [
    `I chose to explore: ${topic.emoji} ${topic.label}!`,
    `${topic.framing}`,
    `Use these to shape questions if they fit: ${skills.join(", ")}.`,
    anchor,
    "Give me ONE question at a time, Socratic hints only, no spoilers. If I solve it fast, make the next one a little harder; if I'm stuck, give a small nudge.",
    "Make it feel like a real exploration, not a worksheet.",
  ].join("\n");
}
