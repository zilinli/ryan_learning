/**
 * Parse a fetch Response as JSON without throwing cryptic SyntaxError
 * when the server returns plain text like "Internal Server Error".
 */
export async function readResponseJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.slice(0, 80).replace(/\s+/g, " ").trim();
    if (
      res.status >= 500 ||
      /^Internal Server Error/i.test(snippet) ||
      /^Bad Gateway/i.test(snippet)
    ) {
      throw new Error("Server briefly unavailable — try again in a moment.");
    }
    throw new Error(
      snippet
        ? `Bad response (${res.status}): ${snippet}`
        : `Bad response (${res.status})`,
    );
  }
}
