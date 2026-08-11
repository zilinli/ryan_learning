/**
 * Keep a runnable production `.next` across failed / interrupted builds.
 * Code Agent `deploy_live` and IDE builds share this tree with PM2 `npm start`.
 */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function buildIdPath(nextDir) {
  return join(nextDir, "BUILD_ID");
}

export function hasProdBuild(nextDir) {
  return existsSync(buildIdPath(nextDir));
}

/**
 * Move live `.next` aside before a destructive rebuild.
 * Returns true if a previous artifact was stashed.
 */
export function stashNextArtifact(nextDir, prevDir) {
  if (existsSync(prevDir)) {
    rmSync(prevDir, { recursive: true, force: true });
  }
  if (!existsSync(nextDir)) return false;
  renameSync(nextDir, prevDir);
  return true;
}

/** Drop an incomplete new `.next` (keep stash). */
export function clearIncompleteNext(nextDir) {
  if (existsSync(nextDir)) {
    rmSync(nextDir, { recursive: true, force: true });
  }
}

/**
 * Restore stashed artifact after failed/interrupted build.
 * Returns true if restore happened.
 */
export function restoreNextArtifact(nextDir, prevDir) {
  if (!existsSync(prevDir)) return false;
  clearIncompleteNext(nextDir);
  renameSync(prevDir, nextDir);
  return true;
}

/** After a successful build with BUILD_ID, drop the stash. */
export function discardStashedNext(prevDir) {
  if (existsSync(prevDir)) {
    rmSync(prevDir, { recursive: true, force: true });
    return true;
  }
  return false;
}

/** Test helper: create a fake production `.next` tree. */
export function writeFakeProdBuild(nextDir, buildId = "test-build") {
  mkdirSync(nextDir, { recursive: true });
  writeFileSync(buildIdPath(nextDir), buildId);
}
