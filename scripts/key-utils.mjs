export function isCursorApiKey(value) {
  const key = value?.trim() ?? "";
  return key.startsWith("cursor_") || key.startsWith("crsr_");
}
