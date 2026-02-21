# PokeServer — Private Pokemon Battle Platform
> A private, self-hosted Pokemon battle platform for a small friend group with full battle accuracy, leaderboards, replays, and chaotic formats.

---

## Project Philosophy
- **Do NOT build the battle engine.** Use `@pkmn/sim` (the npm-packaged Pokemon Showdown simulator). It handles every mechanic: damage, status, abilities, held items, IVs, EVs, natures, mega evolution, weather, terrain, all of it.
- The job is to build everything AROUND the engine: lobby, UI, matchmaking, leaderboards, auth, and replay storage.
- Keep it simple. This is a private server for friends. No need to scale to thousands of users. Prioritize playability and fun over engineering perfection.
- Prefer working code over perfect code. Ship a battle that works, then iterate.

---

## Tech Stack

### Backend
- **Runtime:** Node.js (v20+)
- **Framework:** Express.js
- **Realtime:** Socket.io
- **Battle Engine:** `@pkmn/sim` + `@pkmn/data` + `@pkmn/dex`
- **Database:** PostgreSQL (via Prisma ORM)
- **Auth:** Simple JWT-based auth — no OAuth needed, it's just friends
- **Team Validation:** `@pkmn/sim` handles this natively per format

### Frontend
- **Framework:** Svelte (or React if more comfortable — Svelte preferred for simplicity)
- **Styling:** Tailwind CSS
- **Realtime:** Socket.io-client
- **Routing:** SvelteKit (or React Router)

### Infrastructure
- **Deployment:** Docker + docker-compose
- **Reverse Proxy:** nginx
- **Server:** Personal VPS (low latency is the whole point)
- **DB Hosting:** Local Postgres container in docker-compose

---

## Formats to Support
Implement ONLY these formats. Pass format ID strings directly to `@pkmn/sim`:

| Format Name | Sim Format String | Notes |
|---|---|---|
| Random Battle | `gen9randombattle` | Main format. Sim generates teams. |
| OU | `gen9ou` | Standard competitive singles |
| Ubers | `gen9ubers` | Legendaries allowed |
| Anything Goes | `gen9anythinggoes` | Truly unrestricted singles |
| Doubles OU | `gen9doublesou` | Standard doubles |
| Doubles Ubers | `gen9doublesubers` | Unrestricted doubles |
| Random Doubles | `gen9randomdoublesbattle` | Chaotic, hilarious |
| Mega Battle | `gen7ou` | Use Gen 7 for full mega support |
| Random Mega | `gen7randombattle` | Random teams with mega access |

> **Mega Evolution Note:** Gen 9 has limited mega support. For full mega access (all ORAS/XY/SM megas), run Gen 7 formats. Both can coexist — just offer both in the format selector. `@pkmn/sim` handles the generational differences automatically.

---

## Database Schema (Prisma)

```prisma
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

---

## Elo System
- Starting Elo: **1000** for every player in every format
- Use standard Elo formula with K-factor of **32** for all matches (small player pool, keep it dynamic)
- Track Elo **per format separately** — your Randbat Elo is independent of your OU Elo
- Random Battle formats are **unranked by default** but can be toggled to ranked (let the host decide)
- Display on leaderboard: Elo, W/L, total games, win rate, and "favorite mon" (most used across battles)

---

## Socket.io Event Architecture

### Client → Server
```
'challenge'        { targetUser, format }         // Send a challenge
'accept'           { battleId }                    // Accept a challenge
'decline'          { battleId }                    // Decline a challenge
'move'             { battleId, moveChoice }        // Make a move (use Showdown choice string format)
'switch'           { battleId, switchChoice }      // Switch pokemon
'team'             { battleId, team }              // Submit team (for non-randbat formats)
'forfeit'          { battleId }                    // Forfeit the match
```

### Server → Client
```
'challenged'       { battleId, challenger, format }   // You've been challenged
'battleStart'      { battleId, initialState }          // Battle has begun
'battleUpdate'     { battleId, log, state }            // Turn resolved, here's what happened
'battleEnd'        { battleId, winner, eloChanges }    // Battle over
'error'            { message }                         // Something went wrong
```

### Choice String Format (from @pkmn/sim docs)
- Move: `"move 1"` through `"move 4"`
- Switch: `"switch 2"` through `"switch 6"`
- Mega: `"move 1 mega"`
- Pass (doubles): `"pass"`

---

## Battle Flow (Server Side)

```
1. Two players connect to battle room via socket
2. For randbat: sim generates both teams automatically
3. For non-randbat: collect team from each player, validate via sim, reject if illegal
4. Create Battle instance: new Battle(format, options)
5. Feed each player's team via battle.setPlayer()
6. Listen for battle.outputLog — parse and send to clients
7. Receive move choices from clients, call battle.choose(side, choiceString)
8. After each choose(), check battle.ended
9. If ended: determine winner, update Elo, save replay log to DB
```

---

## Battle UI Requirements

The UI should show:
- **Enemy side:** Pokemon sprite (or icon), name, level, HP bar, status condition badge, active held item icon
- **Your side:** Same as above
- **Move buttons:** 4 moves with PP counter, type badge, disabled if no PP
- **Switch panel:** Your party with HP indicators, fainted shown greyed out
- **Battle log:** Scrolling text log of what's happening (parse from sim output)
- **Mega button:** Appears when your active mon can mega evolve — toggle before selecting move
- **Timer:** Optional per-turn timer (30s or 60s, host configurable)

For doubles, show 2 slots per side and allow targeting (move buttons expand to show target selector).

Use Pokemon Showdown's sprite/icon assets — they are freely available and save enormous time:
- Sprites: `https://play.pokemonshowdown.com/sprites/`
- Icons: `https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png`

