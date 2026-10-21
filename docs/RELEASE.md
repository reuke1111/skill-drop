# Skill Drop release notes

Unofficial. Not affiliated with Anthropic.

## Verification scope

After release preparation, the user reported “tested in Chrome” on October 21, 2026. Browser testing was user-reported; individual cases were not recorded in the initial Chrome-test confirmation. An exact tested ZIP hash was not supplied. The user also confirmed successful one- and two-skill uploads from anthropics/skills on an earlier build. Exact skill names, upload commit and scan details were not supplied. A later user confirmation records that Claude rejected a duplicate skill name; the repository, skill names, ZIP hashes and rejection stage for that test were not recorded. Successful uploads for other repositories, duplicate replacement behavior, scan acceptance and installation persistence are not inferred. See [user-provided evidence](../artifacts/USER-CONFIRMED-UPLOADS.md). Automated tests and packaging checks are local unless explicitly identified as real GitHub snapshots in their reports.

No Chrome Web Store submission or approval is claimed. Before submission, record any remaining flow-specific Chrome outcomes, review the prepared screenshots and promotional image, provide developer/support contact details, and enter the hosted privacy policy URL. The name's Store availability and artwork rights have not been verified.

### Claims requiring confirmation

- `VIDEO_LINK` remains an intentional demo-video placeholder. The README download links point to the [v1.0.0 release](https://github.com/reuke1111/skill-drop/releases/tag/v1.0.0) and its `skill-drop-1.0.0.zip` asset.
- Uploads from a third-party repository remain `TODO: confirm`.

### License

Skill Drop is licensed under the MIT License. See the project [LICENSE](../LICENSE). Third-party components retain their existing license notices.

## Store listing and single-purpose statement

- [Store listing, single-purpose statement and privacy disclosure text](STORE-LISTING.md)
- [All permissions, host permissions and justifications](PERMISSIONS.md)
- [Privacy policy ready for GitHub Pages](privacy.html), also packaged locally and linked from the panel footer
- [Screenshots, Pages hosting and manual release checks](RELEASE.md)

The existing listing copy, single-purpose statement and dashboard disclosure text are in [STORE-LISTING.md](STORE-LISTING.md).

Skill Drop has no analytics, advertising, telemetry or developer-operated backend. It makes direct HTTPS requests to GitHub for selected repository data and can place selected ZIPs in Claude's file input, where Claude's page can process them. The user chooses Upload. All downloaded repository/index content is treated as untrusted data and displayed as text, never executed. Packaged extension code runs under an explicit local-script CSP.

## Permissions and justifications

The permission audit removed unlimitedStorage. The retained permissions are sidePanel, downloads and storage, plus the Claude, GitHub API, raw-file and archive hosts. No broad tabs, scripting or all-sites permission is requested.

The complete permission table and source references are in [PERMISSIONS.md](PERMISSIONS.md).

## Index and cache details

Under **Advanced settings**, the **Index file URL (raw.githubusercontent.com, skills-index.json)** field accepts the full raw HTTPS URL of a published generated skills-index.json file. It rejects repository pages, malformed URLs, credentials, query strings, other hosts and redirects with a clear message. A repository link belongs in the main search box.

The index is schema-checked, capped at 2 MiB / 5,000 records, cached for 24 hours and retained as a fallback if refresh fails. Offline search uses the last valid cached directory, or the bundled snapshot when no custom URL is configured. Uncached previews and repositories require a network connection. The bundled snapshot contains 57 records at pinned commits and does not refresh itself daily.

The optional GitHub token stays in chrome.storage.local on this device and is sent only to api.github.com in HTTPS Authorization headers. Raw file and archive hosts never receive it. It is not stored in Sync or separately encrypted by the extension. To remove it, clear the token field and choose Save settings. Public repositories work without a token within GitHub's limits; a rate-limit error is shown in the panel. No token was used for the cached public-repository tests.

Prepared ZIPs use an IndexedDB cache capped at 75 MiB and pruned after 24 hours when used. Chrome's normal storage quota applies; inability to cache a newly built ZIP does not prevent immediate delivery. Successful file-input delivery removes corresponding cached ZIPs. Up to 300 previously prepared names stay locally until cleared, solely for collision warnings; prepared does not mean installed. Downloaded files remain until manually removed. Uninstalling removes extension settings and cache.

### Scheduled directory builder

The published `.github/workflows/index.yml` schedules the index builder daily at 03:23 UTC (08:53 Asia/Calcutta) and supports manual dispatch. It runs in `index-repo/`, verifies its generated JSON, and commits the index and skip report. A hosted indexing run has not yet been verified. Configure Advanced settings with `https://raw.githubusercontent.com/reuke1111/skill-drop/main/index-repo/skills-index.json` to use this hosted directory. The release ZIP still contains its original bundled snapshot. Direct repository loading works independently of the index.

### Publication scope

The scheduled index Action is published at the repository root under `.github/workflows/index.yml` and runs the builder in `index-repo/`. A hosted daily run has not yet been verified. Public release can use the bundled snapshot and direct repository input. Do not advertise the snapshot as an automatically updating daily directory until a published endpoint is configured and verified.

## Release checklist

### Existing introduction and project links

[Public repository](https://github.com/reuke1111/skill-drop) · [Privacy policy](https://reuke1111.github.io/skill-drop/privacy.html) · [Download v1.0.0 ZIP](https://github.com/reuke1111/skill-drop/raw/refs/heads/main/release/skill-drop-1.0.0.zip) · [Listing images](https://github.com/reuke1111/skill-drop/tree/main/store-assets)

Find GitHub skills in Chrome's side panel, review their original SKILL.md files and supporting-file counts, select one or more skills, and choose **Add to Claude** to prepare Claude's Skills file field. You review the previews and click **Upload** yourself. If the field cannot be filled, use the downloaded ZIPs with Claude's browse button.

Paste a GitHub repository or folder link in the main search box and press Enter to discover every SKILL.md in that scope, including nested skills. Repository shorthand input is also supported. Search the bundled directory by name, purpose or repository. Skill names and source files are preserved; collisions trigger warnings rather than silent renaming. Advanced settings starts collapsed.

### Build, test and package

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

### Package and icon details

Use Node.js 22+. From the project directory:

```text
npm.cmd ci --ignore-scripts
npm.cmd test
npm.cmd run release
```

The one-line packaging command is `npm.cmd run release`; it type-checks, creates a clean `dist/`, audits its allowlisted files, and writes `release/skill-drop-1.0.0.zip`. The contents of `dist/` sit directly at the ZIP root. It also produces file sizes, SHA-256 hashes, the exact ZIP inventory and local audit checks in `release/release-report.json` and `.md`. Unit/integration tests are a separate explicit step. On other platforms use `npm` instead of `npm.cmd`.

Chrome 120+ is declared. The ZIP contains only runtime JS, panel HTML/CSS, the manifest, four PNG icons, the bundled data index, the privacy page and dependency licenses. Regression tests, their mocks/fixtures and historical evidence stay in development folders and never enter `dist/` or the ZIP. The unused prototype fixture module was removed from `src/`; the development test export entry point is now under `tests/`. Production code has no draggable card, drop listener, synthetic-drop action, Arm drop control, fixture picker or debug logging.

The icon sizes are deterministic exports of the PNG supplied by the user: 16, 32, 48 and 128 pixels, with transparent padding. The 128 icon has 96-pixel artwork plus 16-pixel padding on each side. The master is retained for source work but excluded from the release ZIP. To re-export on Windows, run `powershell -NoProfile -File scripts/export-icons.ps1`. No new artwork or logo ownership clearance is claimed.

### Use and fallback details

1. Open the extension's side panel, search or load a GitHub link, and read a result's original source before selecting it.
2. Select one or more skills with their checkboxes. Read collision and metadata warnings.
3. Choose **Open upload dialog**. It focuses an active upload tab, then another upload tab in the current window, then reuses an active `/new` page. It reloads that reused page once if the dialog does not appear. Otherwise it creates a new tab, preserving existing chats.
4. Return to Skill Drop and choose **Add to Claude**. ZIPs include each complete skill folder and supporting files, checked against its pinned GitHub tree. There is a 30-skill batch cap and a 15 MiB file-input message limit; larger batches use ZIP download fallback.
5. Check every filename and preview in Claude before deciding to click **Upload**.

If Claude's field is missing, ambiguous, unavailable or cannot be filled, the panel explains the fallback, starts ZIP downloads into the ClaudeSkills subfolder of your configured download folder, and tries to open the upload dialog. Check Chrome Downloads for actual completion. Use Claude's browse button to select those ZIPs. If Chrome denies a download, choose **Save prepared ZIPs** to retry. A closed dialog instead prompts you to open it and retry Add. The extension does not click Upload or read Claude's installed-skill list.

### Store assets

Capture the actual release build in Chrome with non-sensitive data. Provide 1280×800 PNG screenshots, square corners, no artificial padding. Chrome also accepts 640×400. At least one is required; the following five cover the flow:

1. **Discovery:** Skill Drop side panel showing a useful search result set, checkbox selection, and the footer disclaimer. Keep Advanced settings collapsed.
2. **Direct repository:** paste a real public GitHub folder/repository link, press Enter, show all discovered roots and the repository/branch summary. Use a source you have personally checked.
3. **Preview:** show the exact SKILL.md preview, source link, full path and supporting-file count. Do not imply author text is trusted or that a skill is already installed.
4. **Prepare upload:** show two chosen skills in the panel beside Claude's upload dialog with two distinct ZIP filenames and previews after Add. Leave Upload untouched for the screenshot unless you deliberately choose to test it.
5. **Duplicate warning or fallback:** show a real colliding-name warning, or the missing-field message plus downloaded ZIPs and the manual browse path. Use genuine UI states; do not manufacture screenshots of untested outcomes.

Keep token fields, account details, private repositories and chats out of screenshots. Verify that each image remains readable at half size. A separate **440×280 small promotional image is required** by the current Chrome Web Store documentation. It is now available at `store-assets/promo-440x280.png`. Two 1280×800 screenshot crops from the user's actual Chrome capture are available in `store-assets/`; use `screenshot-discovery-1280x800.png` as the primary listing screenshot. See `store-assets/README.md` for source provenance, crop coordinates and the distinction between actual screenshots and promotional artwork. The 128-pixel icon is available in `icons/icon128.png`.

Source: [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images), checked October 21, 2026.

### Privacy policy on GitHub Pages

`docs/privacy.html` is a complete static page with no script, analytics, external fonts or build dependency. The same page ships locally in the extension footer. In a repository you control, publish the `docs` folder using GitHub Pages (Settings → Pages → Deploy from a branch → your published branch → /docs), or copy `privacy.html` and `.nojekyll` to an existing Pages site's published folder. Its address will be `https://YOUR-ACCOUNT.github.io/YOUR-REPOSITORY/privacy.html`. Open the actual public HTTPS URL and add it to the Store dashboard. A local path is not a hosted policy URL. The project is now published at https://github.com/reuke1111/skill-drop with Pages configured for `main` → `/docs`. The policy address is https://reuke1111.github.io/skill-drop/privacy.html .

The policy points privacy questions to the developer/support contact in the Store listing. Supply that working contact in the dashboard. Use [STORE-LISTING.md](STORE-LISTING.md) for the listing, single-purpose statement and privacy disclosures, and [PERMISSIONS.md](PERMISSIONS.md) for all seven permission justifications.

### Manual checks before submission

After release preparation on October 21, 2026, the user reported “tested in Chrome”. Browser testing was user-reported; individual cases were not recorded. The items below remain a checklist for recording those details; they are not a claim that every item has passed. See `artifacts/USER-CONFIRMED-UPLOADS.md`.

- Load the clean release `dist/` in Chrome and confirm the Skill Drop name, all icon sizes, collapsed Advanced settings, disclaimer and local privacy link.
- Search the bundled snapshot, paste a repository/folder link, inspect original preview/supporting-file count, select several roots and observe name collisions. Confirm shorthand repository input still works.
- Test Open upload dialog's four tab cases, especially reusing `/new` with reload fallback and preserving an existing chat by creating a new tab. Mocked cases do not establish browser behavior.
- Test Add with one and two public skills in this release. The user previously confirmed one/two uploads from anthropics/skills, individual cases were not recorded for this build. Capture scan/list outcomes only if actually observed.
- Trigger a missing/ambiguous upload field safely and confirm the clear fallback text, Chrome download completion, destination folder and manual browse flow. Confirm a denied download can be retried with Save prepared ZIPs.
- Check optional-token save/removal and outgoing API-host restriction in Chrome if you choose to use a token. Automated header tests do not replace a browser network check.
- Verify duplicate behavior after a user-chosen Upload, persisted skill entries, and new repository uploads separately. Prior confirmation does not cover these.
- Publish/check the privacy policy URL, provide a developer/support contact, review the prepared screenshot crops and promotional tile in `store-assets/`, and review dashboard disclosures. Additional flow screenshots can be captured if desired. No Store submission, security-scan approval or trademark/name availability is claimed.

## Research

Pre-build research is in [docs/RESEARCH.md](RESEARCH.md). Generated test artifacts and HTTP caches are kept locally and excluded from this public repository. The user-supplied test evidence document is included under `artifacts/`.
