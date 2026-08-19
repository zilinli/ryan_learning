export function adminConfigured(): boolean {
  return Boolean(process.env.SPARK_ADMIN_TOKEN?.trim());
}

export function checkAdmin(req: Request): boolean {
  const expected = process.env.SPARK_ADMIN_TOKEN?.trim();
  if (!expected) return true;
  const got =
    req.headers.get("x-spark-admin")?.trim() ||
    new URL(req.url).searchParams.get("admin")?.trim() ||
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
