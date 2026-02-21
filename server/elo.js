/**
 * Pure Elo calculation module.
 * K-factor of 32 — keeps things dynamic for a small player pool.
 */

const K = 32;

/**
 * Calculate expected score for player A against player B.
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new ratings after a match.
 * @param {number} winnerRating - Current rating of the winner
 * @param {number} loserRating - Current rating of the loser
 * @returns {{ newWinnerRating: number, newLoserRating: number }}
 */
function calculateElo(winnerRating, loserRating) {
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = expectedScore(loserRating, winnerRating);

  const newWinnerRating = Math.round(winnerRating + K * (1 - expectedWinner));
  const newLoserRating = Math.round(loserRating + K * (0 - expectedLoser));

  return { newWinnerRating, newLoserRating };
}

module.exports = { calculateElo, expectedScore };
