# Ethio Bingo backend — Base44 dev environment notes

## What this repo is
Node.js (CommonJS) **backend only**: Express + Socket.IO + `node-telegram-bot-api`.
There is no frontend here — `GET /` returns the plain text `Ethio Bingo Backend is running!`.
The playable client lives outside this repo (the bot links to `https://ethio-bingo-frontend.vercel.app`).

- `server.js` is the real entry point (`npm start`). It is the one that runs.
- `index.js` is a legacy/alternate variant with hardcoded sample cartelas and is **not** referenced by
  `package.json` — leave it alone unless asked.

## Running it
`docker compose -f docker-compose.base44.yml up -d --build` → app on host port 3000.
`server.js` reads `PORT`; compose sets `PORT=3000` so the preview proxy reaches it.

- Runs from the bind-mounted source with `node --watch` → editing `server.js` restarts the process,
  no image rebuild needed.
- No lockfile is committed, so dependencies are installed into a **named volume** (`node_modules`)
  on startup. Keep `node_modules` out of the repo tree; do not run a second concurrent installer.
- No database, cache or queue: all game state is in-memory (`drawnNumbers`, `takenCartelas`), so a
  restart wipes an in-progress game and cartelas become free again.

## Verifying it works
- Health: `docker inspect --format '{{.State.Health.Status}}' app-backend-1` (probes `GET /`).
- Game loop without a browser, via Socket.IO polling:
  `curl -s 'http://localhost:3000/socket.io/?EIO=4&transport=polling'` → take `sid` →
  `curl -s -X POST -d '40' "...&sid=$SID"` to open the namespace →
  `curl -s -X POST -d '42["select_cartela",7]' "...&sid=$SID"` then poll the GET URL.
  A draw is emitted as `42["number_drawn",...]` every 3s (`startNewGame()` runs at boot).

## Telegram bot
- `TELEGRAM_BOT_TOKEN` comes from `/run/base44/app.env` (Base44 secrets), **never** hardcode it.
- The token that was previously hardcoded in `server.js` is exposed in git history and should be
  revoked with @BotFather.
- Without the token the server still boots; only the bot is skipped (a warning is logged).
