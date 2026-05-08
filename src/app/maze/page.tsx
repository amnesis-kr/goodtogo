'use client';

import { useState } from 'react';
import MazeGame from './MazeGame';

export default function MazePage() {
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);

  if (started) return <MazeGame playerName={name} />;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-10 w-80 text-center shadow-2xl">
        <div className="text-4xl mb-2">🌀</div>
        <h1 className="text-3xl font-bold text-white mb-2">MAZE</h1>
        <p className="text-gray-400 text-sm mb-8">100m 미로를 탈출하세요</p>
        <input
          className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 mb-4 outline-none focus:border-blue-500 transition"
          placeholder="이름을 입력하세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStarted(true)}
          autoFocus
        />
        <button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-40"
          disabled={!name.trim()}
          onClick={() => setStarted(true)}
        >
          입장하기
        </button>
        <p className="text-gray-600 text-xs mt-4">WASD 이동 · 마우스 시점</p>
      </div>
    </div>
  );
}
