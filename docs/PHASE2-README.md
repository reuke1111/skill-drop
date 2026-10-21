# Claude Skill Drop — Phase 2 test build

This is a feasibility and packaging test build, not the complete discovery MVP. Phase 1 file-input delivery and two-file preview were verified by the user. Actual uploads, security scan outcomes, page-card drag acceptance, duplicate-name behavior, and persistence in Your skills have not been verified by this suite. The extension never clicks Upload.

## Build and run tests

Requires Node.js 22+ and Chrome. In this directory, install dependencies once with `npm.cmd ci --ignore-scripts` (Windows) or `npm ci --ignore-scripts` elsewhere.

Run the entire automated suite with one command:

```text
npm.cmd test
```

Use `npm test` outside Windows. It runs seven unit tests, then the public GitHub integration suite. It executes only our test code and installed dependencies. Repository files are read, decoded, hashed, zipped and extracted as regular bytes; none are imported or executed.

Successful public HTTP responses are cached in `test-cache/` by URL. Each has a `.json` companion recording its URL and fetch time. Subsequent runs reuse the snapshot, even if the default branch has since advanced. Remove selected cache files deliberately when a fresh snapshot is wanted. No GitHub token, Git credentials or Authorization header is used. Only three GitHub API requests are required for the normal fresh run, plus one codeload archive and one raw preview request. Truncated recursive trees trigger cached non-recursive traversal; rate limits stop the live suite with a clear error and nonzero exit.

Outputs:

- `artifacts/RESULTS.md`: test table and manual checklist.
- `artifacts/BROWSER-RESULTS.md`: separate browser attempt, automation blocker and unverified checks.
- `artifacts/results.json`: full commit, tree SHA, paths, counts, hashes, warnings and missing/extra lists.
- `artifacts/detected-skills.json`: all SKILL.md paths and distinct roots; nested skills include `nestedUnder`.
- `artifacts/batch-manifest.json`: one ZIP per detected skill, with byte counts and SHA-256 hashes.
- `artifacts/*.zip`: packages preserving complete selected skill folders.
- `artifacts/duplicate-a.zip` and `duplicate-b.zip`: local duplicate-name fixtures, both named `collision-fixture` in frontmatter, with different folders and ZIP filenames.
- `artifacts/nested-parent-fixture.zip`, `nested-child-fixture.zip`, and `nested-fixture-evidence.json`: a local skill nested under `skills/parent/children/child`. Both roots are detected once; `nestedUnder` points to the parent's SKILL.md. The parent ZIP preserves all four files, including the nested skill, while the child ZIP contains just its own two files. Every path and byte is asserted; neither skill is silently dropped.

The generated RESULTS.md and results.json include the single rerun command, the full commit SHA on each real-repository test, and an edge-case provenance table. All exceptional edge cases (no skill, invalid frontmatter, special paths, truncated trees, rate limits, non-default branches, duplicate names, and a nested skill root) use local fixtures or mocked HTTP responses. The real GitHub snapshot covers public metadata/default branch, recursive detection of 20 roots, exact raw preview comparison, supporting subfolders and complete per-skill packaging. Cached reruns reuse real responses rather than contacting GitHub again.

Extracted contents are written into a new OS temporary directory recorded in results.json. The suite verifies every extracted byte against the selected repository archive and verifies each file size and Git blob SHA-1 against the pinned tree. It reports missing/extra paths. No extracted code is run. Cleanup is manual.

## Load in Chrome

1. Run `npm.cmd run build`.
2. Open `chrome://extensions`, enable Developer mode, and choose Load unpacked → this project's `dist` directory. If already loaded, click Reload.
3. Open `https://claude.ai/new#customize/skills/new/upload` and refresh it so the new content script is active. This changeable route must be checked in the actual interface.
4. Open the extension side panel using its toolbar icon.

The Phase 2 tests require only the existing claude.ai host permission and sidePanel/downloads permissions. The GitHub data collection runs in the local test harness, not a browser backend. The shared TypeScript routines are used by tests and the extension for validation and collision warnings. Prepared ZIP selection is local; all repository text is displayed with textContent, never HTML.

## Prepare multiple real skills

In the side panel's file selector, choose `02-algorithmic-art-ea5c1494.zip`, `03-brand-guidelines-1ce8345b.zip`, and `10-internal-comms-c74ca824.zip` from artifacts (or use the current batch manifest if paths change). Review raw previews, file counts and warnings. Keep the intended Claude tab active, then click **Fill Claude's Skill file field** once. The extension sends the batch through one message, rebuilds real File objects in the content script, and assigns one FileList with one input/change sequence. Chrome extension messaging uses JSON byte arrays, not unreliable Blob serialization. The source files remain unchanged.

Check that the dialog lists three distinct ZIPs and says Upload 3 skills with the expected name/description previews. A success message from the extension only proves the DOM FileList was set; it does not prove Claude accepted, scanned or stored the skills. Leave Upload untouched until you decide to proceed.

## Prepare duplicate names

Select only `duplicate-a.zip` and `duplicate-b.zip` in the side panel. Confirm a **Name collision: collision-fixture** warning appears. Both original SKILL.md texts are shown and never renamed. Click Fill Claude's Skill file field. Check that Claude displays both distinct filenames and two previews using the same skill name. This preparation is still unverified on the live interface in this run.

If you choose to click Upload yourself, record:

1. Does Claude reject duplicates before or after its security scan? Copy the exact error.
2. Does it request replacement confirmation? Do not confirm a replacement unless you intend it.
3. Does it add both, add one, or replace an existing skill? Check Your skills, names and descriptions.
4. Does the security scan pass, warn or reject each file? A populated file field is not an upload result.

Run the real-skill batch and duplicate fixture batch separately; the latter replaces the pending FileList. If two fixtures do not produce a duplicate prompt, check whether behavior differs when the same name already exists in Your skills after an upload you explicitly choose to make.

## Limits and interpretation

- The live repository snapshot is anthropics/skills, commit recorded in results.json, default branch discovered through metadata. No replacement was needed.
- There are no nested skill roots or real duplicate names in this snapshot; those behaviors are tested with local fixtures.
- No-skill repositories, truncated trees, rate limits, special paths and non-default branches are mocked edge cases, not claims about live repositories exhibiting those conditions.
- The frontmatter reader supports simple scalar strings conservatively. Valid multiline or complex YAML may generate an unsupported-YAML warning. It never edits the author's frontmatter and is not a full YAML validator.
- The browser batch path has a 15 MB compressed-byte cap. Choose fewer ZIPs for larger batches. Archives are unzipped in memory, so use only the bounded prepared test packages for these tests.
- The content script requires exactly one file input whose accept attribute mentions ZIP, skill or Markdown; an interface change fails with a clear message. It does not bypass authentication, CAPTCHA or the security scan.
- The updated extension must be reloaded manually before live tests. Automated tests do not prove browser delivery, security scan outcomes, duplicate behavior or actual installation. This is not described as one-click installation.
- Index discovery, scheduled index Action, IndexedDB ZIP cache and full search UI from the original MVP request are outside this Phase 2 test task.
