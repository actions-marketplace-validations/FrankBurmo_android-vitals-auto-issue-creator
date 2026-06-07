export interface ActionConfig {
  serviceAccountJson: any;
  packageNames: string[];
  packageRepoMap: Record<string, string>;
  defaultRepo: { owner: string; repo: string };
  githubToken: string;
  labelPrefix: string;
  extraLabels: string[];
  closeResolved: boolean;
  errorTypes: "CRASH" | "ANR" | "ALL";
  minAffectedUsers: number;
}

export interface ErrorIssue {
  id: string;           // Stable ID from Play Console
  packageName: string;
  type: "CRASH" | "ANR";
  cause: string;        // e.g. "java.lang.IllegalStateException"
  location: string;     // e.g. "com.example.MainActivity.onCreate"
  affectedUsers: number;
  eventCount: number;
  firstSeenVersion: string;
  lastSeenVersion: string;
  isResolved: boolean;
  playConsoleUrl: string;
}

export interface SyncResult {
  created: number;
  closed: number;
}