---

## Lobby & Social Features

- **Online list:** Show which friends are currently online
- **Challenge system:** Click a friend → select format → send challenge → they accept/decline
- **Active battles:** See ongoing battles (spectate button — nice to have, not MVP)
- **Recent battles:** Last 10 battles for each user with replay link
- **Replays:** Stored sim log can be replayed using the Showdown replay format (or build a simple step-through viewer)

---

## Leaderboard Page

Show a table per format with:
- Rank, Username, Elo, W, L, Win%, Games Played
- Highlight the current user's row
- "Favorite Mon" column — computed from replay logs (most frequently used Pokemon across all battles)
- Toggle between formats via tabs

---

## Auth & User Management

- Simple username + password registration
- Passwords hashed with bcrypt (12 rounds)
- JWT stored in httpOnly cookie (not localStorage)
- No email verification needed — host manually creates accounts or allows open registration with an invite code
- Max users: no real limit needed, just set a reasonable cap like 20 in config

---

## Project Structure

```
/
├── server/
│   ├── index.js               # Express + Socket.io entry point
│   ├── battle/
│   │   ├── BattleManager.js   # Manages active Battle instances
│   │   ├── BattleRoom.js      # Handles socket events for one battle
│   │   └── formats.js         # Format config and metadata
│   ├── routes/
│   │   ├── auth.js            # Login, register
│   │   ├── leaderboard.js     # Elo + stats endpoints
│   │   └── replays.js         # Fetch replay logs
│   ├── elo.js                 # Elo calculation logic
│   └── prisma/
│       └── schema.prisma
│
├── client/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte       # Lobby
│   │   │   ├── battle/[id].svelte # Battle UI
│   │   │   ├── leaderboard.svelte
│   │   │   └── replays/[id].svelte
│   │   ├── components/
│   │   │   ├── BattleField.svelte
│   │   │   ├── MovePanel.svelte
│   │   │   ├── PartyPanel.svelte
│   │   │   ├── BattleLog.svelte
│   │   │   └── HPBar.svelte
│   │   └── stores/
│   │       ├── socket.js
│   │       └── battle.js
│   └── package.json
│
├── docker-compose.yml
├── nginx.conf
└── CLAUDE.md                  # This file
```

---

## MVP Build Order

Build in this exact order. Don't skip ahead.

1. **Auth** — register, login, JWT middleware working
2. **Lobby socket** — users connect, see each other online
3. **Challenge flow** — send, accept, decline challenges
4. **Battle engine integration** — get a randbat battle running in the terminal (no UI yet), just console.log the sim output
5. **Battle sockets** — wire the working engine to socket events, two browser tabs can battle
6. **Basic battle UI** — HP bars, move buttons, log. Ugly is fine. Functional is everything.
7. **Elo + leaderboard** — calculate and store after each battle ends
8. **More formats** — add non-randbat formats once battle UI works
9. **Team builder** — allow paste of Showdown-format teams for OU/Ubers/AG etc.
10. **Polish** — sprites, animations, better UI, replay viewer, favorite mon stats

---

## Key Libraries & Docs

- `@pkmn/sim` — https://github.com/pkmn/ps (the main engine)
- `@pkmn/data` — Pokedex, moves, items, abilities data
- `@pkmn/sets` — Team import/export in Showdown paste format
- Pokemon Showdown protocol docs — https://github.com/smogon/pokemon-showdown/blob/master/PROTOCOL.md (understand the sim's output format)
- Prisma docs — https://www.prisma.io/docs

---

## Important Notes for Claude

- Always use `@pkmn/sim` for ALL battle logic. Never reimplement damage formulas, type charts, ability effects, or anything the sim already handles.
- The sim is authoritative. The server runs the sim. Clients are dumb displays.
- When parsing sim output log lines, refer to the Showdown PROTOCOL.md — every line type (`|move|`, `|switch|`, `|damage|`, `|-status|` etc.) is documented there.
- For team validation in non-randbat formats, use the sim's built-in `Teams.validate()` — never write custom validation logic.
- Mega evolution in Gen 7 formats works out of the box — just use gen7 format strings.
- Keep the Elo module pure and stateless — just a function that takes two ratings and returns new ratings. Easy to test.
- Socket rooms: one room per battle, named by battleId. Players join on accept, leave on battle end.
- Store the FULL sim log string in the DB for every battle — this enables replays and the favorite mon stat without extra work.
