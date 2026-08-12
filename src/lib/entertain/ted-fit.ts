/**
 * TED Lab list ranking by learner grade + age fit.
 * Sort only — never hide talks. Curated slug map wins; live hits are inferred.
 */

import type { TedTalk, TedTopic } from "./ted-catalog";
import { searchTedCatalog } from "./ted-catalog";
import { typicalAgeForGrade } from "./ted-challenge";

export type TedMaturity = "all" | "caution" | "mature";

export type TedAudience = {
  gradeMin: number;
  gradeMax: number;
  maturity: TedMaturity;
};

export type TedLearnerFit = {
  age?: number;
  grade?: number;
};

const DEFAULT_AUDIENCE: TedAudience = {
  gradeMin: 7,
  gradeMax: 12,
  maturity: "all",
};

/** Curated slug → classroom/Common-Sense style band. */
export const TED_AUDIENCE_BY_SLUG: Record<string, TedAudience> = {
  sir_ken_robinson_do_schools_kill_creativity: {
    gradeMin: 6,
    gradeMax: 12,
    maturity: "all",
  },
  chimamanda_ngozi_adichie_the_danger_of_a_single_story: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "caution",
  },
  simon_sinek_how_great_leaders_inspire_action: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  brene_brown_the_power_of_vulnerability: {
    gradeMin: 9,
    gradeMax: 12,
    maturity: "caution",
  },
  amy_cuddy_your_body_language_may_shape_who_you_are: {
    gradeMin: 7,
    gradeMax: 12,
    maturity: "all",
  },
  tim_urban_inside_the_mind_of_a_master_procrastinator: {
    gradeMin: 6,
    gradeMax: 11,
    maturity: "all",
  },
  elizabeth_gilbert_your_elusive_creative_genius: {
    gradeMin: 9,
    gradeMax: 12,
    maturity: "all",
  },
  susan_cain_the_power_of_introverts: {
    gradeMin: 6,
    gradeMax: 12,
    maturity: "all",
  },
  dan_pink_the_puzzle_of_motivation: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  carol_dweck_the_power_of_believing_that_you_can_improve: {
    gradeMin: 4,
    gradeMax: 10,
    maturity: "all",
  },
  shawn_achor_the_happy_secret_to_better_work: {
    gradeMin: 7,
    gradeMax: 12,
    maturity: "all",
  },
  angela_lee_duckworth_grit_the_power_of_passion_and_perseverance: {
    gradeMin: 5,
    gradeMax: 10,
    maturity: "all",
  },
  julian_treasure_how_to_speak_so_that_people_want_to_listen: {
    gradeMin: 4,
    gradeMax: 12,
    maturity: "all",
  },
  kelly_mcgonigal_how_to_make_stress_your_friend: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  hans_rosling_the_best_stats_you_ve_ever_seen: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  yuval_noah_harari_what_explains_the_rise_of_humans: {
    gradeMin: 9,
    gradeMax: 12,
    maturity: "all",
  },
  feifei_li_how_we_re_teaching_computers_to_understand_pictures: {
    gradeMin: 7,
    gradeMax: 12,
    maturity: "all",
  },
  margaret_heffernan_dare_to_disagree: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  adam_grant_the_surprising_habits_of_original_thinkers: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  celeste_headlee_10_ways_to_have_a_better_conversation: {
    gradeMin: 6,
    gradeMax: 12,
    maturity: "all",
  },
  stuart_brown_play_is_more_than_just_fun: {
    gradeMin: 5,
    gradeMax: 12,
    maturity: "all",
  },
  pamela_meyer_how_to_spot_a_liar: {
    gradeMin: 9,
    gradeMax: 12,
    maturity: "caution",
  },
  barry_schwartz_the_paradox_of_choice: {
    gradeMin: 9,
    gradeMax: 12,
    maturity: "all",
  },
  daniel_kahneman_the_riddle_of_experience_vs_memory: {
    gradeMin: 10,
    gradeMax: 12,
    maturity: "all",
  },
  jon_ronson_strange_answers_to_the_psychopath_test: {
    gradeMin: 11,
    gradeMax: 12,
    maturity: "mature",
  },
  rita_pierson_every_kid_needs_a_champion: {
    gradeMin: 4,
    gradeMax: 10,
    maturity: "all",
  },
  eduardo_briceno_how_to_get_better_at_the_things_you_care_about: {
    gradeMin: 5,
    gradeMax: 12,
    maturity: "all",
  },
  alex_gendler_can_you_solve_the_prisoner_hat_riddle: {
    gradeMin: 3,
    gradeMax: 8,
    maturity: "all",
  },
  steven_johnson_where_good_ideas_come_from: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  david_eagleman_can_we_create_new_senses_for_humans: {
    gradeMin: 7,
    gradeMax: 12,
    maturity: "all",
  },
  monica_lewinsky_the_price_of_shame: {
    gradeMin: 11,
    gradeMax: 12,
    maturity: "mature",
  },
  chris_anderson_ted_s_secret_to_great_public_speaking: {
    gradeMin: 6,
    gradeMax: 12,
    maturity: "all",
  },
  isaac_lidsky_what_reality_are_you_creating_for_yourself: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  drew_dudley_everyday_leadership: {
    gradeMin: 5,
    gradeMax: 10,
    maturity: "all",
  },
  sarah_jayne_blakemore_the_mysterious_workings_of_the_adolescent_brain: {
    gradeMin: 7,
    gradeMax: 12,
    maturity: "all",
  },
  pico_iyer_where_is_home: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  apollo_robbins_the_art_of_misdirection: {
    gradeMin: 4,
    gradeMax: 10,
    maturity: "all",
  },
  julia_galef_why_you_think_you_re_right_even_if_you_re_wrong: {
    gradeMin: 8,
    gradeMax: 12,
    maturity: "all",
  },
  manoush_zomorodi_how_boredom_can_lead_to_your_most_brilliant_ideas: {
    gradeMin: 7,
    gradeMax: 12,
    maturity: "all",
  },
};

