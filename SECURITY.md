# Security Policy

`hihat` is a minimalist, **fully offline** music-library player for macOS. It has
no backend, no accounts, and makes no network requests during normal playback —
your library, database, and audio files never leave your machine. This shapes
what a "security issue" means for this project: the threat surface is local.

## Supported Versions

Security fixes are applied to the **latest released version** only. `hihat` is a
desktop app distributed as DMG releases — please update to the newest release
before reporting, as the issue may already be fixed.

| Version            | Supported          |
| ------------------ | ------------------ |
| Latest release     | :white_check_mark: |
| Any older release  | :x:                |

You can check the latest release on the
[Releases page](https://github.com/johnnyshankman/hihat/releases), or via the
in-app **Check for Updates** menu item.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately through GitHub's **private vulnerability reporting**:

1. Go to the repository's **Security** tab → **Report a vulnerability**.
2. Direct link: https://github.com/johnnyshankman/hihat/security/advisories/new

This keeps the report confidential until a fix is available and lets us
coordinate a disclosure with you.

If you cannot use GitHub Security Advisories, contact the maintainer through the
contact details on their GitHub profile (https://github.com/johnnyshankman).

### What to include

- The `hihat` version and your macOS version.
- A clear description of the issue and its security impact.
- Steps to reproduce — and, where relevant, a sample input file (a crafted audio
  file, tag payload, playlist, or backup) that triggers the behavior.
- Any crash logs, stack traces, or screenshots.

### Response expectations

- **Acknowledgement:** within **5 business days**.
- **Initial assessment** (severity + whether we accept the report): within
  **10 business days**.
- **Fix & release:** timeline depends on severity and complexity; we will keep
  you updated and credit you in the release notes / advisory unless you prefer
  to remain anonymous.

This is a volunteer-maintained open-source project — we appreciate your patience
and your help in keeping `hihat` safe.

## Scope

Because `hihat` is an offline desktop app, in-scope reports involve a local
attacker or attacker-supplied **files/data** rather than a remote server.

**In scope:**

- Memory-unsafe or crash-inducing handling of **malicious or malformed media
  files** — corrupt audio files, hostile ID3/Vorbis/MP4 tag metadata, oversized
  or malformed cover-art images.
- Code execution, path traversal, or file-system escape via **imported data** —
  playlists, library scans, backups/restores, or the on-disk SQLite database.
- Flaws in the custom `hihat-audio://` file-serving protocol that allow reading
  files outside the user's music library, or otherwise escaping the intended
  file scope.
- Electron-specific weaknesses: renderer sandbox escape, context-isolation
  bypass, unsafe IPC exposure, or insecure `BrowserWindow` configuration.
- Tampering with or injecting data through the local database, app
  configuration, or backup files in a way that leads to code execution or
  unauthorized file access.
- Vulnerable third-party dependencies that are actually exploitable in `hihat`'s
  shipped code paths.
- Issues in the GitHub Actions release/build pipeline (e.g. supply-chain or
  artifact-integrity weaknesses).

**Out of scope:**

- Anything requiring an already-compromised machine or pre-existing local
  admin/root access.
- Social-engineering attacks, or convincing a user to manually run untrusted
  software.
- Theoretical issues with no demonstrable security impact, missing
  "defense-in-depth" hardening with no exploit, or best-practice nitpicks
  without a concrete attack.
- Bugs in third-party dependencies that are **not** reachable from `hihat`'s
  code paths (report those upstream).
- Denial of service that only affects the attacker's own `hihat` instance.
- There is no `hihat` server, API, or hosted service — network/server-side
  vulnerability classes do not apply.

Thank you for helping keep `hihat` and its users secure.
