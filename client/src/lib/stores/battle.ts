import { writable, get } from 'svelte/store';
import { socket } from './socket';
import { user } from './auth';

export interface BattlePokemon {
  ident: string;
  details: string;
  condition: string;
  active: boolean;
  stats: Record<string, number>;
  moves: { move: string; id: string; pp: number; maxpp: number; target: string; disabled: boolean; type?: string }[];
  ability: string;
  item: string;
  baseAbility: string;
  pokeball: string;
}

export interface BattleRequest {
  active?: {
    moves: { move: string; id: string; pp: number; maxpp: number; target: string; disabled: boolean; type?: string }[];
    canMegaEvo?: boolean;
    canZMove?: any;
    canTerastallize?: string;
    trapped?: boolean;
    maybeTrapped?: boolean;
  }[];
  side: {
    name: string;
    id: string;
    pokemon: BattlePokemon[];
  };
  forceSwitch?: boolean[];
  teamPreview?: boolean;
  wait?: boolean;
}

export interface BattleState {
  battleId: string;
  format: string;
  turn: number;
  p1: { id: string; username: string };
  p2: { id: string; username: string };
  mySide: 'p1' | 'p2';
  request: BattleRequest | null;
  log: string[];
  ended: boolean;
  winner: string | null;
  waiting: boolean;
  teamSubmitted: boolean;
}

export const battleState = writable<BattleState | null>(null);

export function initBattleListeners(): () => void {
  const s = get(socket);
  console.log('[battle] initBattleListeners, socket=', !!s, 'socketId=', s?.id);
  if (!s) return () => {};

  const onBattleStart = (data: { battleId: string; format: string; p1: any; p2: any }) => {
    console.log('[battle] onBattleStart received:', data.battleId, data.format);
    const me = get(user);
    console.log('[battle] me=', me?.id, me?.username);
    const mySide = data.p1.id === me?.id ? 'p1' : 'p2';
    console.log('[battle] mySide=', mySide);
    battleState.set({
      battleId: data.battleId,
      format: data.format,
      turn: 0,
      p1: data.p1,
      p2: data.p2,
      mySide,
      request: null,
      log: [],
      ended: false,
      winner: null,
      waiting: false,
      teamSubmitted: false,
    });
  };

  const onBattleUpdate = (data: { battleId: string; log: string }) => {
    battleState.update((state) => {
      if (!state || state.battleId !== data.battleId) return state;
      const newLines = data.log.split('\n').filter((l: string) => l.length > 0);
      let turn = state.turn;
      for (const line of newLines) {
        if (line.startsWith('|turn|')) {
          turn = parseInt(line.split('|')[2]) || turn;
        }
      }
      return { ...state, log: [...state.log, ...newLines], turn };
    });
  };

  const onBattleRequest = (data: { battleId: string; request: BattleRequest }) => {
    battleState.update((state) => {
      if (!state || state.battleId !== data.battleId) return state;
      const waiting = !!data.request.wait;
      return { ...state, request: data.request, waiting };
    });
  };

  const onBattleEnd = (data: { battleId: string; winner: string; winnerId: string }) => {
    battleState.update((state) => {
      if (!state || state.battleId !== data.battleId) return state;
      return { ...state, ended: true, winner: data.winner, waiting: false };
    });
  };

  const onChoiceError = (data: { battleId: string; message: string }) => {
    battleState.update((state) => {
      if (!state || state.battleId !== data.battleId) return state;
      return { ...state, log: [...state.log, `|error|${data.message}`], waiting: false };
    });
  };

  s.on('battleStart', onBattleStart);
  s.on('battleUpdate', onBattleUpdate);
  s.on('battleRequest', onBattleRequest);
  s.on('battleEnd', onBattleEnd);
  s.on('battleChoiceError', onChoiceError);

  return () => {
    s.off('battleStart', onBattleStart);
    s.off('battleUpdate', onBattleUpdate);
    s.off('battleRequest', onBattleRequest);
    s.off('battleEnd', onBattleEnd);
    s.off('battleChoiceError', onChoiceError);
  };
}

/**
 * Send a move choice. Slot is 1-based. Constructs "move N" string.
 * Optional mega/zmove/tera modifiers.
 */
export function sendMove(battleId: string, slot: number, mega = false, zmove = false, tera?: string) {
  const s = get(socket);
  if (!s) return;
  let choice = `move ${slot}`;
  if (mega) choice += ' mega';
  else if (zmove) choice += ' zmove';
  else if (tera) choice += ' terastallize';
  s.emit('move', { battleId, moveChoice: choice });
  battleState.update((st) => st ? { ...st, waiting: true } : st);
}

/**
 * Send a switch choice. Slot is 1-based. Constructs "switch N" string.
 */
export function sendSwitch(battleId: string, slot: number) {
  const s = get(socket);
  if (!s) return;
  s.emit('switch', { battleId, switchChoice: `switch ${slot}` });
  battleState.update((st) => st ? { ...st, waiting: true } : st);
}

/**
 * Send team order for team preview (in-battle). Order is a string like "213456".
 */
export function sendTeam(battleId: string, order: string) {
  const s = get(socket);
  if (!s) return;
  s.emit('teamOrder', { battleId, order: `team ${order}` });
  battleState.update((st) => st ? { ...st, teamSubmitted: true, waiting: true } : st);
}

/**
 * Submit a team paste for a non-random format (pre-battle).
 */
export function submitTeamPaste(battleId: string, paste: string) {
  const s = get(socket);
  if (!s) return;
  s.emit('team', { battleId, team: paste });
}

export function sendForfeit(battleId: string) {
  const s = get(socket);
  if (s) s.emit('forfeit', { battleId });
}
