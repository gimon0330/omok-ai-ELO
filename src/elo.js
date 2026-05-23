export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function updateElo(ratingA, ratingB, scoreA, kFactor) {
  const expectedA = expectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;
  return {
    ratingA: ratingA + kFactor * (scoreA - expectedA),
    ratingB: ratingB + kFactor * ((1 - scoreA) - expectedB)
  };
}
