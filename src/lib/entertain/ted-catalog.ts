/**
 * Curated TED talk catalog for TED Lab (official embed only).
 * Embeds use embed.ted.com — do not scrape video files (TED usage policy).
 */

export type TedTopic =
  | "ideas"
  | "science"
  | "society"
  | "education"
  | "creativity"
  | "technology";

export type TedTalk = {
  slug: string;
  title: string;
  speaker: string;
  durationSec: number;
  topics: TedTopic[];
  blurb: string;
  /** Recommended grade window after list-fit (optional on raw catalog). */
  gradeMin?: number;
  gradeMax?: number;
};

export function tedTalkUrl(slug: string): string {
  return `https://www.ted.com/talks/${slug}`;
}

export function tedEmbedUrl(slug: string): string {
  return `https://embed.ted.com/talks/${slug}`;
}

export function parseTedSlug(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (/^[a-z0-9_]+$/i.test(t)) return t.toLowerCase();
  try {
    const u = new URL(t);
    if (!u.hostname.includes("ted.com")) return null;
    const m = /\/talks\/([a-z0-9_]+)/i.exec(u.pathname);
    return m?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** High-signal talks for international-school / advanced listeners. */
export const TED_CATALOG: TedTalk[] = [
  {
    slug: "sir_ken_robinson_do_schools_kill_creativity",
    title: "Do schools kill creativity?",
    speaker: "Sir Ken Robinson",
    durationSec: 1164,
    topics: ["education", "creativity", "ideas"],
    blurb: "A classic argument about how schooling can flatten originality.",
  },
  {
    slug: "chimamanda_ngozi_adichie_the_danger_of_a_single_story",
    title: "The danger of a single story",
    speaker: "Chimamanda Ngozi Adichie",
    durationSec: 1129,
    topics: ["society", "ideas", "education"],
    blurb: "How incomplete narratives distort how we see people and places.",
  },
  {
    slug: "simon_sinek_how_great_leaders_inspire_action",
    title: "How great leaders inspire action",
    speaker: "Simon Sinek",
    durationSec: 1074,
    topics: ["ideas", "society"],
    blurb: "Start with why — a framework students love to debate.",
  },
  {
    slug: "brene_brown_the_power_of_vulnerability",
    title: "The power of vulnerability",
    speaker: "Brené Brown",
    durationSec: 1219,
    topics: ["society", "ideas"],
    blurb: "Courage, connection, and the research behind showing up.",
  },
  {
    slug: "amy_cuddy_your_body_language_may_shape_who_you_are",
    title: "Your body language may shape who you are",
    speaker: "Amy Cuddy",
    durationSec: 1262,
    topics: ["science", "society"],
    blurb: "Presence, posture, and contested social-science claims — good for critique.",
  },
  {
    slug: "tim_urban_inside_the_mind_of_a_master_procrastinator",
    title: "Inside the mind of a master procrastinator",
    speaker: "Tim Urban",
    durationSec: 840,
    topics: ["ideas", "education", "creativity"],
    blurb: "Instant gratification monkey vs rational decision-maker — witty metacognition.",
  },
  {
    slug: "elizabeth_gilbert_your_elusive_creative_genius",
    title: "Your elusive creative genius",
    speaker: "Elizabeth Gilbert",
    durationSec: 1147,
    topics: ["creativity", "ideas"],
    blurb: "Separating the self from the muse — useful for writers.",
  },
  {
    slug: "susan_cain_the_power_of_introverts",
    title: "The power of introverts",
    speaker: "Susan Cain",
    durationSec: 1140,
    topics: ["society", "education", "ideas"],
    blurb: "Quiet strength in a culture that rewards the loudest voice.",
  },
  {
    slug: "dan_pink_the_puzzle_of_motivation",
    title: "The puzzle of motivation",
    speaker: "Dan Pink",
    durationSec: 1107,
    topics: ["science", "ideas", "education"],
    blurb: "Autonomy, mastery, purpose — and when carrots fail.",
  },
  {
    slug: "carol_dweck_the_power_of_believing_that_you_can_improve",
    title: "The power of believing that you can improve",
    speaker: "Carol Dweck",
    durationSec: 620,
    topics: ["education", "science", "ideas"],
    blurb: "Growth mindset — short, sharp, and ripe for nuanced challenge.",
  },
  {
    slug: "shawn_achor_the_happy_secret_to_better_work",
    title: "The happy secret to better work",
    speaker: "Shawn Achor",
    durationSec: 740,
    topics: ["science", "ideas"],
    blurb: "Positive psychology meets productivity — test the causal claims.",
  },
  {
    slug: "angela_lee_duckworth_grit_the_power_of_passion_and_perseverance",
    title: "Grit: the power of passion and perseverance",
    speaker: "Angela Lee Duckworth",
    durationSec: 365,
    topics: ["education", "science"],
    blurb: "Grit as predictor — invite students to steelman and critique.",
  },
  {
    slug: "julian_treasure_how_to_speak_so_that_people_want_to_listen",
    title: "How to speak so that people want to listen",
    speaker: "Julian Treasure",
    durationSec: 598,
    topics: ["ideas", "education"],
    blurb: "Voice as an instrument — perfect warm-up for listening lab.",
  },
  {
    slug: "kelly_mcgonigal_how_to_make_stress_your_friend",
    title: "How to make stress your friend",
    speaker: "Kelly McGonigal",
    durationSec: 868,
    topics: ["science", "society"],
    blurb: "Reframing stress physiology — check evidence vs inspiration.",
  },
  {
    slug: "hans_rosling_the_best_stats_you_ve_ever_seen",
    title: "The best stats you've ever seen",
    speaker: "Hans Rosling",
    durationSec: 1173,
    topics: ["science", "society", "technology"],
    blurb: "Data visualization that overturns gut myths about the world.",
  },
  {
    slug: "yuval_noah_harari_what_explains_the_rise_of_humans",
    title: "What explains the rise of humans?",
    speaker: "Yuval Noah Harari",
    durationSec: 1032,
    topics: ["ideas", "society", "science"],
    blurb: "Shared myths as superpower — philosophy meets history.",
  },
  {
    slug: "feifei_li_how_we_re_teaching_computers_to_understand_pictures",
    title: "How we're teaching computers to understand pictures",
    speaker: "Fei-Fei Li",
    durationSec: 1084,
    topics: ["technology", "science"],
    blurb: "Computer vision and ImageNet — STEM listening for builders.",
  },
  {
    slug: "margaret_heffernan_dare_to_disagree",
    title: "Dare to disagree",
    speaker: "Margaret Heffernan",
    durationSec: 776,
    topics: ["ideas", "society"],
    blurb: "Constructive conflict as a thinking tool — BASIS-aligned.",
  },
  {
    slug: "adam_grant_the_surprising_habits_of_original_thinkers",
    title: "The surprising habits of original thinkers",
    speaker: "Adam Grant",
    durationSec: 904,
    topics: ["creativity", "ideas", "education"],
    blurb: "Procrastination, doubt, and originality — meta for creators.",
  },
  {
    slug: "celeste_headlee_10_ways_to_have_a_better_conversation",
    title: "10 ways to have a better conversation",
    speaker: "Celeste Headlee",
    durationSec: 700,
    topics: ["society", "education", "ideas"],
    blurb: "Listening as a discipline — mirrors what TED Lab practices.",
  },
  {
    slug: "stuart_brown_play_is_more_than_just_fun",
    title: "Play is more than just fun",
    speaker: "Stuart Brown",
    durationSec: 1008,
    topics: ["science", "education", "ideas"],
    blurb: "Play as a biological drive — argue with the evidence base.",
  },
  {
    slug: "pamela_meyer_how_to_spot_a_liar",
    title: "How to spot a liar",
    speaker: "Pamela Meyer",
    durationSec: 1130,
    topics: ["society", "ideas"],
    blurb: "Deception detection claims — ripe for methodological critique.",
  },
  {
    slug: "barry_schwartz_the_paradox_of_choice",
    title: "The paradox of choice",
    speaker: "Barry Schwartz",
    durationSec: 1170,
    topics: ["society", "ideas", "science"],
    blurb: "More options, less satisfaction — test the causal story.",
  },
  {
    slug: "daniel_kahneman_the_riddle_of_experience_vs_memory",
    title: "The riddle of experience vs. memory",
    speaker: "Daniel Kahneman",
    durationSec: 1203,
    topics: ["science", "ideas"],
    blurb: "Experiencing self vs remembering self — advanced cognition.",
  },
  {
    slug: "jon_ronson_strange_answers_to_the_psychopath_test",
    title: "Strange answers to the psychopath test",
    speaker: "Jon Ronson",
    durationSec: 1068,
    topics: ["society", "science"],
    blurb: "Labeling, power, and psychiatric categories — careful listening.",
  },
  {
    slug: "rita_pierson_every_kid_needs_a_champion",
    title: "Every kid needs a champion",
    speaker: "Rita Pierson",
    durationSec: 452,
    topics: ["education", "society"],
    blurb: "Relationships as the engine of learning — short and fierce.",
  },
  {
    slug: "eduardo_briceno_how_to_get_better_at_the_things_you_care_about",
    title: "How to get better at the things you care about",
    speaker: "Eduardo Briceño",
    durationSec: 650,
    topics: ["education", "ideas"],
    blurb: "Learning zone vs performance zone — meta for Studio work.",
  },
  {
    slug: "alex_gendler_can_you_solve_the_prisoner_hat_riddle",
    title: "Can you solve the prisoner hat riddle?",
    speaker: "Alex Gendler",
    durationSec: 272,
    topics: ["ideas", "education"],
    blurb: "TED-Ed logic warm-up — structure of collaborative reasoning.",
  },
  {
    slug: "steven_johnson_where_good_ideas_come_from",
    title: "Where good ideas come from",
    speaker: "Steven Johnson",
    durationSec: 1065,
    topics: ["creativity", "ideas", "technology"],
    blurb: "Slow hunches and liquid networks — argue with the history.",
  },
  {
    slug: "david_eagleman_can_we_create_new_senses_for_humans",
    title: "Can we create new senses for humans?",
    speaker: "David Eagleman",
    durationSec: 1235,
    topics: ["science", "technology"],
    blurb: "Sensory substitution — STEM listening with a wow hook.",
  },
  {
    slug: "monica_lewinsky_the_price_of_shame",
    title: "The price of shame",
    speaker: "Monica Lewinsky",
    durationSec: 1296,
    topics: ["society", "technology"],
    blurb: "Public shaming and empathy online — mature society critique.",
  },
  {
    slug: "chris_anderson_ted_s_secret_to_great_public_speaking",
    title: "TED's secret to great public speaking",
    speaker: "Chris Anderson",
    durationSec: 462,
    topics: ["ideas", "education"],
    blurb: "Idea transmission as the craft behind the talks you watch.",
  },
  {
    slug: "isaac_lidsky_what_reality_are_you_creating_for_yourself",
    title: "What reality are you creating for yourself?",
    speaker: "Isaac Lidsky",
    durationSec: 700,
    topics: ["ideas", "society"],
    blurb: "Perception vs reality — philosophical listening for teens.",
  },
  {
    slug: "drew_dudley_everyday_leadership",
    title: "Everyday leadership",
    speaker: "Drew Dudley",
    durationSec: 370,
    topics: ["ideas", "society", "education"],
    blurb: "Lollipop moments — short talk, big claim about impact.",
  },
  {
    slug: "sarah_jayne_blakemore_the_mysterious_workings_of_the_adolescent_brain",
    title: "The mysterious workings of the adolescent brain",
    speaker: "Sarah-Jayne Blakemore",
    durationSec: 842,
    topics: ["science", "education"],
    blurb: "Teen neurodevelopment — listen as the subject of the science.",
  },
  {
    slug: "pico_iyer_where_is_home",
    title: "Where is home?",
    speaker: "Pico Iyer",
    durationSec: 843,
    topics: ["society", "ideas"],
    blurb: "Global identity and belonging — rich for retell + critique.",
  },
  {
    slug: "apollo_robbins_the_art_of_misdirection",
    title: "The art of misdirection",
    speaker: "Apollo Robbins",
    durationSec: 517,
    topics: ["ideas", "science"],
    blurb: "Attention as a scarce resource — fun hook, serious claim.",
  },
  {
    slug: "julia_galef_why_you_think_you_re_right_even_if_you_re_wrong",
    title: "Why you think you're right — even if you're wrong",
    speaker: "Julia Galef",
    durationSec: 695,
    topics: ["ideas", "science", "education"],
    blurb: "Scout mindset vs soldier mindset — perfect for steelman drills.",
  },
  {
    slug: "manoush_zomorodi_how_boredom_can_lead_to_your_most_brilliant_ideas",
    title: "How boredom can lead to your most brilliant ideas",
    speaker: "Manoush Zomorodi",
    durationSec: 970,
    topics: ["creativity", "technology", "ideas"],
    blurb: "Default mode and phone habits — debate the causal leap.",
  },
];

export function findTedTalk(slug: string): TedTalk | undefined {
  return TED_CATALOG.find((t) => t.slug === slug);
}

export function searchTedCatalog(query: string, topic?: TedTopic | "all"): TedTalk[] {
  const q = query.trim().toLowerCase();
  return TED_CATALOG.filter((t) => {
    if (topic && topic !== "all" && !t.topics.includes(topic)) return false;
    if (!q) return true;
    const hay = `${t.title} ${t.speaker} ${t.blurb} ${t.topics.join(" ")}`.toLowerCase();
    return hay.includes(q) || t.slug.includes(q.replace(/\s+/g, "_"));
  });
}
