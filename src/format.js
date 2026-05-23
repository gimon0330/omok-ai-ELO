export function formatTournament(result) {
  const lines = [];
  lines.push("\n=== Omok AI Elo Ranking ===");
  lines.push(formatTable(
    ["Rank", "Model", "Elo", "W-L-D", "Score%", "Win%", "Avg ms/move", "Illegal"],
    result.ranking.map((row, index) => [
      String(index + 1),
      row.id,
      row.elo.toFixed(1),
      `${row.wins}-${row.losses}-${row.draws}`,
      percent(row.scoreRate),
      percent(row.winRate),
      row.avgMoveMs.toFixed(1),
      String(row.illegalGames)
    ])
  ));

  lines.push("\n=== Pair Results ===");
  lines.push(formatTable(
    ["Pair", "Games", "Result"],
    result.pairStats.map(row => [
      `${row.modelA} vs ${row.modelB}`,
      String(row.games),
      `${row.modelA} ${row.aWins} - ${row.bWins} ${row.modelB}, draw ${row.draws}`
    ])
  ));

  return lines.join("\n");
}

export function toCsv(result) {
  const rows = [["rank", "model", "elo", "games", "wins", "losses", "draws", "score_rate", "win_rate", "avg_move_ms", "illegal_games"]];
  result.ranking.forEach((row, index) => {
    rows.push([
      index + 1,
      row.id,
      row.elo.toFixed(3),
      row.games,
      row.wins,
      row.losses,
      row.draws,
      row.scoreRate.toFixed(6),
      row.winRate.toFixed(6),
      row.avgMoveMs.toFixed(3),
      row.illegalGames
    ]);
  });
  return rows.map(row => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function formatTable(headers, rows) {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, col) => Math.max(...allRows.map(row => String(row[col]).length)));
  const render = row => row.map((cell, col) => String(cell).padEnd(widths[col])).join("  ");
  const separator = widths.map(width => "-".repeat(width)).join("  ");
  return [render(headers), separator, ...rows.map(render)].join("\n");
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function csvEscape(value) {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
