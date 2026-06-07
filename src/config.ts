import * as core from "@actions/core";
import { ActionConfig } from "./types.js";

export function parseConfig(): ActionConfig {
  const serviceAccountJsonStr = core.getInput("service-account-json", { required: true });
  let serviceAccountJson: any;
  try {
    serviceAccountJson = JSON.parse(serviceAccountJsonStr);
  } catch (error) {
    throw new Error(`Failed to parse service-account-json: ${(error as Error).message}`);
  }

  const packageNames = core.getInput("package-names", { required: true })
    .split(",")
    .map(name => name.trim())
    .filter(name => name.length > 0);

  const packageRepoMapStr = core.getInput("package-repo-map") || "{}";
  let packageRepoMap: Record<string, string> = {};
  try {
    packageRepoMap = JSON.parse(packageRepoMapStr);
  } catch (error) {
    throw new Error(`Failed to parse package-repo-map: ${(error as Error).message}`);
  }

  const githubToken = core.getInput("github-token", { required: true });
  const labelPrefix = core.getInput("label-prefix") || "play-error:";
  const extraLabels = core.getInput("extra-labels")
    .split(",")
    .map(l => l.trim())
    .filter(l => l.length > 0);
  
  const closeResolved = core.getInput("close-resolved") === "true";
  const errorTypes = (core.getInput("error-types") || "ALL") as "CRASH" | "ANR" | "ALL";
  const minAffectedUsers = parseInt(core.getInput("min-affected-users") || "1", 10);

  const targetRepoInput = core.getInput("target-repo");
  let defaultRepo: { owner: string; repo: string };

  if (targetRepoInput) {
    const [owner, repo] = targetRepoInput.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid target-repo format: ${targetRepoInput}. Expected owner/repo.`);
    }
    defaultRepo = { owner, repo };
  } else {
    const fullRepo = process.env.GITHUB_REPOSITORY;
    if (!fullRepo) {
      throw new Error("GITHUB_REPOSITORY environment variable is not set and target-repo input is missing.");
    }
    const [owner, repo] = fullRepo.split("/");
    defaultRepo = { owner, repo };
  }

  return {
    serviceAccountJson,
    packageNames,
    packageRepoMap,
    defaultRepo,
    githubToken,
    labelPrefix,
    extraLabels,
    closeResolved,
    errorTypes,
    minAffectedUsers
  };
}
