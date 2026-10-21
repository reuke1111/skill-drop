# Skill Drop

Unofficial. Not affiliated with Anthropic.

Skill Drop finds Claude Skills on GitHub, shows the original SKILL.md, and prepares complete skill folders for upload in Claude's Skills settings. You review the files and click **Upload** yourself.

[Demo video](VIDEO_LINK) · [Privacy policy](https://reuke1111.github.io/skill-drop/privacy) · [Download v1.0.0](https://github.com/reuke1111/skill-drop/releases/download/v1.0.0/skill-drop-1.0.0.zip)

## Install

Requires Chrome 120+.

1. Download `skill-drop-1.0.0.zip` from [Releases](https://github.com/reuke1111/skill-drop/releases/tag/v1.0.0).
2. Unzip it.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select the unzipped folder.

## How to use

1. Open the Skill Drop side panel.
2. Paste a GitHub link and press Enter, or search the built-in list.
3. Read the original SKILL.md before selecting a skill.
4. Tick the skills you want and click **Add to Claude**.
5. Check the names and previews in Claude, then click **Upload** yourself.

## If the file can't be placed in Claude

- Skill Drop starts ZIP downloads into `Downloads/ClaudeSkills` under your configured download folder.
- Check Chrome Downloads to confirm the files finished downloading.
- Use Claude's **Browse** button to select the ZIPs.
- Review the previews and click **Upload** yourself.

## Advanced settings

The extension ships with a built-in list of 57 skills. To use a newer list, paste the raw `skills-index.json` URL under **Advanced settings**. Direct GitHub repository links work without it.

## Privacy

Skill Drop has no developer-operated server, analytics, telemetry or ads. It talks directly to GitHub and places only the ZIPs you select in Claude's file field. The optional GitHub token stays on your device and is sent only to `api.github.com`. Downloaded content is treated as untrusted data and is never executed by the extension. Read the [full privacy disclosure](docs/PRIVACY.md).

## Tested

- Skills from `anthropics/skills`, one and two at a time, uploaded to Claude.
- Claude rejected a duplicate skill name.
- Third-party repository uploads — **TODO: confirm**.

Automated tests use saved GitHub responses, along with mocked inputs. See [release verification details](docs/RELEASE.md#verification-scope).

## Unofficial and at your own risk

Skill Drop depends on Claude's current upload page. If placing files in the page stops working, use the ZIP download fallback. Read skills before uploading: they are instructions for Claude.

## License

MIT. See [LICENSE](LICENSE).

## Build from source

Requires Node.js 22+.

```text
npm.cmd ci --ignore-scripts
npm.cmd test
npm.cmd run build
npm.cmd run release
```

On other platforms, use `npm` instead of `npm.cmd`.
