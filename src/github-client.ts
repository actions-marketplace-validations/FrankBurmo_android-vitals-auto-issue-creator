import * as github from "@actions/github";

import { ErrorIssue } from "./types";

export class GitHubClient {
  private octokit: any;
  private owner: string;
  private repo: string;

  constructor(token: string, owner: string, repo: string) {
    this.octokit = github.getOctokit(token);
    this.owner = owner;
    this.repo = repo;
  }

  async ensureLabel(name: string, color?: string): Promise<void> {
    try {
      await this.octokit.rest.issues.getLabel({
        owner: this.owner,
        repo: this.repo,
        name: name,
      });
    } catch (error: any) {
      if (error.status === 404) {
        await this.octokit.rest.issues.createLabel({
          owner: this.owner,
          repo: this.repo,
          name: name,
          color: color || "d73a4a",
        });
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
## ${issue.type} registrert i Google Play Console

| | |
|---|---|
| **Årsak** | \`${issue.cause}\` |
| **Lokasjon** | \`${issue.location}\` |
| **Berørte brukere** | ${issue.affectedUsers} |
| **Totale eventer** | ${issue.eventCount} |
| **Første sett i** | \`${issue.firstSeenVersion}\` |
| **Sist sett i** | \`${issue.lastSeenVersion}\` |
| **Pakkenavn** | \`${issue.packageName}\` |

[🔗 Åpne i Play Console](${issue.playConsoleUrl})

---
> *Automatisk opprettet av [android-vitals-issues](https://github.com/marketplace/actions/android-vitals-issues)*
> Play Console problem-ID: \`${issue.id}\`
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
