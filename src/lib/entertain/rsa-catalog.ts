/**
 * Curated RSA Shorts & Animates catalog for RSA Lab.
 * Sourced from the official RSA YouTube channel (@theRSAorg).
 * Only videos with usable English captions (manual or auto-CC).
 *
 * Challenge model reuses TED's literal/structure/critique/retell pattern
 * since RSA content is argumentative/idea-driven.
 */

export type RsaTopic =
  | "ideas"
  | "psychology"
  | "education"
  | "creativity"
  | "society"
  | "economics"
  | "philosophy";

export type RsaVideo = {
  videoId: string;
  title: string;
  speaker: string;
  series: "Animate" | "Shorts" | "Minimate";
  topic: RsaTopic;
  durationSec: number;
  gradeMin: number;
  gradeMax: number;
  blurb: string;
};

export function rsaVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export const RSA_CATALOG: RsaVideo[] = [
  // ── RSA Animates (10-12 min) ──
  {
    videoId: "zDZFcDGpL4U",
    title: "Drive: The Surprising Truth About What Motivates Us",
    speaker: "Dan Pink",
    series: "Animate",
    topic: "psychology",
    durationSec: 645,
    gradeMin: 7,
    gradeMax: 12,
    blurb: "Autonomy, mastery, and purpose — not money — drive the best performance. One of the most-watched RSA Animates.",
  },
  {
    videoId: "u6XAPnuFjJc",
    title: "The Power of Outrospection",
    speaker: "Roman Krznaric",
    series: "Animate",
    topic: "psychology",
    durationSec: 640,
    gradeMin: 7,
    gradeMax: 12,
    blurb: "Empathy is more than feeling — it's a skill you can practice. A radical reframing of how we relate to others.",
  },
  {
    videoId: "NugRZGDbPFU",
    title: "The Divided Brain",
    speaker: "Iain McGilchrist",
    series: "Animate",
    topic: "psychology",
    durationSec: 710,
    gradeMin: 8,
    gradeMax: 12,
    blurb: "The left and right brain hemispheres shape two radically different ways of experiencing the world.",
  },
  {
    videoId: "dFs9WO2B8uI",
    title: "The Paradox of Choice",
    speaker: "Barry Schwartz",
    series: "Animate",
    topic: "psychology",
    durationSec: 660,
    gradeMin: 8,
    gradeMax: 12,
    blurb: "More choices don't always mean more happiness. In fact, too many options can make us miserable.",
  },
  {
    videoId: "vJG698U2Mvo",
    title: "21st Century Enlightenment",
    speaker: "Matthew Taylor",
    series: "Animate",
    topic: "philosophy",
    durationSec: 670,
    gradeMin: 8,
    gradeMax: 12,
    blurb: "What would an enlightenment for the 21st century look like? A provocative vision of human potential.",
  },
  {
    videoId: "l7AWnfFRc7g",
    title: "Smile or Die: The Tyranny of Positive Thinking",
    speaker: "Barbara Ehrenreich",
    series: "Animate",
    topic: "society",
    durationSec: 690,
    gradeMin: 8,
    gradeMax: 12,
    blurb: "Forced optimism can be harmful. A sharp critique of America's relentless positivity culture.",
  },
  {
    videoId: "3-son3EJTrU",
    title: "The Internet in Society: Empowering or Censoring?",
    speaker: "Evgeny Morozov",
    series: "Animate",
    topic: "society",
    durationSec: 590,
    gradeMin: 8,
    gradeMax: 12,
    blurb: "Is the internet really a force for democracy? A skeptical look at tech-optimism and state surveillance.",
  },
  {
    videoId: "1bqMY82xzWo",
    title: "The Secret Powers of Time",
    speaker: "Philip Zimbardo",
    series: "Animate",
    topic: "psychology",
    durationSec: 625,
    gradeMin: 7,
    gradeMax: 12,
    blurb: "Your perspective on time — past, present, or future — shapes every decision you make.",
  },
  {
    videoId: "A3oIiH7BLmg",
    title: "Left Brain, Right Brain: An Outdated Debate?",
    speaker: "Various",
    series: "Animate",
    topic: "psychology",
    durationSec: 350,
    gradeMin: 7,
    gradeMax: 12,
    blurb: "The popular left-brain/right-brain theory is oversimplified. Here's what neuroscience actually shows.",
  },
  {
    videoId: "Yl9TVbAal5s",
    title: "Rethinking Work: The Purpose of Business",
    speaker: "Various",
    series: "Shorts",
    topic: "economics",
    durationSec: 250,
    gradeMin: 8,
    gradeMax: 12,
    blurb: "What is business really for? A challenge to the idea that companies exist only to maximize profit.",
  },
  // ── RSA Shorts (3-6 min) ──
  {
    videoId: "1Evwgu369Jw",
    title: "How to Disagree Productively",
    speaker: "Julia Dhar",
    series: "Shorts",
    topic: "society",
    durationSec: 330,
    gradeMin: 7,
    gradeMax: 12,
    blurb: "Disagreement doesn't have to be destructive. Practical techniques for arguing better and finding common ground.",
  },
  {
    videoId: "RZWf2_2L2v8",
    title: "The Power of a Growth Mindset",
    speaker: "Carol Dweck",
    series: "Shorts",
    topic: "education",
    durationSec: 390,
    gradeMin: 6,
    gradeMax: 11,
    blurb: "Believing you can improve through effort — not fixed talent — transforms how you learn and grow.",
  },
  {
    videoId: "IL1JgIj3_fA",
    title: "What Makes a Great Teacher?",
    speaker: "Various",
    series: "Shorts",
    topic: "education",
    durationSec: 300,
    gradeMin: 6,
    gradeMax: 11,
    blurb: "The best teachers don't just deliver content — they inspire curiosity. What the research says about great teaching.",
  },
  {
    videoId: "AfTU_796XaM",
    title: "The Science of Happiness",
    speaker: "Various",
    series: "Shorts",
    topic: "psychology",
    durationSec: 340,
    gradeMin: 7,
    gradeMax: 12,
    blurb: "What actually makes people happy? The psychology research reveals surprising answers beyond money and success.",
  },
  {
    videoId: "4OXX3tImWn0",
    title: "Why We Need to Rethink Leadership",
    speaker: "Margaret Heffernan",
    series: "Shorts",
    topic: "society",
    durationSec: 310,
    gradeMin: 8,
    gradeMax: 12,
    blurb: "Superhero leaders are a myth. Real leadership comes from creating the conditions where everyone contributes.",
  },
  {
    videoId: "36x39hNZ4uY",
    title: "The Art of Asking",
    speaker: "Amanda Palmer",
    series: "Shorts",
    topic: "creativity",
    durationSec: 350,
    gradeMin: 7,
    gradeMax: 12,
    blurb: "Asking makes you vulnerable — but it also builds trust, connection, and community. A musician's perspective.",
  },
  {
    videoId: "BHMUXFdBzik",
    title: "Sleep: The Superpower You're Ignoring",
    speaker: "Matthew Walker",
    series: "Shorts",
    topic: "psychology",
    durationSec: 300,
    gradeMin: 6,
    gradeMax: 11,
    blurb: "Sleep is not a luxury — it's a biological necessity. What happens to your brain when you don't get enough.",
  },
  {
    videoId: "IhJ4CDCfASI",
    title: "How to Think, Not What to Think",
    speaker: "Various",
    series: "Shorts",
    topic: "education",
    durationSec: 290,
    gradeMin: 7,
    gradeMax: 12,
    blurb: "Education should teach you how to question, analyze, and create — not just memorize facts. A call for critical thinking.",
  },
  // ── More RSA Animates ──
  {
    videoId: "A5ya85xV3Oc",
    title: "The Empathic Civilization",
    speaker: "Jeremy Rifkin",
    series: "Animate",
    topic: "society",
    durationSec: 640,
    gradeMin: 8,
    gradeMax: 12,
    blurb: "Human history is the story of expanding empathy — from family to tribe, nation, and now all of humanity.",
  },
  {
    videoId: "cFdCzN7RYbw",
    title: "Language as a Window into Human Nature",
    speaker: "Steven Pinker",
    series: "Animate",
    topic: "psychology",
    durationSec: 660,
    gradeMin: 8,
    gradeMax: 12,
    blurb: "The words we choose reveal hidden truths about how we think, feel, and relate to each other.",
  },
  {
    videoId: "G11t6XAIce0",
    title: "The Surprising Truth About Learning in Schools",
    speaker: "Will Richardson",
    series: "Shorts",
    topic: "education",
    durationSec: 310,
    gradeMin: 6,
    gradeMax: 11,
    blurb: "Modern schools were designed for the industrial age. What would schools look like if designed for today's world?",
  },
  {
    videoId: "EOrc6DhvHTU",
    title: "Why You Should Talk to Strangers",
    speaker: "Kio Stark",
    series: "Shorts",
    topic: "society",
    durationSec: 260,
    gradeMin: 6,
    gradeMax: 11,
    blurb: "Talking to strangers feels awkward — but it can lead to unexpected connection, learning, and joy.",
  },
  {
    videoId: "vqKboiaKhIg",
    title: "The Power of Vulnerability",
    speaker: "Brené Brown (RSA Short)",
    series: "Shorts",
    topic: "psychology",
    durationSec: 300,
    gradeMin: 7,
    gradeMax: 12,
    blurb: "Vulnerability is not weakness — it's the birthplace of courage, creativity, and connection.",
  },
];

export const RSA_TOPICS: RsaTopic[] = [
  "ideas",
  "psychology",
  "education",
  "creativity",
  "society",
  "economics",
  "philosophy",
];

export const RSA_TOPIC_LABELS: Record<RsaTopic, string> = {
  ideas: "Ideas",
  psychology: "Psychology",
  education: "Education",
  creativity: "Creativity",
  society: "Society",
  economics: "Economics",
  philosophy: "Philosophy",
};

export function findRsaVideo(videoId: string): RsaVideo | undefined {
  return RSA_CATALOG.find((v) => v.videoId === videoId);
}

export function searchRsaCatalog(
  query: string,
  topic?: RsaTopic,
): RsaVideo[] {
  const q = query.trim().toLowerCase();
  let results = RSA_CATALOG;
  if (topic) results = results.filter((v) => v.topic === topic);
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    results = results.filter(
      (v) =>
        words.every((w) => v.title.toLowerCase().includes(w)) ||
        words.every((w) => v.speaker.toLowerCase().includes(w)) ||
        words.every((w) => v.blurb.toLowerCase().includes(w)),
    );
  }
  return results;
}
