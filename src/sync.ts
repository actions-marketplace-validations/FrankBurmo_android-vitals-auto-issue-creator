import * as core from "@actions/core";
import { ActionConfig } from "./types.js";
import { PlayReportingClient } from "./play-client.js";
import { GitHubClient } from "./github-client.js";

export async function syncApp(
  playClient: PlayReportingClient,
  githubClient: GitHubClient,
  packageName: string,
  config: ActionConfig
): Promise<{ created: number; closed: number }> {
  let created = 0;
  let closed = 0;

  let filter = "";
  if (config.errorTypes === "CRASH") {
    filter = "errorIssueType = CRASH";
  } else if (config.errorTypes === "ANR") {
    filter = "errorIssueType = ANR";
  }

  const issues = await playClient.fetchErrorIssues(packageName, filter);
  core.info(`   Found ${issues.length} issues in Play Console for ${packageName}`);

  for (const issue of issues) {
    if (issue.affectedUsers < config.minAffectedUsers) {
      continue;
    }

    const dedupeLabel = `${config.labelPrefix}${issue.id}`;
    const existingIssue = await githubClient.findIssueByLabel(dedupeLabel);

    if (!existingIssue) {
      if (!issue.isResolved) {
        await githubClient.ensureLabel(dedupeLabel, "ededed");
        for (const label of config.extraLabels) {
          await githubClient.ensureLabel(label);
        }
        
        await githubClient.createIssue(issue, [dedupeLabel, ...config.extraLabels]);
        created++;
        core.info(`     Created issue for ${issue.id}`);
      }
    } else {
      if (config.closeResolved && issue.isResolved && existingIssue.state === "open") {
        await githubClient.closeIssue(
          existingIssue.number,
          "This issue is marked as resolved in Google Play Console. Closing issue."
        );
        closed++;
        core.info(`     Closed issue ${existingIssue.number} for ${issue.id}`);
      }
    }
  }

  return { created, closed };
}
