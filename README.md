# Skill Drop

Unofficial. Not affiliated with Anthropic.

Find GitHub skills in Chrome's side panel, review their original SKILL.md files and supporting-file counts, select one or more skills, and choose **Add to Claude** to prepare Claude's Skills file field. You review the previews and click **Upload** yourself. If the field cannot be filled, use the downloaded ZIPs with Claude's browse button.

Paste a GitHub repository or folder link in the main search box and press Enter to discover every SKILL.md in that scope, including nested skills. Repository shorthand input is also supported. Search the bundled directory by name, purpose or repository. Skill names and source files are preserved; collisions trigger warnings rather than silent renaming. Advanced settings starts collapsed.

## Build, test and package

Requires Node.js 22+ and Chrome 120+. Install dependencies once:

```text
npm.cmd ci --ignore-scripts
```

Rerun the entire automated suite with one command:

```text
npm.cmd test
```

Build the unpacked extension with `npm.cmd run build`. Load `dist/` at `chrome://extensions` using **Load unpacked** in Developer mode. After an update, reload the extension and refresh Claude so it receives the current content script.

Build and audit the release ZIP with one command:

```text
npm.cmd run release
```

The package is `release/skill-drop-1.0.0.zip`, with the built files directly at its root. `release/release-report.md` and `.json` list its exact size, inventory, SHA-256 and local checks. On other platforms use `npm` in place of `npm.cmd`.

Regression tests use explicit mocked inputs and previously fetched real public GitHub responses. Network snapshots are cached in `test-cache/`, so a cached rerun is not a check of today's repository head. Real-repository reports include commit SHAs and provenance. Nothing from a discovered repository is executed. Test fixtures, mocks, generated evidence and test entry points are development-only and excluded from the runtime build and ZIP. The unused prototype fixture module has been removed.

## Use and fallback

1. Open the extension's side panel, search or load a GitHub link, and read a result's original source before selecting it.
2. Select one or more skills with their checkboxes. Read collision and metadata warnings.
3. Choose **Open upload dialog**. It focuses an active upload tab, then another upload tab in the current window, then reuses an active `/new` page. It reloads that reused page once if the dialog does not appear. Otherwise it creates a new tab, preserving existing chats.
4. Return to Skill Drop and choose **Add to Claude**. ZIPs include each complete skill folder and supporting files, checked against its pinned GitHub tree. There is a 30-skill batch cap and a 15 MiB file-input message limit; larger batches use ZIP download fallback.
5. Check every filename and preview in Claude before deciding to click **Upload**.

If Claude's field is missing, ambiguous, unavailable or cannot be filled, the panel explains the fallback, starts ZIP downloads into the ClaudeSkills subfolder of your configured download folder, and tries to open the upload dialog. Check Chrome Downloads for actual completion. Use Claude's browse button to select those ZIPs. If Chrome denies a download, choose **Save prepared ZIPs** to retry. A closed dialog instead prompts you to open it and retry Add. The extension does not click Upload or read Claude's installed-skill list.

## Directory and optional token

Under **Advanced settings**, the **Index file URL (raw.githubusercontent.com, skills-index.json)** field accepts the full raw HTTPS URL of a published generated skills-index.json file. It rejects repository pages, malformed URLs, credentials, query strings, other hosts and redirects with a clear message. A repository link belongs in the main search box.

The index is schema-checked, capped at 2 MiB / 5,000 records, cached for 24 hours and retained as a fallback if refresh fails. Offline search uses the last valid cached directory, or the bundled snapshot when no custom URL is configured. Uncached previews and repositories require a network connection. The bundled snapshot contains 57 records at pinned commits and does not refresh itself daily.

The optional GitHub token stays in chrome.storage.local on this device and is sent only to api.github.com in HTTPS Authorization headers. Raw file and archive hosts never receive it. It is not stored in Sync or separately encrypted by the extension. To remove it, clear the token field and choose Save settings. Public repositories work without a token within GitHub's limits; a rate-limit error is shown in the panel. No token was used for the cached public-repository tests.

Prepared ZIPs use an IndexedDB cache capped at 75 MiB and pruned after 24 hours when used. Chrome's normal storage quota applies; inability to cache a newly built ZIP does not prevent immediate delivery. Successful file-input delivery removes corresponding cached ZIPs. Up to 300 previously prepared names stay locally until cleared, solely for collision warnings; prepared does not mean installed. Downloaded files remain until manually removed. Uninstalling removes extension settings and cache.

## Release documents and privacy

- [Store listing, single-purpose statement and privacy disclosure text](docs/STORE-LISTING.md)
- [All permissions, host permissions and justifications](docs/PERMISSIONS.md)
- [Privacy policy ready for GitHub Pages](docs/privacy.html), also packaged locally and linked from the panel footer
- [Screenshots, Pages hosting and manual release checks](docs/RELEASE.md)

Skill Drop has no analytics, advertising, telemetry or developer-operated backend. It makes direct HTTPS requests to GitHub for selected repository data and can place selected ZIPs in Claude's file input, where Claude's page can process them. The user chooses Upload. All downloaded repository/index content is treated as untrusted data and displayed as text, never executed. Packaged extension code runs under an explicit local-script CSP.

The permission audit removed unlimitedStorage. The retained permissions are sidePanel, downloads and storage, plus the Claude, GitHub API, raw-file and archive hosts. No broad tabs, scripting or all-sites permission is requested.

## Verification scope

After release preparation, the user reported “tested in Chrome” on October 21, 2026. Chrome testing is recorded as user-reported; individual cases, outcomes and an exact ZIP hash were not supplied. The user also confirmed successful one- and two-skill uploads from anthropics/skills on an earlier build. The agent did not observe the browser or those uploads; exact skill names, upload commit and scan details were not supplied. Successful uploads for other repositories, duplicate replacement behavior, scan acceptance and installation persistence are not inferred. See [user-provided evidence](artifacts/USER-CONFIRMED-UPLOADS.md). Automated tests and packaging checks are local unless explicitly identified as real GitHub snapshots in their reports.

No Chrome Web Store submission or approval is claimed. Before submission, record any remaining flow-specific Chrome outcomes, take actual screenshots, supply the required promotional image and developer/support contact, and publish/check the privacy policy URL. The name's Store availability and artwork rights have not been verified.

## Scheduled directory builder

The standalone `index-repo/` contains a daily GitHub Action and generated index. It has no remote and is not published. A full local builder run produced the bundled 57-record, 51,728-byte snapshot, with oversized repositories recorded in the skip report. Direct repository loading works independently of a published index. Follow [index-repo/README.md](index-repo/README.md) to publish it in a repository you control; a hosted daily run has not been verified.

Pre-build research is in [docs/RESEARCH.md](docs/RESEARCH.md). The real cached GitHub results and older implementation evidence remain under `artifacts/`; they describe the versions and commits used at the time and are not evidence that this release was tested live in Chrome.
