import * as core from "@actions/core";
import { parseConfig } from "./config";
import { PlayReportingClient } from "./play-client";
import { GitHubClient } from "./github-client";
import { syncApp } from "./sync";

async function run(): Promise<void> {
  try {
    const config = parseConfig();
    const playClient = new PlayReportingClient(config.serviceAccountJson);

    let totalCreated = 0;
    let totalClosed = 0;

    for (const packageName of config.packageNames) {
      const repo = config.packageRepoMap[packageName] || null;
      const target = repo
        ? { owner: repo.split("/")[0], repo: repo.split("/")[1] }
        : config.defaultRepo;

      core.info(`🔍 Syncing ${packageName} -> ${target.owner}/${target.repo}`);

      const githubClient = new GitHubClient(config.githubToken, target.owner, target.repo);
      const result = await syncApp(playClient, githubClient, packageName, config);

      totalCreated += result.created;
      totalClosed += result.closed;

      core.info(`   ✅ ${result.created} created, ${result.closed} closed`);
    }

    core.setOutput("issues-created", totalCreated);
    core.setOutput("issues-closed", totalClosed);
  } catch (error) {
    core.setFailed(`Action failed: ${(error as Error).message}`);
  }
}

run();
