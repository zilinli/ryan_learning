/**
 * V2 P1 — interest → creation loop (report §9.1.3).
 * Closes the flywheel: when an exploration ends with the child both *getting
 * it right* and *saying they loved it*, Spark offers a light "turn it into a
 * mini creation" card that routes to Writing Studio or the Journal. Pure
 * signal-detection lives here (unit-testable); session state lives in the hook.
 */

/** Enthusiasm signals in the child's own words. */
const LIKE_RE =
  /(?:^|[\s.,!?])(enjoy(?:ed)?|love(?:d)?|like(?:d)?|fun|cool|awesome|amazing|interesting)\b|好玩|喜欢|喜歡|中意|鍾意|有趣|爱|愛/i;

/**
 * True when the child's turn reads as "I liked this" AND the tutor actually
 * replied (so a bare "like" in a standalone question doesn't fire).
 */
export function likesTopicSignal(
  userText: string,
  assistantText: string,
): boolean {
  const t = String(userText || "");
  return t.length > 0 && LIKE_RE.test(t) && String(assistantText || "").trim().length > 0;
}

export type CreationOffer = {
  /** The topic/interest label this creation would build on. */
  topicLabel: string;
  createdAt: number;
};

/** Kid-facing headline for the creation card. */
export function creationOfferLine(offer: CreationOffer): string {
  return `You nailed "${offer.topicLabel}" and it sounded like fun — want to turn it into a mini creation?`;
}
