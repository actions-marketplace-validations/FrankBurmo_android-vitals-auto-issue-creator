import { describe, it, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";
import { parseConfig } from "../src/config";

vi.mock("@actions/core");

describe("config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_REPOSITORY = "owner/repo";
  });

  it("should parse valid config", () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      switch (name) {
        case "service-account-json": return '{"project_id": "test"}';
        case "package-names": return "com.example.app1, com.example.app2";
        case "github-token": return "secret-token";
        case "min-affected-users": return "10";
        case "error-types": return "CRASH";
        default: return "";
      }
    });

    const config = parseConfig();
    expect(config.packageNames).toEqual(["com.example.app1", "com.example.app2"]);
    expect(config.serviceAccountJson).toEqual({ project_id: "test" });
    expect(config.minAffectedUsers).toBe(10);
    expect(config.errorTypes).toBe("CRASH");
    expect(config.defaultRepo).toEqual({ owner: "owner", repo: "repo" });
  });

  it("should throw error on invalid JSON", () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "service-account-json") return "invalid-json";
      return "";
    });

    expect(() => parseConfig()).toThrow(/Failed to parse service-account-json/);
  });
});
