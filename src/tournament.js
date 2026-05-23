import { performance } from "node:perf_hooks";
import {
  BLACK,
  WHITE,
  boardToText,
  createBoard,
  isFull,
  isLegalMove,
  isWin,
  modelBoardForPlayer,
  otherPlayer,
  placeMove
} from "./gomoku.js";
import { updateElo } from "./elo.js";

export async function playGame(blackModel, whiteModel, options = {}) {
  const board = createBoard();
  const maxPlies = options.maxPlies ?? 225;
  const depth = options.depth ?? 2;
  const moveTimeoutMs = options.moveTimeoutMs ?? 0;
  let currentPlayer = BLACK;
  const modelsByPlayer = {
    [BLACK]: blackModel,
    [WHITE]: whiteModel
  };
  const moves = [];
  const timings = {
    [blackModel.id]: [],
    [whiteModel.id]: []
  };

  for (let ply = 0; ply < maxPlies; ply++) {
    const currentModel = modelsByPlayer[currentPlayer];
    const modelBoard = modelBoardForPlayer(board, currentPlayer);
    const started = performance.now();
    let move;

    try {
      move = await currentModel.findBestMove(modelBoard, { depth });
    } catch (error) {
      return illegalResult({
        winner: otherPlayer(currentPlayer),
        loser: currentPlayer,
        reason: `${currentModel.id} threw: ${error instanceof Error ? error.message : String(error)}`,
        board,
        moves,
        timings
      });
    }

    const elapsed = performance.now() - started;
    timings[currentModel.id].push(elapsed);

    if (moveTimeoutMs > 0 && elapsed > moveTimeoutMs) {
      return illegalResult({
        winner: otherPlayer(currentPlayer),
        loser: currentPlayer,
        reason: `${currentModel.id} exceeded move timeout: ${elapsed.toFixed(1)}ms > ${moveTimeoutMs}ms`,
        board,
        moves,
        timings
      });
    }

    if (!isLegalMove(board, move)) {
      return illegalResult({
        winner: otherPlayer(currentPlayer),
        loser: currentPlayer,
        reason: `${currentModel.id} returned illegal move: ${JSON.stringify(move)}`,
        board,
        moves,
        timings
      });
    }

    placeMove(board, move, currentPlayer);
    moves.push({ ply: ply + 1, player: currentPlayer, model: currentModel.id, r: move.r, c: move.c, ms: elapsed });

    if (isWin(board, move.r, move.c, currentPlayer)) {
      return {
        result: currentPlayer === BLACK ? "black" : "white",
        winner: currentPlayer,
        loser: otherPlayer(currentPlayer),
        reason: "five-in-a-row",
        moves,
        moveCount: moves.length,
        timings,
        finalBoard: boardToText(board)
      };
    }

    if (isFull(board)) {
      return drawResult({ reason: "board-full", board, moves, timings });
    }

    currentPlayer = otherPlayer(currentPlayer);
  }

  return drawResult({ reason: "max-plies", board, moves, timings });
}

function illegalResult({ winner, loser, reason, board, moves, timings }) {
  return {
    result: winner === BLACK ? "black" : "white",
    winner,
    loser,
    reason,
    illegal: true,
    moves,
    moveCount: moves.length,
    timings,
    finalBoard: boardToText(board)
  };
}

function drawResult({ reason, board, moves, timings }) {
  return {
    result: "draw",
    winner: null,
    loser: null,
    reason,
    moves,
    moveCount: moves.length,
    timings,
    finalBoard: boardToText(board)
  };
}

