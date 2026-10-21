# Skill Drop 1.0.0 release package

ZIP: skill-drop-1.0.0.zip — **114,300 bytes (111.62 KiB)**. Uncompressed: 371,820 bytes.

SHA-256: `0a835be2b138595d0ea79cd4a7463c1d1cc93f1a1c5290be5c4f5184b8f1336c`

All entries are at the archive root; there is no enclosing dist/ directory.

| File | Bytes |
|---|---:|
| THIRD-PARTY-LICENSES.txt | 1,827 |
| background.js | 425 |
| bootstrap-index.json | 51,728 |
| content.js | 2,388 |
| icons/icon128.png | 19,094 |
| icons/icon16.png | 644 |
| icons/icon32.png | 1,823 |
| icons/icon48.png | 3,605 |
| manifest.json | 1,122 |
| panel.css | 2,457 |
| panel.html | 2,789 |
| panel.js | 277,717 |
| privacy.html | 6,201 |

## Local checks

- Exact 13-file runtime allowlist; no tests, fixtures, secrets/settings files or source maps
- MV3, product name, Chrome floor, description length and declared entry points
- Only 3 API permissions and 4 required GitHub/Claude hosts
- Packaged-script CSP and no external connection/sandbox/resource grants
- Four PNG headers match declared dimensions
- Footer and policy disclaimer; local policy link; script-free policy
- No console/debugger, string execution, prototype card/drop/fixture controls in runtime bundles
- Versioned, nonempty bundled directory under 2 MiB
- Reopened ZIP: every root path and file byte matches dist/

Agent checks were local static/build/ZIP checks only. Automated regression results are in artifacts/latest-test-run.log. The user subsequently reported Chrome testing; the agent did not observe Chrome or Claude, perform an upload, or submit to the Store.

On October 21, 2026 (Asia/Calcutta), after v1.0.0 release preparation, the user reported "tested in Chrome". Individual cases, outcomes and an exact tested ZIP hash were not supplied. The user previously confirmed one- and two-skill uploads from anthropics/skills on an earlier build; exact upload commit and skill names were not provided. See artifacts/USER-CONFIRMED-UPLOADS.md.

## Pending before submission

- Record flow-specific Chrome outcomes not detailed in the general test confirmation, including fallback/download completion and four dialog tab cases
- Review prepared 1280x800 screenshot crops and 440x280 promotional tile in store-assets/
- Working developer contact details in the Store dashboard
- Developer dashboard disclosures, submission and review

Permission justifications: ../docs/PERMISSIONS.md. Listing/privacy declarations: ../docs/STORE-LISTING.md. Screenshot and hosting steps: ../docs/RELEASE.md.
