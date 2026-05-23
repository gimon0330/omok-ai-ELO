export const SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];

export function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

export function cloneBoard(board) {
  return board.map(row => row.slice());
}

export function inside(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

export function isLegalMove(board, move) {
  return Boolean(
    move &&
    Number.isInteger(move.r) &&
    Number.isInteger(move.c) &&
    inside(move.r, move.c) &&
    board[move.r][move.c] === EMPTY
  );
}

export function placeMove(board, move, player) {
  board[move.r][move.c] = player;
}

export function isFull(board) {
  return board.every(row => row.every(cell => cell !== EMPTY));
}

export function isWin(board, r, c, player) {
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    count += countDirection(board, r, c, dr, dc, player);
    count += countDirection(board, r, c, -dr, -dc, player);
    if (count >= 5) return true;
  }
  return false;
}

function countDirection(board, r, c, dr, dc, player) {
  let count = 0;
  let nr = r + dr;
  let nc = c + dc;

  while (inside(nr, nc) && board[nr][nc] === player) {
    count += 1;
    nr += dr;
    nc += dc;
  }

  return count;
}

export function otherPlayer(player) {
  return player === BLACK ? WHITE : BLACK;
}

export function modelBoardForPlayer(board, player) {
  if (player === WHITE) return cloneBoard(board);

  return board.map(row => row.map(cell => {
    if (cell === BLACK) return WHITE;
    if (cell === WHITE) return BLACK;
    return EMPTY;
  }));
}

export function boardToText(board) {
  return board.map(row => row.map(cell => {
    if (cell === BLACK) return "X";
    if (cell === WHITE) return "O";
    return ".";
  }).join(" ")).join("\n");
}
