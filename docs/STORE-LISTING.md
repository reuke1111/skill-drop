# Skill Drop — Chrome Web Store listing copy

## Name

Skill Drop

## Short description

Find GitHub skills, review their source, and prepare ZIPs for Claude's upload dialog. Unofficial; not affiliated with Anthropic.

## Detailed description

Find and review GitHub skills from Chrome's side panel, then prepare their ZIP files for Claude's Skills upload dialog.

- Search the bundled skills directory by name, description or repository.
- Paste a GitHub repository or folder link and press Enter to find its SKILL.md files, including nested skills.
- Read the original SKILL.md, inspect its repository and path, and see its supporting-file count before selecting it.
- Select one or more skills. Skill Drop checks their source files and builds a ZIP for each complete skill folder in your browser.
- See warnings when selected skills share a name or a name was previously prepared on this device. The author's skill files are preserved without silent renaming.
- Choose Add to Claude to fill the Skills file field. Review Claude's previews and click Upload yourself.
- If the file field cannot be filled, download the prepared ZIPs and use Claude's browse button instead.

An optional GitHub token can increase API access limits. It is stored on this device and sent only to api.github.com. You can use public repositories without a token, subject to GitHub's limits. A cached directory can be searched offline; fetching uncached repositories and files requires a connection. Advanced settings can point to a published GitHub-hosted directory index. The bundled snapshot does not update itself daily.

Skill Drop has no analytics, advertising, telemetry or developer-operated backend. It contacts GitHub directly for skill data and interacts with claude.ai to prepare files you select. Repository content is treated as untrusted data and is never executed by the extension. Review skills before adding them. Upload acceptance, scanning and duplicate handling are controlled by Claude.

Unofficial. Not affiliated with Anthropic.

## Single-purpose statement

Help users discover and review GitHub skills, package their complete folders into ZIP files, and prepare those selected ZIPs in Claude's Skills upload dialog for user-confirmed upload.

## Privacy disclosure text

Skill Drop processes search text, GitHub repository links, skill files, selected ZIPs and duplicate-name history locally to provide its discovery and upload-preparation features. Settings, a directory cache, prepared-name history and the optional GitHub token are stored on this device. The token uses chrome.storage.local, not Sync, and is sent only to api.github.com in HTTPS Authorization headers. Local token storage is not separately encrypted by the extension. Raw file and archive requests never receive it. There is no analytics, tracking, advertising, sale of data, crash-reporting service or developer-operated server.

GitHub receives direct requests for repository metadata, paths, raw files, the optional directory index and archives. GitHub and Claude can receive ordinary service/network information such as the user's IP address. Choosing Add places selected ZIPs in Claude's file input, making them available to Claude's page; the user clicks Upload. Claude chat contents, credentials and installed-skill lists are not read or collected by the extension. Matching Claude tab URLs are used transiently to find the upload dialog. Downloads stay in the user's download folder until removed. The full policy describes retention and deletion controls.

## Dashboard declarations

- Use every row in [PERMISSIONS.md](PERMISSIONS.md) for the corresponding permission justification.
- Remote code: **No**. Only packaged extension code runs. Repository scripts, Markdown and downloaded indexes are treated as data.
- Data handling: disclose **authentication information** (the optional GitHub token), **website content** (skill files/index/repository data), and **web history/activity** limited to explicitly requested repository URLs and transient matching Claude tab URLs, using the dashboard's current category wording. State that this serves the single purpose and is local except for direct requests to GitHub and the user-selected file handoff to Claude. Do not make an unqualified “handles no user data” declaration simply because there is no developer backend.
- The developer does not sell data, use it for unrelated purposes, or use it to determine creditworthiness or lending eligibility.
- Privacy policy URL: **https://reuke1111.github.io/skill-drop/privacy.html**. Support URL: **https://github.com/reuke1111/skill-drop/issues**. Add your working developer contact details to the listing before submitting; the policy refers users to that contact or Support link.

These declarations describe the supplied source. The developer must review and certify them in the dashboard; no submission or review decision has been made here.

References checked October 21, 2026: [privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [local data handling also needs disclosure](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
