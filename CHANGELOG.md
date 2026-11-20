# Changelog

## 1.1.5 (November 2026)

First release with packages on [Releases](https://github.com/KU-MV/KU-HantaCon/releases/tag/v1.1.5): macOS `.dmg` (Apple silicon, Intel) and Ubuntu `.deb` (x86-64).

Fixes
- macOS: the whole application bundle is ad-hoc signed. Before, a `.dmg` downloaded from Releases was rejected by macOS as damaged.
- macOS: the `docker` command is found when HantaCon is opened from Applications. Before, analyses failed with `[Docker Error] exit 127`.
- Linux: the containers run with your own user ID, so result files can be edited and deleted.
- A failed analysis is reported as an error instead of **COMPLETE**.
- The Auspice tip-frequencies and root-sequence files are copied with the results, so the frequency panel loads.
- `~/Desktop` is created when it does not exist.
- Sample prefixes with spaces or shell characters are rejected.
- `npm start` shows the HantaCon icon.

Installation
- All bioinformatics tool versions are pinned in `env.yml` (conda-forge and bioconda only).
- Electron is pinned to 45.3.4, Node.js 22.12 or later is required, and `package-lock.json` is committed.
- `electron-icon-builder` was removed; it made `npm install` fail on Apple silicon and ARM Linux.

Documentation
- README: installation from Releases for macOS and Ubuntu, and a quick start with public example data (SRR22029858).
- DOCS.md: usage by tab, updating, uninstalling, building from source, and troubleshooting.
