# PokeServer — Private Pokemon Battle Platform

A private, self-hosted Pokémon battle server for a small friend group with full Showdown-accurate battle simulation, leaderboards, replays, and chaotic formats. Use @pkmn/sim as the battle engine — this project builds everything around it: lobby, matchmaking, auth, ELO tracking, and replay storage.

Badges: (add CI / Docker Hub / license badges here)

---

Table of contents
- About
- Project Philosophy
- Features
- Tech stack
- Supported formats
- Architecture overview
- Database (Prisma) schema
- Socket.io events (client ↔ server)
- Local development
- Docker (prod / minimal deployment)
- Migrations & seeding
- ELO system
- API & example usage
- Contributing
- Roadmap
- Troubleshooting
- License & acknowledgements

About
-----
PokeServer provides a fun, low-friction environment for friends to play Pokémon battles with accurate mechanics. It intentionally avoids building its own battle engine — instead @pkmn/sim (the Showdown simulator packaged for Node) is used for all game rules and validation. The focus is on building a great multiplayer experience around that engine: lobby, realtime updates, replays, scoring, and leaderboards.

Project philosophy
------------------
- Do NOT build the battle engine — rely on @pkmn/sim / @pkmn/dex / @pkmn/data.
- Keep it small and simple: targeted for a small friend group.
- Prioritize playable, bug-free battles over over-engineered systems.
- Prefer working code and iterative improvements.

Features
--------
- Real-time lobby and matchmaking (Socket.io)
- Accurate battle logic via @pkmn/sim
- Ranked and unranked modes (format-dependent)
- Per-format ELO leaderboards and W/L tracking
- Replay storage (full sim log)
- Svelte frontend with Tailwind styles (React alternative supported)
- Dockerized deployment (docker-compose + nginx)
- Simple JWT auth: username/password (bcrypt hashed)
- Prisma + PostgreSQL persistence

Tech stack
----------
- Backend: Node.js (v20+), Express.js, Socket.io, TypeScript
- Battle engine: @pkmn/sim + @pkmn/data + @pkmn/dex
- ORM: Prisma (Postgres)
- Frontend: Svelte (SvelteKit preferred) + Tailwind CSS
- Infra: Docker, docker-compose, nginx reverse proxy

Supported formats
-----------------
Pass these format IDs directly to @pkmn/sim:

| Display | Sim format string | Notes |
|---|---:|---|
| Random Battle | gen9randombattle | Main chaotic format — sim generates the teams |
| OU | gen9ou | Standard singles |
| Ubers | gen9ubers | Legendaries allowed |
| Anything Goes | gen9anythinggoes | No restrictions |
| Doubles OU | gen9doublesou | Doubles standard |
| Doubles Ubers | gen9doublesubers | Doubles unrestricted |
| Random Doubles | gen9randomdoublesbattle | Chaotic doubles |
| Mega Battle | gen7ou | Use Gen 7 for full Mega evolution support |
| Random Mega | gen7randombattle | Random teams but with Gen 7 megas |

Note: Gen 7 is included so full Mega support exists even though Gen 9 has limited Mega coverage.

Architecture overview
---------------------
- Express server running Web API + Socket.io
- Battle manager: spawns and controls @pkmn/sim battles, validates moves, persists logs
- Realtime: Socket.io rooms per-battle, lobby channels, user presence
- Database: PostgreSQL via Prisma — users, battles, participants, ELO per-format
- Frontend: SvelteKit UI for lobby, matchmaking, in-battle view with replay viewer
- Deployment: Docker Compose for backend, frontend (static or SSR), Postgres, and nginx reverse proxy

Database (Prisma)
-----------------
Core models are:

```prisma name=prisma/schema.prisma
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  password  String   // bcrypt hashed
  createdAt DateTime @default(now())
  battles   BattleParticipant[]
  elo       Elo[]
}

model Battle {
  id           String   @id @default(uuid())
  format       String
  createdAt    DateTime @default(now())
  endedAt      DateTime?
  winnerId     String?
  replayLog    String   // Full sim log stored as text
  participants BattleParticipant[]
}

model BattleParticipant {
  id       String @id @default(uuid())
  battleId String
  userId   String
  side     Int    // 0 or 1
  battle   Battle @relation(fields: [battleId], references: [id])
  user     User   @relation(fields: [userId], references: [id])
}

model Elo {
  id       String @id @default(uuid())
  userId   String
  format   String
  rating   Int    @default(1000)
  wins     Int    @default(0)
  losses   Int    @default(0)
  user     User   @relation(fields: [userId], references: [id])

  @@unique([userId, format])
}
```

Socket.io event architecture
----------------------------
Client → Server
- 'challenge' { targetUser, format } — challenge a user to a match
- 'accept' { battleId } — accept a challenge
- 'decline' { battleId } — decline a challenge
- 'move' { battleId, moveChoice } — make a move (Showdown choice string)
- 'switch' { battleId, switchChoice } — switch a Pokémon
- 'team' { battleId, team } — submit team (for non-randbat formats)
- 'forfeit' { battleId } — forfeit match

Server → Client
- 'challenged' { battleId, challenger, format } — you received a challenge
- 'battleStart' { battleId, initialState } — battle started
- 'battleUpdate' { battleId, log, state } — turn resolved; updates and log
- 'battleEnd' { battleId, winner, eloChanges } — battle finished
- 'error' { message } — user-facing error

Socket usage tips
- Keep battle rooms private per battleId.
- Authenticate sockets using JWT (send token in connection handshake).
- Validate all incoming move strings against the sim before applying to state.

