'use client';

import { useEffect, useRef } from 'react';
import { Maze } from './maze-gen';

interface Props {
  maze: Maze;
  cols: number;
  rows: number;
  playerPos?: { x: number; z: number }; // 월드 좌표
  cellSize?: number; // 월드 셀 크기(m)
}

export default function MiniMap({ maze, cols, rows, playerPos, cellSize = 5 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CELL = 14;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width = cols * CELL + 1;
    canvas.height = rows * CELL + 1;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#6b8cce';
    ctx.lineWidth = 1.5;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = maze.cells[r][c];
        const x = c * CELL;
        const y = r * CELL;

        if (cell.n) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); ctx.stroke(); }
        if (cell.w) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); ctx.stroke(); }
        if (r === rows - 1 && cell.s) { ctx.beginPath(); ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
        if (c === cols - 1 && cell.e) { ctx.beginPath(); ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
      }
    }

    // 출발점
    ctx.fillStyle = '#00ff88';
    ctx.beginPath(); ctx.arc(CELL / 2, CELL / 2, 4, 0, Math.PI * 2); ctx.fill();

    // 도착점
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(cols * CELL - CELL / 2, rows * CELL - CELL / 2, 4, 0, Math.PI * 2); ctx.fill();

    // 플레이어 위치
    if (playerPos) {
      const px = (playerPos.x / cellSize) * CELL;
      const pz = (playerPos.z / cellSize) * CELL;
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath(); ctx.arc(px, pz, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [maze, cols, rows, playerPos, cellSize]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', imageRendering: 'pixelated', borderRadius: 8, border: '1px solid #334' }}
    />
  );
}
