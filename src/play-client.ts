import { google } from "googleapis";
import { ErrorIssue } from "./types.js";

export class PlayReportingClient {
  private auth: any;
  private reporting: any;

  constructor(serviceAccountJson: object) {
    this.auth = new google.auth.GoogleAuth({
      credentials: serviceAccountJson,
      scopes: ["https://www.googleapis.com/auth/playdeveloperreporting"],
    });
    this.reporting = google.playdeveloperreporting({
      version: "v1beta1",
      auth: this.auth,
    });
  }

  async fetchErrorIssues(packageName: string, filter: string): Promise<ErrorIssue[]> {
    const issues: ErrorIssue[] = [];
    let nextPageToken: string | undefined;

    do {
      const res: any = await this.reporting.vitals.errors.issues.search({
        parent: `apps/${packageName}`,
        filter: filter,
        pageToken: nextPageToken,
      });

      const rawIssues = res.data.errorIssues || [];
      for (const raw of rawIssues) {
        issues.push(this.mapApiResponse(raw, packageName));
      }

      nextPageToken = res.data.nextPageToken;
    } while (nextPageToken);

    return issues;
  }

  private mapApiResponse(raw: any, packageName: string): ErrorIssue {
    // Resource name format: apps/{packageName}/errorIssues/{issueId}
    const id = raw.name.split("/").pop();
    
    return {
      id: id,
      packageName: packageName,
      type: raw.type === "CRASH" ? "CRASH" : "ANR",
      cause: raw.cause || "Unknown",
      location: raw.location || "Unknown",
      affectedUsers: parseInt(raw.distinctUsers || "0", 10),
      eventCount: parseInt(raw.errorReportCount || "0", 10),
      firstSeenVersion: raw.firstAppVersion?.versionCode?.toString() || "Unknown",
      lastSeenVersion: raw.lastAppVersion?.versionCode?.toString() || "Unknown",
      isResolved: raw.resolutionState === "RESOLVED",
      playConsoleUrl: `https://play.google.com/console/developers/app/${packageName}/vitals/crashes/details?issueId=${id}`,
    };
  }
}
