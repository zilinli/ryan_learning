import type {
  ChatAttachment,
  ChatAttachmentPayload,
  ChatMessage,
  ChatQuote,
} from "./types";
import { stripDataUrlPrefix } from "./attachments";

export const QUOTE_EXCERPT_MAX = 160;
export const QUOTE_CONTENT_MAX = 2000;
export const QUOTE_MAX_ATTACHMENTS = 9;

/** Collapse whitespace and clip for a compact snippet. */
export function clipQuoteText(text: string, max: number): string {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Legacy + current attachment sources on one message. */
export function attachmentsOf(m: ChatMessage): ChatAttachment[] {
  if (m.attachments?.length) return m.attachments;
  if (m.image?.dataUrl) {
    return [
      {
        id: `${m.id}-img`,
        name: "photo",
        mimeType: m.image.mimeType,
        kind: "image",
        dataUrl: m.image.dataUrl,
      },
    ];
  }
  return [];
}

/** Build the lightweight client quote (messageId / author / excerpt). */
export function buildQuoteFromMessage(m: ChatMessage): ChatQuote {
  const atts = attachmentsOf(m);
  let excerpt = clipQuoteText(m.content, QUOTE_EXCERPT_MAX);
  if (!excerpt && atts.length) {
    const imgs = atts.filter((a) => a.kind === "image").length;
    const files = atts.length - imgs;
    const parts: string[] = [];
    if (imgs) parts.push(`${imgs} photo${imgs > 1 ? "s" : ""}`);
    if (files) parts.push(`${files} file${files > 1 ? "s" : ""}`);
    excerpt = parts.join(" + ");
  }
  return {
    messageId: m.id,
    author: m.role === "user" ? "user" : "assistant",
    excerpt,
  };
}

/**
 * Convert stored chat attachments into the wire format so quoted media is
 * re-sent to the model: images as raw base64 (`data`), binary files as base64,
 * text documents as their charset data URL.
 */
export function quoteAttachmentsToPayload(
  atts: ChatAttachment[],
): ChatAttachmentPayload[] {
  return atts.slice(0, QUOTE_MAX_ATTACHMENTS).map((a) => {
    const payload: ChatAttachmentPayload = {
      name: a.name,
      mimeType: a.mimeType,
      kind: a.kind,
    };
    if (a.dataUrl) {
      if (a.kind === "image" || /;base64,/i.test(a.dataUrl)) {
        payload.data = stripDataUrlPrefix(a.dataUrl);
      } else {
        payload.dataUrl = a.dataUrl;
      }
    }
    if (a.mediaId) payload.mediaId = a.mediaId;
    return payload;
  });
}

/**
 * Resolve the full wire quote at send time: look up the quoted message and
 * attach its clipped text + re-sendable attachments (images and files).
 */
export function resolveQuoteForSend(
  quote: ChatQuote,
  messages: ChatMessage[],
): ChatQuote {
  const src = messages.find((m) => m.id === quote.messageId);
  if (!src) return quote;
  return {
    ...quote,
    content: clipQuoteText(src.content, QUOTE_CONTENT_MAX),
    attachments: quoteAttachmentsToPayload(attachmentsOf(src)),
  };
}
