'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { generateMaze, Maze } from './maze-gen';
import { supabase } from '@/lib/supabase';
import MiniMap from './MiniMap';
import Joystick from '../game/Joystick';

interface Props { playerName: string; }

const COLS = 20;
const ROWS = 20;
const CELL = 5; // 셀 크기 (m)
const WALL_H = 3;
const WALL_T = 0.3;

function buildMazeScene(scene: THREE.Scene, maze: Maze) {
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8b9dc3 });
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0x333344 });

  const W = maze.cols * CELL;
  const H = maze.rows * CELL;

  // 바닥 / 천장
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.position.set(W / 2, 0, H / 2); scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, H), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(W / 2, WALL_H, H / 2); scene.add(ceil);

  function addWall(x: number, y: number, z: number, w: number, d: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat);
    m.position.set(x, WALL_H / 2, z); m.castShadow = true; scene.add(m);
    // 충돌 프록시 반환
    return { x, z, hw: w / 2, hd: d / 2 };
  }

  const walls: { x: number; z: number; hw: number; hd: number }[] = [];

  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const cell = maze.cells[r][c];
      const cx = c * CELL;
      const cz = r * CELL;

      // 북쪽 벽
      if (cell.n) walls.push(addWall(cx + CELL / 2, 0, cz, CELL + WALL_T, WALL_T));
      // 서쪽 벽
      if (cell.w) walls.push(addWall(cx, 0, cz + CELL / 2, WALL_T, CELL + WALL_T));

      // 마지막 행 남쪽
      if (r === maze.rows - 1 && cell.s)
        walls.push(addWall(cx + CELL / 2, 0, cz + CELL, CELL + WALL_T, WALL_T));
      // 마지막 열 동쪽
      if (c === maze.cols - 1 && cell.e)
        walls.push(addWall(cx + CELL, 0, cz + CELL / 2, WALL_T, CELL + WALL_T));
    }
  }

  return walls;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

