# Skill Drop privacy disclosure

Unofficial. Not affiliated with Anthropic.

Skill Drop runs in your browser. It has no analytics, telemetry, ads or developer-operated backend. It does not execute files or instructions downloaded from repositories.

## GitHub and Claude

Skill Drop talks directly to GitHub to load the skills index, repository information, original SKILL.md files and repository archives. It builds ZIPs on your device and checks them against the selected GitHub source. Repository and index content is treated as untrusted data and displayed as text.

When you choose **Add to Claude**, the selected ZIPs are placed in Claude's Skills file field, where Claude's page can process them. You review the previews and click **Upload** yourself. Skill Drop does not click Upload or read Claude's installed-skill list.

## Optional GitHub token

You can use public repositories without a token, subject to GitHub's limits. If you provide a token, it stays in `chrome.storage.local` on your device and is sent only to `api.github.com` in HTTPS Authorization headers. It is not stored in Chrome Sync or separately encrypted by the extension. Raw-file and archive hosts never receive it.

To remove the token, clear its field under **Advanced settings** and choose **Save settings**. The cached public-repository tests were run without a token.

## Directory cache

The index is checked before use, limited to 2 MiB and 5,000 records, and cached for 24 hours. If a refresh fails, Skill Drop can use the last valid cached directory. When no custom index URL is configured, it uses the built-in snapshot. Loading uncached files and repositories requires a network connection.

## Prepared ZIPs and name history

Prepared ZIPs use a local IndexedDB cache capped at 75 MiB. Entries older than 24 hours are pruned when the cache is used. Chrome's normal storage quota applies. If a newly built ZIP cannot be cached, it can still be delivered immediately from the panel. Successful file-input delivery removes the matching cached ZIPs.

Up to 300 previously prepared skill names stay on your device to support duplicate-name warnings. A prepared name does not mean the skill was installed in Claude. Use **Clear prepared-name history** to remove that history.

Downloaded ZIPs remain in your download folder until you delete them. Uninstalling Skill Drop removes its extension settings and cache.

## Packaged code

The extension's own code is packaged with it and runs under a policy that allows local scripts only. Downloaded repository and index content is never executed by Skill Drop.

The [published privacy policy](https://reuke1111.github.io/skill-drop/privacy) is also packaged locally and linked from the panel footer.