Local development
-----------------
These are example commands — adapt to your repository layout (monorepo vs separate server/client folders).

1. Install dependencies
```bash
# from repo root (example)
npm install
# OR, if separated:
cd server && npm install
cd ../client && npm install
```

2. Environment
Create a .env file (see example below).

```text name=.env.example
# Server
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@db:5432/pokeserver?schema=public
JWT_SECRET=change-me-to-a-secure-random-string
NODE_ENV=development

# Optional
PKMN_DATA_PATH=./node_modules/@pkmn/data
```

3. Run Postgres (local or via Docker)
- If using docker-compose, see Docker section below.
- Or run a local Postgres and point DATABASE_URL to it.

4. Migrate & seed
```bash
# from server root
npx prisma migrate dev --name init
node ./prisma/seed.js   # if a seeding script exists
```

5. Run server & frontend
```bash
# Server (dev)
npm run dev --prefix server

# Frontend (dev)
npm run dev --prefix client
```

Docker (recommended for easy deploy)
-----------------------------------
Example minimal docker-compose.yml (tweak as needed):

```yaml name=docker-compose.yml
version: "3.8"
services:
  db:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: pokeserver
    volumes:
      - db-data:/var/lib/postgresql/data
  server:
    build: ./server
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/pokeserver
      JWT_SECRET: change-me
      NODE_ENV: production
    depends_on:
      - db
    ports:
      - "4000:4000"
  client:
    build: ./client
    ports:
      - "3000:3000"
    depends_on:
      - server

volumes:
  db-data:
```

Production notes
- Run prisma migrate deploy after building.
- Use an nginx reverse proxy in front of the server + static client assets.
- Use a secure JWT_SECRET and TLS for public exposure.

Migrations & seeding
--------------------
- Use Prisma migrations for schema changes.
- Include a seed script to create test users, sample ELO entries, and demo battles.
- For CI, run `npx prisma migrate deploy` against a test DB and run integration tests.

ELO system
----------
- Starting rating: 1000 per format
- K-factor: 32
- Track ELO per user and format
- Random Battle formats are unranked by default (host-selectable to be ranked)

Reference ELO calculation (TypeScript snippet):

```ts name=scripts/calcElo.ts
export function updateElo(rA: number, rB: number, scoreA: number, k = 32) {
  // scoreA: 1 = A wins, 0.5 = draw, 0 = A loses
  const expectedA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  const newA = Math.round(rA + k * (scoreA - expectedA));
  const newB = Math.round(rB + k * ((1 - scoreA) - (1 - expectedA)));
  return { newA, newB, deltaA: newA - rA, deltaB: newB - rB };
}
```

API & example usage
-------------------
- Auth: POST /api/auth/register, /api/auth/login (returns JWT)
- Users: GET /api/users/:id, GET /api/leaderboard?format=gen9ou
- Battles: POST /api/battles (create challenge), GET /api/battles/:id (replays)
- Replays: stored as full simulator logs in `Battle.replayLog`

Socket example (connect with JWT):
```js
const socket = io("https://pokeserver.example", {
  auth: { token: "Bearer <JWT_TOKEN>" }
});
socket.emit("challenge", { targetUser: "friend", format: "gen9ou" });
```

Replays & replay viewer
-----------------------
- Store the full @pkmn/sim log in the DB (Battle.replayLog).
- Provide a replay player on the client that replays logs step-by-step (use the sim's log parser functions).

Contributing
------------
- Read the code of conduct (add file)
- Branch from main -> feature branch
- Open PRs against main with clear description & screenshots
- Write tests for critical path (battle lifecycle, ELO updates)
- Keep changes small and focused

Roadmap
-------
- Improve spectator mode + chat
- Add custom tournament playlists
- Add replay sharing / permalink
- Add match history + per-player "favorite Pokémon" statistics
- Add CI: linting, typecheck, tests, and deploy preview

Troubleshooting
---------------
- "Moves rejected by server" → ensure you send the exact Showdown choice string and your client-side view stayed in sync with server battle state.
- "Auth failing" → check JWT_SECRET, verify token in socket handshake headers, and confirm clocks are not wildly skewed.
- Database errors after changing schema → run `npx prisma migrate dev` locally or `npx prisma migrate deploy` in production.

Security notes
--------------
- This project stores passwords hashed (bcrypt) — never store plaintext.
- Keep JWT_SECRET secret and rotate if leaked.
- For public exposure, secure with TLS and consider rate-limiting.

License & acknowledgements
--------------------------
- Add your preferred license (MIT recommended for small projects).
- Acknowledge and link to:
  - Pokemon Showdown / @pkmn/sim, @pkmn/dex, @pkmn/data
  - Socket.io
  - Prisma
  - Svelte & Tailwind

Contact
-------
- Repo: https://github.com/nischal2805/pokemon
- Maintainer: nischal2805 (update with email / Discord/GitHub handle)

---

What I did and what's next
--------------------------
I created a complete, production-oriented README tailored to the PokeServer project you described: it covers philosophy, supported formats, architecture, Prisma schema, socket events, dev and Docker instructions, ELO calculation, and contributor guidance. Next, I can:

- Generate README badges and a CONTRIBUTING.md / CODE_OF_CONDUCT.md,
- Add example seed scripts and a working docker-compose.override for local dev,
- Or create a small "Getting started" skeleton script (server + client starter) that fits your repo layout.

Tell me which of those you'd like next and whether I should draft a CONTRIBUTING.md or a docker-compose tailored exactly to the repository layout.
