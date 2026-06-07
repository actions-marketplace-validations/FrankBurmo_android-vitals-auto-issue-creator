import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncApp } from "../src/sync.js";
import { ActionConfig, ErrorIssue } from "../src/types.js";

vi.mock("../src/play-client.js");
vi.mock("../src/github-client.js");

describe("sync", () => {
  let mockPlayClient: any;
  let mockGitHubClient: any;
  let config: ActionConfig;

  beforeEach(() => {
    mockPlayClient = {
      fetchErrorIssues: vi.fn(),
    };
    mockGitHubClient = {
      findIssueByLabel: vi.fn(),
      ensureLabel: vi.fn(),
      createIssue: vi.fn(),
      closeIssue: vi.fn(),
    };

    config = {
      serviceAccountJson: {},
      packageNames: ["com.example.app"],
      packageRepoMap: {},
      defaultRepo: { owner: "owner", repo: "repo" },
      githubToken: "token",
      labelPrefix: "play-error:",
      extraLabels: ["crash"],
      closeResolved: true,
      errorTypes: "ALL",
      minAffectedUsers: 1,
    };
  });

  it("should create a new issue for a new error", async () => {
    const issue: ErrorIssue = {
      id: "123",
      packageName: "com.example.app",
      type: "CRASH",
      cause: "Exception",
      location: "Main",
      affectedUsers: 10,
      eventCount: 20,
      firstSeenVersion: "1.0",
      lastSeenVersion: "1.1",
      isResolved: false,
      playConsoleUrl: "url",
    };

    mockPlayClient.fetchErrorIssues.mockResolvedValue([issue]);
    mockGitHubClient.findIssueByLabel.mockResolvedValue(null);

    const result = await syncApp(mockPlayClient as any, mockGitHubClient as any, "com.example.app", config);

    expect(result.created).toBe(1);
    expect(mockGitHubClient.createIssue).toHaveBeenCalled();
  });

  it("should not create issue if already exists", async () => {
    const issue: ErrorIssue = {
      id: "123",
      packageName: "com.example.app",
      type: "CRASH",
      cause: "Exception",
      location: "Main",
      affectedUsers: 10,
      eventCount: 20,
      firstSeenVersion: "1.0",
      lastSeenVersion: "1.1",
      isResolved: false,
      playConsoleUrl: "url",
    };

    mockPlayClient.fetchErrorIssues.mockResolvedValue([issue]);
    mockGitHubClient.findIssueByLabel.mockResolvedValue({ number: 1, state: "open" });

    const result = await syncApp(mockPlayClient as any, mockGitHubClient as any, "com.example.app", config);

    expect(result.created).toBe(0);
    expect(mockGitHubClient.createIssue).not.toHaveBeenCalled();
  });

  it("should close resolved issue if configured", async () => {
    const issue: ErrorIssue = {
      id: "123",
      packageName: "com.example.app",
      type: "CRASH",
      cause: "Exception",
      location: "Main",
      affectedUsers: 10,
      eventCount: 20,
      firstSeenVersion: "1.0",
      lastSeenVersion: "1.1",
      isResolved: true,
      playConsoleUrl: "url",
    };

    mockPlayClient.fetchErrorIssues.mockResolvedValue([issue]);
    mockGitHubClient.findIssueByLabel.mockResolvedValue({ number: 1, state: "open" });

    const result = await syncApp(mockPlayClient as any, mockGitHubClient as any, "com.example.app", config);

    expect(result.closed).toBe(1);
    expect(mockGitHubClient.closeIssue).toHaveBeenCalledWith(1, expect.any(String));
  });
});
