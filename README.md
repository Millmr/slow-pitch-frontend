# Slow-Pitch — frontend

React + TypeScript + Vite app for the [Slow-Pitch Django API](https://github.com/Millmr/render-slow-pitch-django):
sign in, pick a team, answer availability, build lineups, enter results and
stats, and check the leaderboard. Built mobile-first for use in the dugout.

## Run it locally (Docker)

1. Start the API in the Django repo: `docker compose up` (it serves http://localhost:8000).
2. In this repo:

   ```bash
   docker compose up
   ```

3. Open http://localhost:5173 and sign in. With the API's demo data
   (`docker compose run --rm web python manage.py seed_demo` in the Django
   repo) that's `manager` / `softball-demo-1`.

The first start runs `npm install`, which creates `package-lock.json` —
commit it. Edits to `src/` reload in the browser automatically.

Type-check or build inside the container:

```bash
docker compose run --rm web npm run typecheck
docker compose run --rm web npm run build
```

### Without Docker

Needs Node 20.19+ or 22.12+.

```bash
cp .env.example .env    # VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

## Pointing at the deployed API

For local development against the Render API, put this in `.env` and restart
`docker compose up`:

```
VITE_API_URL=https://render-slow-pitch-django.onrender.com
```

Set `VITE_API_URL` to the API's address with no trailing slash, for example
`https://render-slow-pitch-django.onrender.com`. It's baked in at build time.
The API must also allow this app's origin: set `CORS_ALLOWED_ORIGINS` on the
Django service to the frontend's URL.

## Deploying to Render (static site)

- **New → Static Site**, connect this repo
- **Build command:** `npm install && npm run build`
- **Publish directory:** `dist`
- **Environment:** `VITE_API_URL=https://render-slow-pitch-django.onrender.com`
- **Redirects/Rewrites:** add a rewrite from `/*` to `/index.html` so links
  like `/games/12` work on refresh

Then add the static site's URL (e.g. `https://slow-pitch-frontend.onrender.com`)
to `CORS_ALLOWED_ORIGINS` on the Django web service.

## Structure

```
src/
  api/          fetch client (token auth, error messages) and one module per area
  auth/         sign-in state; a 401 sends you back to the sign-in screen
  team/         remembers the current team and season for navigation
  components/   layout, loading/error states, availability picker, stepper
  pages/        one component per route
  lib/          date formatting and the useApi/useAction hooks
  types/        API response shapes
```

| Route | Page |
|---|---|
| `/login` | Sign in or create an account |
| `/teams` | Pick or start a team |
| `/teams/:teamId` | Next game, your availability, recent results |
| `/teams/:teamId/roster` | Roster; managers add and edit players |
| `/seasons/:seasonId/schedule` | Games; managers add games |
| `/games/:gameId` | Scoreboard, lineup, who's coming, final score |
| `/games/:gameId/lineup` | Lineup editor (managers) |
| `/games/:gameId/stats` | Stat entry (managers) or box score |
| `/seasons/:seasonId/leaderboard` | Sortable season stats |
| `/players/:membershipId` | Player season line and game log |

Managers and players see the same pages; management controls only appear for
managers, and the API enforces the permissions either way.
