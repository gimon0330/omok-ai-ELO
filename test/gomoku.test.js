import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, WHITE, createBoard, isWin, modelBoardForPlayer, placeMove } from "../src/gomoku.js";
import { expectedScore, updateElo } from "../src/elo.js";

test("detects five stones in a row", () => {
  const board = createBoard();
  for (let c = 3; c < 8; c++) placeMove(board, { r: 7, c }, BLACK);
  assert.equal(isWin(board, 7, 7, BLACK), true);
});

test("maps black-side board to model perspective", () => {
  const board = createBoard();
  board[7][7] = BLACK;
  board[7][8] = WHITE;
  const mapped = modelBoardForPlayer(board, BLACK);
  assert.equal(mapped[7][7], WHITE);
  assert.equal(mapped[7][8], BLACK);
});

test("updates Elo symmetrically", () => {
  const expected = expectedScore(1000, 1000);
  assert.equal(expected, 0.5);
  const next = updateElo(1000, 1000, 1, 32);
  assert.equal(next.ratingA, 1016);
  assert.equal(next.ratingB, 984);
});
