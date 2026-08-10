import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

describe("console chat mobile resume contract", () => {
  it("MR-2/3: detached drive + GET snapshot; abort closes SSE only", async () => {
    const src = await fs.readFile(
      path.join(process.cwd(), "src/app/api/console/chat/route.ts"),
      "utf-8",
    );
    expect(src).toContain("driveConsoleRun");
    expect(src).toContain("void driveConsoleRun");
    expect(src).toContain("export async function GET");
    expect(src).toContain("activeRun");
    expect(src).toContain("Client abort closes SSE only");
    // abort listener must not close the agent
    expect(src).toMatch(/const onAbort = \(\) => \{ cls\(\); \};/);
    expect(src).not.toMatch(/req\.signal\.addEventListener\(["']abort["'], abort\)/);
  });
});
