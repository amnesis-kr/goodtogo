// 재귀 백트래킹 미로 생성기
// cells[row][col] = { n, s, e, w } — 각 방향 벽 존재 여부 (true = 벽 있음)

export interface Cell {
  n: boolean; s: boolean; e: boolean; w: boolean;
  visited: boolean;
}

export interface Maze {
  cols: number;
  rows: number;
  cells: Cell[][];
}

export function generateMaze(cols: number, rows: number): Maze {
  const cells: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ n: true, s: true, e: true, w: true, visited: false }))
  );

  function carve(r: number, c: number) {
    cells[r][c].visited = true;
    const dirs = shuffle([
      { dr: -1, dc: 0, wall: 'n', opp: 's' },
      { dr:  1, dc: 0, wall: 's', opp: 'n' },
      { dr:  0, dc: 1, wall: 'e', opp: 'w' },
      { dr:  0, dc:-1, wall: 'w', opp: 'e' },
    ]);
    for (const { dr, dc, wall, opp } of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !cells[nr][nc].visited) {
        (cells[r][c] as unknown as Record<string,boolean>)[wall] = false;
        (cells[nr][nc] as unknown as Record<string,boolean>)[opp] = false;
        carve(nr, nc);
      }
    }
  }

  carve(0, 0);
  return { cols, rows, cells };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
