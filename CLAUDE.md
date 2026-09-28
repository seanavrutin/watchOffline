# CLAUDE.md

## What & why
Personal "watch offline" tool: search movies/TV (TMDb), pick a torrent with
matching subtitles (OpenSubtitles + Ktuvit for Hebrew), send it to qBittorrent,
and drop the `.srt` next to the video in the shared media folder that Plex
serves. It also tracks TV seasons and auto-downloads new episodes daily.

- `server/` — **the live backend.** Plain CommonJS JavaScript, Express 5,
  Node 18 (`node:18-alpine`). `index.js` mounts the routes and, once listening,
  loads `jobs/episodeChecker.js` (cron). `routes/` → `services/` (`tmdb`,
  `apibay` torrent search, `openSubtitles`, `ktuvit`, `qbittorrent`,
  `downloader`, `mailer`); `utils/matchSubtitles.js` scores subtitle ↔ release
  matches. Firestore via `firebase-admin` (named database `watch-offline`).
- `client/` — CRA React PWA, Firebase Auth (Google sign-in). All HTTP in
  `src/services/api.js`, base URL from `REACT_APP_API_BASE_URL`; sends the
  Firebase ID token as `Authorization: Bearer`. Not deployed with the server.

## API
| Route | Auth | What |
|---|---|---|
| `GET /api/search` | – | torrent search + subtitle matching |
| `GET /api/tmdb/search`, `/api/tmdb/tvInfo` | – | TMDb lookups |
| `POST /api/downloadSub/{openSubtitles,ktuvit}` | – | stream a subtitle to the browser |
| `POST /api/dropzone/subtitle/{openSubtitles,ktuvit}` | – | write `.srt` into the dropzone |
| `GET /api/dropzone/torrents`, `DELETE /api/dropzone/torrent/:hash`, `POST /api/dropzone/torrent` | – | qBittorrent list / delete / add (+ subs) |
| `GET /api/shows`, `/api/shows/:tmdbId`, `/:tmdbId/status` | – | tracked shows |
| `POST/PUT/DELETE /api/shows…`, `POST /api/shows/check-all` | ✔ | manage tracked shows, trigger the checker |

`requireAuth` (`middleware/auth.js`) verifies the Firebase ID token and allows
only emails whose local part is in `PERMITTED_USERS`.

## Configuration
Env comes from `server/.env` via `dotenv` — the compose file passes no
`environment`/`env_file`. Keys: `PORT` (3001), `DROPZONE_PATH` (in-container,
default `/dropzone`), `QBITTORRENT_URL/USER/PASS`, `TMDB_API_KEY`,
`OPENSUBTITLES_API_KEY`, `USER_AGENT`, `PERMITTED_USERS`, `MAIL_TO`,
`RESEND_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` or `…_PATH`.

**`server/.env` is baked into the image**: the build context is `./server`,
which has no `.dockerignore`, and the Dockerfile does `COPY . .`. So an `.env`
change needs a rebuild (`docker compose up -d --build`), not a restart — and the
image contains the secrets.

The host media folder is `DROPZONE_HOST_PATH` in the compose file (see the
comment there); it defaults to the home server's path.

## Diagnostics
Container `watchoffline-server-1` (compose project at the repo root), port 3001,
`restart: always`. **No health route** — on purpose; any HTTP answer on `:3001`
(`/` gives 404) means the process is up.

```bash
docker logs --since 24h -t watchoffline-server-1 2>&1 | tail -200
docker logs --since 7d -t watchoffline-server-1 2>&1 | grep '\[episodeChecker\]'
```

- Logs are plain `console.*` lines with **no timestamps** — always use `-t`.
  Background code is tagged `[episodeChecker]`, `[downloader]`, `[mailer]`;
  route errors are untagged (`Failed to …`, or a bare stack from `console.error(e)`).
- Boot: `Server running on port 3001`, then
  `[episodeChecker] Scheduled daily check at 07:00`.
- The checker runs daily at 07:00 **container time = UTC** (no `TZ` set), so
  10:00/09:00 Israel time. A run is `Starting daily episode check...` → per show
  `Checking:` / `Missing: … — attempting download` → `Finished. Results: N`, then a
  `[mailer] Report sent` email. `qBittorrent unavailable` aborts the run.
- Most failures are upstream: TMDb, apibay, OpenSubtitles (API key/quota),
  Ktuvit (scraped, cookie-based — breaks when the site changes), qBittorrent
  login. Check which service logged before blaming the route.

Known gaps (not bugs to "discover" again):
- Only the `/api/shows` write routes are authenticated. Torrent add/delete and
  subtitle writes under `/api/dropzone` are open to anyone who can reach the API.
- `.env` baked into the image (above).

## Rules
- No build step and no tests. Verify server changes with `node --check` on each
  changed file (syntax only). Most modules pull in `firebase.js`, which needs
  real credentials at load time, so behaviour is verified after deploy: exercise
  the changed route with `curl` and read the log lines it emits.
- Don't run the server locally against production credentials: it starts the
  episode-checker cron, which downloads torrents and sends emails.
- New env var → document it in the Configuration section above (there is no
  `.env.example`).
- NEVER commit or print `server/.env`, service-account JSON, or API keys.