const MATURE_RE =
  /\b(psychopath|porn|rape|suicide|affair|sex scandal|sexual|nudity|murder)\b|price of shame|spot a liar/i;
const KID_RE =
  /\b(riddle|ted-ed|ted ed|for kids|animation|puzzle|marshmallow)\b/i;

export function clampGrade(n: number): number {
  if (!Number.isFinite(n)) return 4;
  return Math.max(1, Math.min(12, Math.round(n)));
}

/** Ryan-safe default when the client omits grade (same grain as challenge). */
export function normalizeFitGrade(grade?: number): number {
  return typeof grade === "number" && Number.isFinite(grade)
    ? clampGrade(grade)
    : 4;
}

export function parseTedLearnerFit(raw?: {
  grade?: unknown;
  age?: unknown;
} | null): TedLearnerFit {
  const gradeRaw = raw?.grade;
  const ageRaw = raw?.age;
  const grade =
    typeof gradeRaw === "number"
      ? gradeRaw
      : typeof gradeRaw === "string" && gradeRaw.trim()
        ? Number(gradeRaw)
        : undefined;
  const age =
    typeof ageRaw === "number"
      ? ageRaw
      : typeof ageRaw === "string" && ageRaw.trim()
        ? Number(ageRaw)
        : undefined;
  return {
    grade: typeof grade === "number" && Number.isFinite(grade) ? grade : undefined,
    age: typeof age === "number" && Number.isFinite(age) ? age : undefined,
  };
}

export function inferTedAudience(talk: Pick<TedTalk, "slug" | "title" | "blurb" | "durationSec" | "topics">): TedAudience {
  const known = TED_AUDIENCE_BY_SLUG[talk.slug];
  if (known) return known;

  const hay = `${talk.title} ${talk.blurb} ${talk.slug.replace(/_/g, " ")}`;
  let maturity: TedMaturity = "all";
  if (MATURE_RE.test(hay) || talk.slug.includes("lewinsky") || talk.slug.includes("psychopath")) {
    maturity = "mature";
  } else if (/\b(shame|vulnerability|liar|deception)\b/i.test(hay)) {
    maturity = "caution";
  }

  const dur = Number(talk.durationSec) || 0;
  const kidLike = KID_RE.test(hay) || talk.slug.includes("gendler");
  let gradeMin = 7;
  let gradeMax = 12;
  if (kidLike || (dur > 0 && dur <= 360 && talk.topics.includes("education"))) {
    gradeMin = 3;
    gradeMax = 8;
  } else if (dur > 0 && dur <= 480) {
    gradeMin = 4;
    gradeMax = 10;
  } else if (dur > 0 && dur <= 720) {
    gradeMin = 5;
    gradeMax = 11;
  } else if (dur > 0 && dur <= 960) {
    gradeMin = 6;
    gradeMax = 12;
  } else if (dur > 960) {
    gradeMin = 8;
    gradeMax = 12;
  }
  if (maturity === "mature") {
    gradeMin = Math.max(gradeMin, 11);
  } else if (maturity === "caution") {
    gradeMin = Math.max(gradeMin, 8);
  }
  return { gradeMin, gradeMax, maturity };
}

