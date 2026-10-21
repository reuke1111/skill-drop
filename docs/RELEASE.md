# Skill Drop release preparation

Unofficial. Not affiliated with Anthropic.

## Build and package

Use Node.js 22+. From the project directory:

```text
npm.cmd ci --ignore-scripts
npm.cmd test
npm.cmd run release
```

The one-line packaging command is `npm.cmd run release`; it type-checks, creates a clean `dist/`, audits its allowlisted files, and writes `release/skill-drop-1.0.0.zip`. The contents of `dist/` sit directly at the ZIP root. It also produces file sizes, SHA-256 hashes, the exact ZIP inventory and local audit checks in `release/release-report.json` and `.md`. Unit/integration tests are a separate explicit step. On other platforms use `npm` instead of `npm.cmd`.

Chrome 120+ is declared. The ZIP contains only runtime JS, panel HTML/CSS, the manifest, four PNG icons, the bundled data index, the privacy page and dependency licenses. Regression tests, their mocks/fixtures and historical evidence stay in development folders and never enter `dist/` or the ZIP. The unused prototype fixture module was removed from `src/`; the development test export entry point is now under `tests/`. Production code has no draggable card, drop listener, synthetic-drop action, Arm drop control, fixture picker or debug logging.

The icon sizes are deterministic exports of the PNG supplied by the user: 16, 32, 48 and 128 pixels, with transparent padding. The 128 icon has 96-pixel artwork plus 16-pixel padding on each side. The master is retained for source work but excluded from the release ZIP. To re-export on Windows, run `powershell -NoProfile -File scripts/export-icons.ps1`. No new artwork or logo ownership clearance is claimed.

## Store assets to provide

Capture the actual release build in Chrome with non-sensitive data. Provide 1280×800 PNG screenshots, square corners, no artificial padding. Chrome also accepts 640×400. At least one is required; the following five cover the flow:

1. **Discovery:** Skill Drop side panel showing a useful search result set, checkbox selection, and the footer disclaimer. Keep Advanced settings collapsed.
2. **Direct repository:** paste a real public GitHub folder/repository link, press Enter, show all discovered roots and the repository/branch summary. Use a source you have personally checked.
3. **Preview:** show the exact SKILL.md preview, source link, full path and supporting-file count. Do not imply author text is trusted or that a skill is already installed.
4. **Prepare upload:** show two chosen skills in the panel beside Claude's upload dialog with two distinct ZIP filenames and previews after Add. Leave Upload untouched for the screenshot unless you deliberately choose to test it.
5. **Duplicate warning or fallback:** show a real colliding-name warning, or the missing-field message plus downloaded ZIPs and the manual browse path. Use genuine UI states; do not manufacture screenshots of untested outcomes.

Keep token fields, account details, private repositories and chats out of screenshots. Verify that each image remains readable at half size. A separate **440×280 small promotional image is required** by the current Chrome Web Store documentation. It is now available at `store-assets/promo-440x280.png`. Two 1280×800 screenshot crops from the user's actual Chrome capture are available in `store-assets/`; use `screenshot-discovery-1280x800.png` as the primary listing screenshot. See `store-assets/README.md` for source provenance, crop coordinates and the distinction between actual screenshots and promotional artwork. The 128-pixel icon is available in `icons/icon128.png`.

Source: [Chrome Web Store image requirements](https://developer.chrome.com/docs/webstore/images), checked October 21, 2026.

## Privacy policy on GitHub Pages

`docs/privacy.html` is a complete static page with no script, analytics, external fonts or build dependency. The same page ships locally in the extension footer. In a repository you control, publish the `docs` folder using GitHub Pages (Settings → Pages → Deploy from a branch → your published branch → /docs), or copy `privacy.html` and `.nojekyll` to an existing Pages site's published folder. Its address will be `https://YOUR-ACCOUNT.github.io/YOUR-REPOSITORY/privacy.html`. Open the actual public HTTPS URL and add it to the Store dashboard. A local path is not a hosted policy URL. The project is now published at https://github.com/reuke1111/skill-drop with Pages configured for `main` → `/docs`. The policy address is https://reuke1111.github.io/skill-drop/privacy.html .

The policy points privacy questions to the developer/support contact in the Store listing. Supply that working contact in the dashboard. Use [STORE-LISTING.md](STORE-LISTING.md) for the listing, single-purpose statement and privacy disclosures, and [PERMISSIONS.md](PERMISSIONS.md) for all seven permission justifications.

## Manual checks before submission

After release preparation on October 21, 2026, the user reported “tested in Chrome”. This records user-performed Chrome testing. The report did not enumerate cases or outcomes; the items below remain a checklist for recording those details, not a claim that every item has passed. See `artifacts/USER-CONFIRMED-UPLOADS.md`.

- Load the clean release `dist/` in Chrome and confirm the Skill Drop name, all icon sizes, collapsed Advanced settings, disclaimer and local privacy link.
- Search the bundled snapshot, paste a repository/folder link, inspect original preview/supporting-file count, select several roots and observe name collisions. Confirm shorthand repository input still works.
- Test Open upload dialog's four tab cases, especially reusing `/new` with reload fallback and preserving an existing chat by creating a new tab. Mocked cases do not establish browser behavior.
- Test Add with one and two public skills in this release. The user previously confirmed one/two uploads from anthropics/skills, but this new build has not been exercised in Chrome by the agent. Capture scan/list outcomes only if actually observed.
- Trigger a missing/ambiguous upload field safely and confirm the clear fallback text, Chrome download completion, destination folder and manual browse flow. Confirm a denied download can be retried with Save prepared ZIPs.
- Check optional-token save/removal and outgoing API-host restriction in Chrome if you choose to use a token. Automated header tests do not replace a browser network check.
- Verify duplicate behavior after a user-chosen Upload, persisted skill entries, and new repository uploads separately. Prior confirmation does not cover these.
- Publish/check the privacy policy URL, provide a developer/support contact, review the prepared screenshot crops and promotional tile in `store-assets/`, and review dashboard disclosures. Additional flow screenshots can be captured if desired. No Store submission, security-scan approval or trademark/name availability is claimed.

The scheduled index Action is published at the repository root under `.github/workflows/index.yml` and runs the builder in `index-repo/`. A hosted daily run has not yet been verified. Public release can use the bundled snapshot and direct repository input. Do not advertise the snapshot as an automatically updating daily directory until a published endpoint is configured and verified.
