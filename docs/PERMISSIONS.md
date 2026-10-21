# Skill Drop permission audit

Audit target: Manifest V3, version 1.0.0. Unofficial. Not affiliated with Anthropic.

Every retained permission is listed below. This is also the permission-justification text for the Chrome Web Store dashboard.

| Manifest permission | Feature and justification | Relevant source |
|---|---|---|
| `sidePanel` | Display skill search, repository loading, source previews, checkboxes, name-collision warnings, and Add controls in Chrome's side panel. Clicking the toolbar icon opens this panel. | `src/background.ts`, `manifest.json`, `panel.html` |
| `downloads` | Save complete skill ZIPs into the ClaudeSkills subfolder of the user's configured download folder when requested, or when Claude's file field cannot be filled. | `src/panel.ts` download helper; `src/delivery.ts` fallback |
| `storage` | Keep settings, the optional GitHub token, a validated directory snapshot for offline search, and prepared-name history on this device using chrome.storage.local. No chrome.storage.sync is used. | `src/panel.ts`; `src/background.ts` restricts local storage to trusted extension contexts |
| `https://claude.ai/*` | Run the packaged content script to check the Skills upload route/input and fill it with selected ZIPs after Add. Read matching Claude tab URLs in the current window to reuse or open the upload dialog. No chat text or installed-skill list is read. | `src/content.ts`, `src/upload-dialog.ts`, `src/panel.ts` |
| `https://api.github.com/*` | Read metadata, branches, commits and trees for user-selected repositories. An optional token is sent only to this exact host in the Authorization header. | `src/network.ts`, `src/repository.ts`, `src/skills.ts`, `src/github.ts` |
| `https://raw.githubusercontent.com/*` | Fetch a configured skills-index.json file and exact original SKILL.md previews from GitHub. Different repositories and branches require this host-wide access. | `src/index.ts`, `src/skills.ts`, `src/network.ts` |
| `https://codeload.github.com/*` | Download one archive per repository commit where possible and package each selected complete skill folder locally, preserving supporting files. | `src/skills.ts`, `src/repository.ts`, `src/network.ts` |

Removed: `unlimitedStorage`. The 75 MiB ZIP cache uses IndexedDB under normal Chrome storage quotas. Cache entries expire and can be evicted. If a new ZIP cannot be cached because of a quota error, the built ZIP remains available for immediate delivery/download in panel memory. No unlimited storage privilege is necessary for this workflow.

The three remaining API permissions and four host permissions support retained features, so none of those is removed. There is no `tabs`, `activeTab`, `scripting`, `webRequest`, `cookies`, browsing-history, clipboard, `<all_urls>`, or GitHub HTML-page host permission. The Claude content-script match duplicates the same permitted Claude origin; it is not another host grant. Tabs can be created, updated and reloaded without a new permission; the existing Claude host grant permits matching tab URL access.

There is no externally_connectable endpoint, web-accessible resource, remote script, eval-based execution, or remotely loaded executable extension logic. GitHub JSON, Markdown and archive members are data. The explicit extension CSP allows packaged scripts only, disallows plugin objects/frames, and limits network connections to the three GitHub service origins plus the extension itself. Source links open as ordinary browser navigation to GitHub.

References checked October 21, 2026:

- [Chrome Web Store privacy fields and minimum permissions](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Tabs permissions and host grants](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Extension storage quotas and eviction](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)
- [Manifest V3 content security policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)

This is a source audit and local test result, not Chrome Web Store approval or a new browser validation.
