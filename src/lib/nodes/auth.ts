export function adminConfigured(): boolean {
  return Boolean(process.env.SPARK_ADMIN_TOKEN?.trim());
}

function cookieValue(req: Request, name: string): string {
  const raw = req.headers.get("cookie") || "";
  const parts = raw.split(";");
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      return part.slice(i + 1).trim();
    }
  }
  return "";
}

export function checkAdmin(req: Request): boolean {
  const expected = process.env.SPARK_ADMIN_TOKEN?.trim();
  if (!expected) return true;
  const got =
    req.headers.get("x-spark-admin")?.trim() ||
    new URL(req.url).searchParams.get("admin")?.trim() ||
    cookieValue(req, "spark_admin") ||
    "";
  return got === expected;
}

export function installKeysFromEnv() {
  return {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
    DASHSCOPE_API_KEY:
      process.env.DASHSCOPE_API_KEY ||
      process.env.BAILIAN_API_KEY ||
      process.env.ALIYUN_DASHSCOPE_API_KEY ||
      "",
    CURSOR_API_KEY: process.env.CURSOR_API_KEY || "",
    DEAPI_API_KEY: process.env.DEAPI_API_KEY || "",
  };
}
