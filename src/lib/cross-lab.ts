/**
 * P2-4 — cross-lab content recommendations: "you just saw a black hole in
 * TED — next, see the stars at NatGeo". Each lab passes the topic tags of the
 * current piece; a keyword router suggests the next lab that covers that
 * thread. Pure so it is unit-testable; the component just renders the link.
 */

export type LabId = "ted" | "natgeo" | "bbc" | "rsa" | "podcast";

export const LAB_GAME_PARAM: Record<LabId, string> = {
  ted: "ted-lab",
  natgeo: "natgeo-lab",
  bbc: "bbc-lab",
  rsa: "rsa-lab",
  podcast: "podcast-lab",
};

export const LAB_TITLES: Record<LabId, string> = {
  ted: "TED Lab",
  natgeo: "NatGeo Lab",
  bbc: "BBC Doc Lab",
  rsa: "RSA Lab",
  podcast: "Podcast Lab",
};

export type LabSuggestion = {
  to: LabId;
  /** One-line "keep the thread" pitch for the card. */
  line: string;
};

/** Topic tag → another lab that carries the same thread further. */
const KEYWORD_ROUTES: Array<{ re: RegExp; to: LabId }> = [
  { re: /space|astronom|planet|star|universe|galaxy|black hole|cosmos/i, to: "natgeo" },
  { re: /animal|wildlife|nature|ocean|dinosaur|biology|marine/i, to: "bbc" },
  { re: /geography|climate|earth|environment|energy/i, to: "natgeo" },
  { re: /history|documentary|ancient|world/i, to: "bbc" },
  { re: /ideas|society|psychology|education|creativity|sociology/i, to: "rsa" },
  { re: /science|technology|discovery|experiment/i, to: "ted" },
];

/** When no tag matches, this is the polite default next stop. */
const FALLBACK: Record<LabId, LabId> = {
  ted: "natgeo",
  natgeo: "ted",
  bbc: "natgeo",
  rsa: "ted",
  podcast: "ted",
};

export function suggestNextLab(
  from: LabId,
  tags: string[],
): LabSuggestion | null {
  if (!tags?.length) return null;
  for (const tag of tags) {
    for (const rule of KEYWORD_ROUTES) {
      if (rule.to !== from && rule.re.test(tag)) {
        return {
          to: rule.to,
          line: `You just explored “${tag}” here — keep the thread going in ${LAB_TITLES[rule.to]}.`,
        };
      }
    }
  }
  const to = FALLBACK[from];
  return {
    to,
    line: `Curious to go further? Keep this thread alive in ${LAB_TITLES[to]}.`,
  };
}
