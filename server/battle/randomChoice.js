/**
 * Robust random choice helper — mirrors @pkmn/sim RandomPlayerAI logic.
 * Used by tests and could be used server-side for AI opponents.
 *
 * Key difference from naive approach: move slot numbers are 1-based indices
 * into the ORIGINAL moves array, NOT into a filtered sub-array.
 */

function makeRandomChoice(request) {
  if (request.wait) return null; // no action needed

  if (request.forceSwitch) {
    return handleForceSwitch(request);
  } else if (request.teamPreview) {
    return 'default';
  } else if (request.active) {
    return handleMoveRequest(request);
  }
  return 'default';
}

function handleForceSwitch(request) {
  const pokemon = request.side.pokemon;
  const chosen = [];

  // forceSwitch is an array (one per active slot, relevant for doubles)
  const choices = request.forceSwitch.map((mustSwitch, i) => {
    if (!mustSwitch) return 'pass';

    // Find valid switch targets
    const canSwitch = [];
    for (let j = 1; j <= 6; j++) {
      if (!pokemon[j - 1]) continue;                           // no pokemon in slot
      if (j <= request.forceSwitch.length && !pokemon[i].reviving) continue; // currently active
      if (chosen.includes(j)) continue;                         // already chosen for another slot
      // Normal: pick alive (not fainted) pokemon
      // Revival Blessing: pick fainted pokemon to revive
      const isFainted = pokemon[j - 1].condition.endsWith(' fnt');
      const wantFainted = !!pokemon[i].reviving;
      if (isFainted !== wantFainted) continue;
      canSwitch.push(j);
    }

    if (canSwitch.length === 0) return 'pass';

    const target = canSwitch[Math.floor(Math.random() * canSwitch.length)];
    chosen.push(target);
    return `switch ${target}`;
  });

  return choices.join(', ');
}

function handleMoveRequest(request) {
  const pokemon = request.side.pokemon;
  const chosen = [];

  // active is an array (one per active slot, for doubles support)
  const choices = request.active.map((active, i) => {
    // Dead or commanding pokemon pass
    if (pokemon[i].condition.endsWith(' fnt') || pokemon[i].commanding) {
      return 'pass';
    }

    // Build valid move list with correct slot numbers
    const possibleMoves = active.moves;
    const canMove = [];
    for (let j = 0; j < possibleMoves.length; j++) {
      if (!possibleMoves[j].disabled) {
        canMove.push({
          slot: j + 1,  // 1-based slot in original array
          move: possibleMoves[j].move,
          target: possibleMoves[j].target,
        });
      }
    }

    // Build valid switch list
    const canSwitch = [];
    if (!active.trapped) {
      for (let j = 1; j <= 6; j++) {
        if (!pokemon[j - 1]) continue;
        if (pokemon[j - 1].active) continue;
        if (chosen.includes(j)) continue;
        if (pokemon[j - 1].condition.endsWith(' fnt')) continue;
        canSwitch.push(j);
      }
    }

    if (canMove.length > 0) {
      const pick = canMove[Math.floor(Math.random() * canMove.length)];
      let choice = `move ${pick.slot}`;
      // Add targeting for doubles
      if (request.active.length > 1) {
        if (['normal', 'any', 'adjacentFoe'].includes(pick.target)) {
          choice += ` ${1 + Math.floor(Math.random() * 2)}`;
        } else if (pick.target === 'adjacentAlly') {
          choice += ` -${(i ^ 1) + 1}`;
        } else if (pick.target === 'adjacentAllyOrSelf') {
          choice += ` -${i + 1}`;
        }
      }
      // Randomly terastallize (~10% chance if available)
      if (active.canTerastallize && Math.random() < 0.1) {
        choice += ' terastallize';
      }
      return choice;
    } else if (canSwitch.length > 0) {
      // All moves disabled, must switch
      const target = canSwitch[Math.floor(Math.random() * canSwitch.length)];
      chosen.push(target);
      return `switch ${target}`;
    } else {
      // Struggle — sim handles this
      return 'move 1';
    }
  });

  return choices.join(', ');
}

module.exports = { makeRandomChoice };