export async function runTournament(models, options = {}) {
  const modelIds = options.modelIds;
  const selected = modelIds.map(id => {
    if (!models[id]) throw new Error(`Model not loaded: ${id}`);
    return models[id];
  });

  const ratings = Object.fromEntries(selected.map(model => [model.id, options.initialElo ?? 1000]));
  const stats = Object.fromEntries(selected.map(model => [model.id, emptyStats()]));
  const pairStats = {};
  const games = [];
  const gamesPerPair = options.gamesPerPair ?? 2;
  const kFactor = options.kFactor ?? 32;
  let gameNumber = 0;

  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      const a = selected[i];
      const b = selected[j];
      pairStats[pairKey(a.id, b.id)] = emptyPairStats(a.id, b.id);

      for (let gameIndex = 0; gameIndex < gamesPerPair; gameIndex++) {
        const aIsBlack = gameIndex % 2 === 0;
        const black = aIsBlack ? a : b;
        const white = aIsBlack ? b : a;
        const result = await playGame(black, white, options);
        gameNumber += 1;

        const winnerId = result.result === "black" ? black.id : result.result === "white" ? white.id : null;
        const scoreA = winnerId === a.id ? 1 : winnerId === b.id ? 0 : 0.5;
        const beforeA = ratings[a.id];
        const beforeB = ratings[b.id];
        const next = updateElo(beforeA, beforeB, scoreA, kFactor);
        ratings[a.id] = next.ratingA;
        ratings[b.id] = next.ratingB;

        updateStats(stats, black.id, result.result === "black", result.result === "white", result.result === "draw", result.illegal, result.timings[black.id]);
        updateStats(stats, white.id, result.result === "white", result.result === "black", result.result === "draw", result.illegal, result.timings[white.id]);
        updatePairStats(pairStats[pairKey(a.id, b.id)], a.id, b.id, winnerId, result.result === "draw");

        games.push({
          game: gameNumber,
          black: black.id,
          white: white.id,
          result: result.result,
          winner: winnerId,
          reason: result.reason,
          moves: result.moveCount,
          eloBefore: { [a.id]: beforeA, [b.id]: beforeB },
          eloAfter: { [a.id]: ratings[a.id], [b.id]: ratings[b.id] },
          illegal: Boolean(result.illegal)
        });

        if (typeof options.onGame === "function") {
          options.onGame(games[games.length - 1], { ratings: { ...ratings } });
        }
      }
    }
  }

  const ranking = selected
    .map(model => ({
      id: model.id,
      label: model.label,
      elo: ratings[model.id],
      ...finalizeStats(stats[model.id])
    }))
    .sort((a, b) => b.elo - a.elo);

  return {
    options: {
      gamesPerPair,
      depth: options.depth ?? 2,
      kFactor,
      initialElo: options.initialElo ?? 1000,
      maxPlies: options.maxPlies ?? 225,
      moveTimeoutMs: options.moveTimeoutMs ?? 0,
      modelIds
    },
    ranking,
    pairStats: Object.values(pairStats),
    games
  };
}

function emptyStats() {
  return { games: 0, wins: 0, losses: 0, draws: 0, illegalGames: 0, totalMoveMs: 0, timedMoves: 0 };
}

function emptyPairStats(modelA, modelB) {
  return { modelA, modelB, games: 0, aWins: 0, bWins: 0, draws: 0 };
}

function pairKey(a, b) {
  return [a, b].sort().join("__");
}

function updateStats(stats, modelId, won, lost, drew, illegal, moveTimes = []) {
  const row = stats[modelId];
  row.games += 1;
  if (won) row.wins += 1;
  if (lost) row.losses += 1;
  if (drew) row.draws += 1;
  if (illegal) row.illegalGames += 1;
  for (const ms of moveTimes) {
    row.totalMoveMs += ms;
    row.timedMoves += 1;
  }
}

function updatePairStats(pair, modelA, modelB, winnerId, drew) {
  pair.games += 1;
  if (drew) pair.draws += 1;
  else if (winnerId === modelA) pair.aWins += 1;
  else if (winnerId === modelB) pair.bWins += 1;
}

function finalizeStats(stats) {
  const decisive = stats.wins + stats.losses;
  return {
    games: stats.games,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    winRate: stats.games ? stats.wins / stats.games : 0,
    scoreRate: stats.games ? (stats.wins + stats.draws * 0.5) / stats.games : 0,
    decisiveWinRate: decisive ? stats.wins / decisive : 0,
    avgMoveMs: stats.timedMoves ? stats.totalMoveMs / stats.timedMoves : 0,
    illegalGames: stats.illegalGames
  };
}
