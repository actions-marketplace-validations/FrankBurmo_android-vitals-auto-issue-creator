import * as github from "@actions/github";

import { ErrorIssue } from "./types.js";

export class GitHubClient {
  private octokit: any;
  private owner: string;
  private repo: string;

  private existingLabels: Set<string> | null = null;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = github.getOctokit(token);
    this.owner = owner;
    this.repo = repo;
  }

  private async loadLabels(): Promise<void> {
    if (this.existingLabels !== null) {
      return;
    }
    this.existingLabels = new Set<string>();
    let page = 1;
    const perPage = 100;
    while (true) {
      const { data: labels } = await this.octokit.rest.issues.listLabelsForRepo({
        owner: this.owner,
        repo: this.repo,
        per_page: perPage,
        page: page,
      });
      for (const label of labels) {
        this.existingLabels.add(label.name);
      }
      if (labels.length < perPage) {
        break;
      }
      page++;
    }
  }

  async ensureLabel(name: string, color?: string): Promise<void> {
    await this.loadLabels();
    if (this.existingLabels!.has(name)) {
      return;
    }

    try {
      await this.octokit.rest.issues.createLabel({
        owner: this.owner,
        repo: this.repo,
        name: name,
        color: color || "d73a4a",
      });
      this.existingLabels!.add(name);
    } catch (error: any) {
      if (error.status === 422) {
        this.existingLabels!.add(name);
      } else {
        throw error;
      }
    }
  }

  async findIssueByLabel(label: string): Promise<{ number: number; state: string } | null> {
    const { data: issues } = await this.octokit.rest.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      labels: label,
      state: "all",
      per_page: 1,
    });

    if (issues.length > 0) {
      return {
        number: issues[0].number,
        state: issues[0].state,
      };
    }

    return null;
  }

  async createIssue(issue: ErrorIssue, labels: string[]): Promise<number> {
    const title = `[${issue.type}] ${issue.cause} in ${issue.location}`;
    const body = `
## ${issue.type} registered in Google Play Console

| | |
|---|---|
| **Cause** | \`${issue.cause}\` |
| **Location** | \`${issue.location}\` |
| **Affected Users** | ${issue.affectedUsers} |
| **Total Events** | ${issue.eventCount} |
| **First Seen In** | \`${issue.firstSeenVersion}\` |
| **Last Seen In** | \`${issue.lastSeenVersion}\` |
| **Package Name** | \`${issue.packageName}\` |

[🔗 Open in Play Console](${issue.playConsoleUrl})

---
> *Automatically created by [android-vitals-issues](https://github.com/marketplace/actions/android-vitals-issues)*
> Play Console issue ID: \`${issue.id}\`
`;

    const { data: newIssue } = await this.octokit.rest.issues.create({
      owner: this.owner,
      repo: this.repo,
      title: title,
      body: body,
      labels: labels,
    });

    return newIssue.number;
  }

  async closeIssue(issueNumber: number, comment: string): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body: comment,
    });

    await this.octokit.rest.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      state: "closed",
    });
  }
}
