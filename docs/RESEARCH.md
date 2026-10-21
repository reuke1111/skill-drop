# Phase 3 research — 21 October 2026 (Asia/Calcutta)

Research was reported to the user before Phase 3 implementation. No Chrome observation or installed-extension testing was performed.

## Existing directories and extensions

- [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills): verified public curated list. We use its README links as candidate repository addresses, then independently read the referenced repositories. A list entry is not proof of valid metadata or safe content.
- [GetSkill-Agent/getskill-indexer](https://github.com/GetSkill-Agent/getskill-indexer): verified public project with a downloadable [data/index.json](https://raw.githubusercontent.com/GetSkill-Agent/getskill-indexer/main/data/index.json). The inspected response was version 1.0.0, generated 2026-10-19T07:24:30.659Z, with 871 records. Its displayed schema includes names, descriptions and source URLs, but lacks the immutable skill-folder tree SHA and pinned commit required by our package cache. I did not verify an API stability guarantee or freshness SLA.
- [Skill Viewer in the Chrome Web Store](https://chromewebstore.google.com/detail/skill-viewer/cbmmcokkchdobijpdgppphlknfceokhb?hl=en): listing verified; it describes GitHub skill discovery, summaries and collecting a local command. Installed behavior and Claude.ai upload integration were not tested. The Store search page itself could not be fetched; this was not an exhaustive marketplace survey.

Decision: reuse existing lists as candidate sources; build our own small, versioned, commit-pinned index. We do not reuse an unverified directory as authoritative packaging metadata. No competitor implementation code was copied.

## Search access and limits

| Authentication | Repository/topic discovery | Code search | General REST primary limit |
|---|---|---|---|
| None | Public repository search works; tested with topic:claude-skills | Direct filename:SKILL.md request returned HTTP 401 Requires authentication | 60/hour per originating IP |
| Actions GITHUB_TOKEN | Authenticated search subject to endpoint permissions and rate limits | Supported token category is documented, but actual access in a workflow is not verified here; builder attempts it and records denial | Normally 1,000/hour per repository |
| User PAT | Authenticated search; access depends on token type and repository access | Documented authenticated endpoint; not exercised with a user token | Normally 5,000/hour, shared with other requests for that user |

GitHub documents search-specific limits of 10/minute unauthenticated, generally 30/minute authenticated, and 10/minute for authenticated code search. Search caps and incomplete responses prevent exhaustive discovery. We record bounded pagination, candidate caps and failures. Source: [GitHub search API](https://docs.github.com/en/rest/search/search).

The current code-search page contains contradictory generic wording about public anonymous access alongside its explicit authentication requirement. Our anonymous probe returned 401, so the builder skips code search without a token. With an Actions token, it tries one query and continues via topic/list discovery if denied. GitHub documents [installation-token search endpoints](https://docs.github.com/en/rest/authentication/endpoints-available-for-github-app-installation-access-tokens), but that does not prove a particular repository-scoped Actions token will find cross-repository matches.

Primary limits and exceptions: [GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api). Enterprise arrangements may differ. Responses and reset/retry headers take precedence over an assumed remaining allowance.

The direct anonymous code-search probe used no Authorization header and returned status 401. No Actions token or user token was used during this phase's research or tests. Token host restriction is covered by mocked transport tests.
