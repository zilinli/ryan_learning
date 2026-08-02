/**
 * Optional built-in key for local kid launch.
 * Keep empty in git — use `.env.local` or `config/secret.bin` on the server.
 */
export const DEFAULT_CURSOR_API_KEY = process.env.CURSOR_API_KEY?.trim() || "";
