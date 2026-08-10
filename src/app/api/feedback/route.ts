/**
 * POST /api/feedback — submit user feedback → GitHub issue + feasibility analysis.
 *
 * Requires GITHUB_TOKEN env var (classic PAT with `repo` scope).
 * Uses gh CLI as fallback if token is missing but gh is authenticated.
 */
import { NextResponse } from "next/server";
import { analyzeFeedback, formatTodoItem, type FeedbackInput } from "@/lib/feedback-analysis";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const GITHUB_REPO = "zilinli/ryan_learning";
const TODO_PATH = join(process.cwd(), "docs", "TODO.md");

function getGhToken(): string | null {
  return process.env.GITHUB_TOKEN?.trim() || null;
}

/** Create a GitHub issue via REST API. Returns the issue number and URL. */
async function createIssueViaApi(
  token: string,
  title: string,
  body: string,
  labels: string[],
): Promise<{ number: number; url: string }> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({ title, body, labels }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `GitHub API returned ${res.status}: ${errText.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as { number: number; html_url: string };
  return { number: data.number, url: data.html_url };
}

/** Fallback: create issue via `gh` CLI. */
function createIssueViaGh(
  title: string,
  body: string,
  labels: string[],
): { number: number; url: string } {
  const labelArg = labels.map((l) => `--label "${l}"`).join(" ");
  const cmd = `gh issue create --repo ${GITHUB_REPO} --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" ${labelArg} --json number,url`;

  const output = execSync(cmd, {
    encoding: "utf-8",
    timeout: 30_000,
    cwd: process.cwd(),
  }).trim();

  const parsed = JSON.parse(output) as { number: number; url: string };
  return parsed;
}

/** Append the feasibility analysis to TODO.md under a "User Feedback" section. */
function appendAnalysisToTodo(
  issueNumber: number,
  input: FeedbackInput,
): string {
  const analysis = analyzeFeedback(input);
  const line = formatTodoItem(issueNumber, input, analysis);

  // Ensure the directory exists
  const dir = join(process.cwd(), "docs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Read existing TODO.md
  let todo = "";
  if (existsSync(TODO_PATH)) {
    todo = readFileSync(TODO_PATH, "utf-8");
  }

  // Find or create the "User Feedback" section
  const sectionHeader = "## 📬 User Feedback";
  const sectionIdx = todo.indexOf(sectionHeader);

  if (sectionIdx >= 0) {
    // Section exists — append after the header line
    const afterHeader = todo.indexOf("\n", sectionIdx) + 1;
    const before = todo.slice(0, afterHeader);
    const after = todo.slice(afterHeader);
    const newEntry = `\n${line}\n`;
    todo = before + newEntry + after;
  } else {
    // Section doesn't exist — append at end
    const sectionBlock = `\n${sectionHeader}\n\n${line}\n`;
    todo = (todo.trimEnd() + "\n" + sectionBlock).trim() + "\n";
  }

  writeFileSync(TODO_PATH, todo, "utf-8");

  return JSON.stringify({
    analysis: {
      effort: analysis.effort,
      risk: analysis.risk,
      recommendation: analysis.recommendation,
      reason: analysis.reason,
      suggestedSection: analysis.suggestedSection,
      dependencies: analysis.dependencies,
    },
  });
}

export async function POST(request: Request) {
  try {
    let body: FeedbackInput;
    try {
      body = (await request.json()) as FeedbackInput;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    const { category, title, description } = body;

    // Validation
    if (!["bug", "feature", "question", "docs"].includes(category)) {
      return NextResponse.json(
        { error: "Invalid category. Must be: bug, feature, question, docs." },
        { status: 400 },
      );
    }
    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return NextResponse.json(
        { error: "Title must be at least 3 characters." },
        { status: 400 },
      );
    }
    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length < 10
    ) {
      return NextResponse.json(
        { error: "Description must be at least 10 characters." },
        { status: 400 },
      );
    }

    const cleanTitle = title.trim();
    const cleanDesc = description.trim();

    // Build issue body
    const issueBody = [
      `**Category:** ${category}`,
      `**Submitted:** ${new Date().toISOString()}`,
      "",
      cleanDesc,
    ].join("\n");

    const labels = ["user-feedback", category];

    // Create GitHub issue
    let issueNumber: number;
    let issueUrl: string;
    const token = getGhToken();

    try {
      if (token) {
        const result = await createIssueViaApi(
          token,
          cleanTitle,
          issueBody,
          labels,
        );
        issueNumber = result.number;
        issueUrl = result.url;
      } else {
        // Fallback to gh CLI
        const result = createIssueViaGh(cleanTitle, issueBody, labels);
        issueNumber = result.number;
        issueUrl = result.url;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[feedback] GitHub issue creation failed:", msg);
      return NextResponse.json(
        {
          error: `Failed to create GitHub issue: ${msg}. Make sure GITHUB_TOKEN is set or gh CLI is authenticated.`,
        },
        { status: 502 },
      );
    }

    // Run feasibility analysis and append to TODO.md
    let analysisJson: string;
    try {
      analysisJson = appendAnalysisToTodo(issueNumber, {
        category,
        title: cleanTitle,
        description: cleanDesc,
      });
    } catch (err) {
      console.error("[feedback] Analysis failed:", err);
      analysisJson = JSON.stringify({
        analysis: {
          error: "Feasibility analysis failed. Item was still created on GitHub.",
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        issueNumber,
        issueUrl,
        ...JSON.parse(analysisJson),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[feedback] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