export function effectiveFitGrade(learner?: TedLearnerFit | null): number {
  const grade = normalizeFitGrade(learner?.grade);
  const typical = typicalAgeForGrade(grade);
  const age =
    typeof learner?.age === "number" && Number.isFinite(learner.age)
      ? learner.age
      : typical;
  const delta = age - typical;
  if (delta <= -2) return clampGrade(grade - 1);
  if (delta >= 3) return clampGrade(grade + 1);
  return grade;
}

export function tedFitScore(
  talk: TedTalk,
  learner?: TedLearnerFit | null,
): number {
  const g = effectiveFitGrade(learner);
  const aud = inferTedAudience(talk);
  let score = 100;

  if (g >= aud.gradeMin && g <= aud.gradeMax) {
    score += 28;
    const span = Math.max(1, aud.gradeMax - aud.gradeMin);
    const pos = (g - aud.gradeMin) / span;
    // Younger learners sit near the band floor; older near the ceiling.
    if (g <= 5) score += 8 * (1 - pos);
    else if (g >= 9) score += 8 * pos;
  } else if (g < aud.gradeMin) {
    score -= 16 * (aud.gradeMin - g);
  } else {
    score -= 10 * (g - aud.gradeMax);
  }

  const dur = Number(talk.durationSec) || 0;
  if (dur > 0) {
    if (g <= 5) {
      if (dur <= 360) score += 28;
      else if (dur <= 480) score += 18;
      else if (dur <= 720) score += 8;
      else if (dur > 900) score -= 22;
    } else if (g <= 8) {
      if (dur <= 720) score += 10;
      else if (dur > 1100) score -= 8;
    }
  }

  if (aud.maturity === "mature") {
    if (g < 9) score -= 80;
    else if (g < 11) score -= 36;
  } else if (aud.maturity === "caution") {
    if (g < 6) score -= 28;
    else if (g < 8) score -= 12;
  }

  return score;
}

export function uniqueTedTalks(talks: TedTalk[]): TedTalk[] {
  const seen = new Set<string>();
  const out: TedTalk[] = [];
  for (const t of talks) {
    if (!t?.slug || seen.has(t.slug)) continue;
    seen.add(t.slug);
    out.push(t);
  }
  return out;
}

export function sortTedTalksByLearnerFit(
  talks: TedTalk[],
  learner?: TedLearnerFit | null,
): TedTalk[] {
  return talks
    .map((talk, index) => {
      const aud = inferTedAudience(talk);
      return {
        index,
        score: tedFitScore(talk, learner),
        talk: {
          ...talk,
          gradeMin: aud.gradeMin,
          gradeMax: aud.gradeMax,
        },
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const da = a.talk.durationSec || 9999;
      const db = b.talk.durationSec || 9999;
      if (da !== db) return da - db;
      return a.index - b.index;
    })
    .map((row) => row.talk);
}

export function searchTedCatalogForLearner(
  query: string,
  topic: TedTopic | "all" = "all",
  learner?: TedLearnerFit | null,
): TedTalk[] {
  return sortTedTalksByLearnerFit(searchTedCatalog(query, topic), learner);
}

/** Empty browse: curated fit first, then live page (deduped). */
export function mergeTedBrowseForLearner(
  liveTalks: TedTalk[],
  learner?: TedLearnerFit | null,
  topic: TedTopic | "all" = "all",
): TedTalk[] {
  const curated = searchTedCatalogForLearner("", topic, learner);
  const liveSorted = sortTedTalksByLearnerFit(liveTalks, learner);
  return uniqueTedTalks([...curated, ...liveSorted]);
}

export function formatTedAudienceChip(talk: TedTalk): string {
  const aud = inferTedAudience(talk);
  return `G${aud.gradeMin}–${aud.gradeMax}`;
}

export function formatTedFitSortCaption(learner?: TedLearnerFit | null): string {
  const grade = normalizeFitGrade(learner?.grade);
  const typical = typicalAgeForGrade(grade);
  const age =
    typeof learner?.age === "number" && Number.isFinite(learner.age)
      ? Math.round(learner.age)
      : typical;
  return `Sorted for G${grade} · age ${age}`;
}