export default function MazeGame({ playerName }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const joystickRef = useRef({ x: 0, y: 0 });
  const mobileLookRef = useRef({ dx: 0, dy: 0 });

  const [showMinimap, setShowMinimap] = useState(true);
  const [maze] = useState(() => generateMaze(COLS, ROWS));
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [finalTime, setFinalTime] = useState(0);
  const [rankings, setRankings] = useState<{ name: string; time_sec: number }[]>([]);
  const [locked, setLocked] = useState(false);
  const [isMobile] = useState(() => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
  const [isFullscreen, setIsFullscreen] = useState(false);

  const onJoystickMove = useCallback((x: number, y: number) => {
    joystickRef.current.x = x;
    joystickRef.current.y = y;
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  async function saveAndFetchRankings(timeSec: number) {
    await supabase.from('maze_rankings').insert({ name: playerName, time_sec: timeSec });
    const { data } = await supabase
      .from('maze_rankings')
      .select('name, time_sec')
      .order('time_sec', { ascending: true })
      .limit(10);
    if (data) setRankings(data);
  }

  useEffect(() => {
    const mount = mountRef.current!;
    const keys: Record<string, boolean> = {};

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111122);
    scene.fog = new THREE.Fog(0x111122, 8, 25);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 60);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pt = new THREE.PointLight(0x8888ff, 1.5, 12);
    camera.add(pt); scene.add(camera);

    // 출발점: (0,0) 셀 중앙 / 도착점: (ROWS-1, COLS-1) 셀 중앙
    const startX = CELL / 2;
    const startZ = CELL / 2;
    const goalX = (COLS - 1) * CELL + CELL / 2;
    const goalZ = (ROWS - 1) * CELL + CELL / 2;

    camera.position.set(startX, 1.6, startZ);

    // 도착 표시
    const goalMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 });
    const goalMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 16), goalMat);
    goalMesh.position.set(goalX, 0.05, goalZ); scene.add(goalMesh);

    // 미로 빌드
    const wallProxies = buildMazeScene(scene, maze);

    // 외벽 추가
    const W = COLS * CELL; const H = ROWS * CELL;
    const wallMat2 = new THREE.MeshLambertMaterial({ color: 0x8b9dc3 });
    [
      [W/2, 0, -WALL_T/2, W, WALL_H, WALL_T],
      [W/2, 0, H+WALL_T/2, W, WALL_H, WALL_T],
      [-WALL_T/2, 0, H/2, WALL_T, WALL_H, H],
      [W+WALL_T/2, 0, H/2, WALL_T, WALL_H, H],
    ].forEach(([x,,z,w,,d]) => {
      wallProxies.push({ x, z, hw: w/2, hd: d/2 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat2);
      m.position.set(x, WALL_H/2, z); scene.add(m);
    });

    // Controls
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let isLocked = false;
    let startTime = Date.now();
    let timerInterval: ReturnType<typeof setInterval> | null = null;
    let done = false;

    timerInterval = setInterval(() => {
      if (!done) setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    function checkWall(pos: THREE.Vector3, r = 0.35) {
      for (const w of wallProxies) {
        if (Math.abs(pos.x - w.x) < w.hw + r && Math.abs(pos.z - w.z) < w.hd + r) return true;
      }
      return false;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked) return;
      euler.y -= e.movementX * 0.002;
      euler.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, euler.x - e.movementY * 0.002));
      camera.quaternion.setFromEuler(euler);
    };
    const onPLC = () => {
      isLocked = document.pointerLockElement === renderer.domElement;
      setLocked(isLocked);
    };
    const onMouseDown = () => { if (!isLocked) renderer.domElement.requestPointerLock(); };

    // 모바일 시점
    const lookTouch: { id: number | null; lx: number; ly: number } = { id: null, lx: 0, ly: 0 };
    const onTouchStart = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (document.getElementById('joy-area')?.contains(el)) continue;
        if (lookTouch.id === null) { lookTouch.id = t.identifier; lookTouch.lx = t.clientX; lookTouch.ly = t.clientY; }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookTouch.id) {
          mobileLookRef.current.dx = t.clientX - lookTouch.lx;
          mobileLookRef.current.dy = t.clientY - lookTouch.ly;
          lookTouch.lx = t.clientX; lookTouch.ly = t.clientY;
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookTouch.id) lookTouch.id = null;
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPLC);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: true });

    // Game loop
    const clock = new THREE.Clock();
    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (done) { renderer.render(scene, camera); return; }

      // 모바일 시점
      const { dx, dy } = mobileLookRef.current;
      if (dx || dy) {
        euler.y -= dx * 0.004;
        euler.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, euler.x - dy * 0.004));
        camera.quaternion.setFromEuler(euler);
        mobileLookRef.current = { dx: 0, dy: 0 };
      }

      // 이동
      const jx = joystickRef.current.x;
      const jy = joystickRef.current.y;
      const move = new THREE.Vector3();
      if (keys['KeyW'] || keys['ArrowUp'])    move.z -= 1;
      if (keys['KeyS'] || keys['ArrowDown'])  move.z += 1;
      if (keys['KeyA'] || keys['ArrowLeft'])  move.x -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move.x += 1;
      if (Math.abs(jx) > 0.1) move.x += jx;
      if (Math.abs(jy) > 0.1) move.z += jy;

      if (move.length() > 0) {
        move.normalize().multiplyScalar(4 * dt);
        move.applyEuler(new THREE.Euler(0, euler.y, 0));
        const nx = camera.position.clone(); nx.x += move.x;
        const nz = camera.position.clone(); nz.z += move.z;
        if (!checkWall(nx)) camera.position.x = nx.x;
        if (!checkWall(nz)) camera.position.z = nz.z;
        camera.position.y = 1.6;
      }

      // 골 도착 체크
      const dx2 = camera.position.x - goalX;
      const dz2 = camera.position.z - goalZ;
      if (Math.sqrt(dx2*dx2 + dz2*dz2) < 1.5) {
        done = true;
        if (timerInterval) clearInterval(timerInterval);
        const t = (Date.now() - startTime) / 1000;
        setFinalTime(t);
        setFinished(true);
        saveAndFetchRankings(+t.toFixed(2));
      }

      // 골 표시 회전
      goalMesh.rotation.y += dt;

      renderer.render(scene, camera);
    }

    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      if (timerInterval) clearInterval(timerInterval);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPLC);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      document.exitPointerLock();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [maze]);

  return (
    <div className="relative w-full h-screen bg-black">
      <div ref={mountRef} className="w-full h-full" />

      {/* 미니맵 오버레이 */}
      {showMinimap && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
          <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <h2 className="text-white font-bold text-lg mb-3 text-center">전체 미로 지도</h2>
            <MiniMap maze={maze} cols={COLS} rows={ROWS} />
            <p className="text-gray-400 text-xs text-center mt-3">
              🟢 출발 (좌상단) → 🔴 도착 (우하단)
            </p>
            <button
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition"
              onClick={() => setShowMinimap(false)}
            >
              게임 시작
            </button>
          </div>
        </div>
      )}

      {/* HUD */}
      {!showMinimap && !finished && (
        <>
          {/* 조준선 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-4 h-4">
              <div className="absolute top-1/2 left-0 w-full h-px bg-white opacity-80" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-white opacity-80" />
            </div>
          </div>

          {/* 타이머 */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white font-mono text-2xl font-bold drop-shadow">
            {formatTime(elapsed)}
          </div>

          {/* 전체화면 */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={() => setShowMinimap(true)} className="bg-black/40 hover:bg-black/60 text-white text-xs px-3 py-1 rounded-lg border border-white/20 transition">
              지도
            </button>
            <button onClick={toggleFullscreen} className="bg-black/40 hover:bg-black/60 text-white text-xs px-3 py-1 rounded-lg border border-white/20 transition">
              {isFullscreen ? '창 모드' : '전체화면'}
            </button>
          </div>

          {/* 조작 안내 */}
          {!isMobile && !locked && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white px-6 py-3 rounded-xl text-lg font-semibold animate-pulse mt-40">
                클릭하여 시작
              </div>
            </div>
          )}

          {/* 모바일 조이스틱 */}
          {isMobile && (
            <div id="joy-area" className="absolute bottom-8 left-8" style={{ touchAction: 'none' }}>
              <Joystick onMove={onJoystickMove} />
            </div>
          )}
        </>
      )}

      {/* 완료 화면 */}
      {finished && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white z-20 overflow-y-auto py-8">
          <div className="text-5xl font-black mb-2">🎉 탈출 성공!</div>
          <div className="text-gray-300 mb-1">{playerName}</div>
          <div className="text-3xl font-bold text-yellow-400 mb-6">{formatTime(finalTime)}</div>

          <div className="bg-gray-900 rounded-2xl p-6 w-72 mb-6">
            <h3 className="text-lg font-bold mb-3 text-center">🏆 랭킹 TOP 10</h3>
            {rankings.length === 0 ? (
              <div className="text-gray-400 text-sm text-center">기록 없음</div>
            ) : (
              <ol className="space-y-2">
                {rankings.map((r, i) => (
                  <li key={i} className={`flex justify-between text-sm px-2 py-1 rounded ${r.name === playerName && +r.time_sec.toFixed(2) === +finalTime.toFixed(2) ? 'bg-yellow-900/50 text-yellow-300' : 'text-gray-300'}`}>
                    <span>{i + 1}. {r.name}</span>
                    <span className="font-mono">{formatTime(r.time_sec)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-3 rounded-xl transition"
            onClick={() => window.location.reload()}
          >
            다시 하기
          </button>
        </div>
      )}
    </div>
  );
}
