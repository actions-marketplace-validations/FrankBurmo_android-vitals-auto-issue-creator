# Android Vitals → GitHub Issues

[![CI](https://github.com/FrankBurmo/android-vitals-auto-issue-creator/actions/workflows/ci.yml/badge.svg)](https://github.com/FrankBurmo/android-vitals-auto-issue-creator/actions/workflows/ci.yml)
[![Marketplace](https://img.shields.io/badge/Marketplace-Android%20Vitals%20Issues-blue.svg?logo=github)](https://github.com/marketplace/actions/android-vitals-auto-issue-creator)
[![v1](https://img.shields.io/badge/tag-v1-green.svg)](https://github.com/FrankBurmo/android-vitals-auto-issue-creator/releases)

Sync crash- and ANR-errors from Google Play Console to GitHub Issues automatically. This action creates one GitHub issue per unique problem and uses labels for deduplication, ensuring your team stays on top of production issues without manual tracking.

## Features

- **Automatic Sync**: Periodically fetches new crashes and ANRs from the Play Developer Reporting API.
- **Smart Deduplication**: Uses GitHub labels to track which Play Console issues have already been created.
- **Multi-App Support**: Monitor multiple Android packages and route them to different repositories if needed.
- **Auto-Close**: (Optional) Automatically close GitHub issues when they are marked as resolved in the Play Console.

## Quick Start

```yaml
# .github/workflows/play-sync.yml
name: Sync Play Console crashes
on:
  schedule:
    - cron: "0 */2 * * *" # Every 2 hours
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: FrankBurmo/android-vitals-auto-issue-creator@v2
        with:
          service-account-json: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}
          package-names: "com.example.myapp"
          extra-labels: "android,crash"
```

## Advanced Usage: Multi-App Routing

If you manage multiple apps and want them to report to different repositories:

```yaml
- uses: FrankBurmo/android-vitals-auto-issue-creator@v2
  with:
    service-account-json: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}
    package-names: "com.example.app1, com.example.app2"
    package-repo-map: |
      {
        "com.example.app1": "my-org/app1-repo",
        "com.example.app2": "my-org/app2-repo"
      }
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `service-account-json` | Google service account JSON key with Play Developer Reporting access. | Yes | - |
| `package-names` | Comma-separated list of Android package names to monitor. | Yes | - |
| `github-token` | GitHub token with `issues:write` permission. | No | `${{ github.token }}` |
| `target-repo` | Target repo for issues (`owner/repo`). Defaults to current repo. | No | - |
| `package-repo-map` | JSON map from package name to GitHub repo. | No | `{}` |
| `label-prefix` | Prefix for deduplication labels. | No | `play-error:` |
| `extra-labels` | Comma-separated list of additional labels for new issues. | No | `play-console,crash` |
| `close-resolved` | Automatically close issues when resolved in Play Console. | No | `false` |
| `error-types` | Which error types to sync: `CRASH`, `ANR`, or `ALL`. | No | `ALL` |
| `min-affected-users` | Only create issues for errors affecting at least X users. | No | `1` |

## Setup Guide

### 1. Enable API
Go to the [Google Cloud Console](https://console.cloud.google.com/) and enable the **Google Play Developer Reporting API** for your project.

### 2. Create Service Account
1. Create a Service Account in the Google Cloud Console.
2. Generate a new **JSON key** for this service account.
3. Save this JSON key; you will need it for the `service-account-json` input.

### 3. Grant Access in Play Console
1. Go to the [Google Play Console](https://play.google.com/console/).
2. Navigate to **Users and permissions** -> **Invite new users**.
3. Add the Service Account email address.
4. Grant **View app information and performance data (read-only)** permission for the apps you want to monitor.

### 4. Add GitHub Secret
Add the contents of the JSON key file as a secret named `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` in your GitHub repository.

## Deduplication Strategy
This action uses a label with the format `${label-prefix}${play-issue-id}` (e.g., `play-error:123456789`) to identify unique problems. It checks for the existence of this label in the target repository before creating a new issue.

## License
[MIT](LICENSE)
