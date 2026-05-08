'use client';

import { useState } from 'react';
import GameCanvas from './GameCanvas';

export default function GamePage() {
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);

  if (started) return <GameCanvas playerName={name} />;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-10 w-80 text-center shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">ARENA</h1>
        <p className="text-gray-400 text-sm mb-8">3명의 NPC가 싸우는 방에 입장합니다</p>
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
        <p className="text-gray-600 text-xs mt-4">WASD 이동 · 마우스 시점 · 클릭 사격</p>
      </div>
    </div>
  );
}
