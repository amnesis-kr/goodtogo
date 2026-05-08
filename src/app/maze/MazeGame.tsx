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
const CELL = 5;
const WALL_H = 3.5;
const WALL_T = 0.3;
const MAX_MINIMAP = 3;

// --- 벽 그림 (Canvas 2D → Three.js Texture) ---
type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const DRAWINGS: DrawFn[] = [
  // 개구리 구슬치기
  (ctx, w, h) => {
    ctx.fillStyle = '#a8e6cf'; ctx.fillRect(0, 0, w, h);
    // 땅
    ctx.fillStyle = '#7ec850'; ctx.fillRect(0, h*0.7, w, h*0.3);
    // 구슬들
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = ['#ff6b6b','#ffd93d','#6bcbf0','#ff9ff3','#54a0ff'][i];
      ctx.beginPath(); ctx.arc(w*0.2+i*w*0.14, h*0.72, w*0.05, 0, Math.PI*2); ctx.fill();
    }
    // 개구리
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.ellipse(w*0.5, h*0.55, w*0.12, h*0.1, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#27ae60';
    ctx.beginPath(); ctx.arc(w*0.44, h*0.47, w*0.06, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.56, h*0.47, w*0.06, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w*0.44, h*0.46, w*0.03, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w*0.56, h*0.46, w*0.03, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(w*0.44, h*0.46, w*0.015, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(w*0.56, h*0.46, w*0.015, 0, Math.PI*2); ctx.fill();
    // 팔
    ctx.strokeStyle = '#27ae60'; ctx.lineWidth = w*0.03;
    ctx.beginPath(); ctx.moveTo(w*0.38, h*0.56); ctx.lineTo(w*0.28, h*0.65); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.62, h*0.56); ctx.lineTo(w*0.72, h*0.62); ctx.stroke();
    // 제목
    ctx.fillStyle = '#1a5276'; ctx.font = `bold ${w*0.09}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('구슬치기', w*0.5, h*0.92);
  },

  // 다람쥐 윷놀이
  (ctx, w, h) => {
    ctx.fillStyle = '#ffeaa7'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b8860b'; ctx.fillRect(0, h*0.75, w, h*0.25);
    // 윷 4개
    const yutColors = ['#8B4513','#8B4513','#8B4513','#8B4513'];
    [[0.3,0.5,-0.3],[0.45,0.45,0.1],[0.6,0.5,-0.2],[0.75,0.43,0.4]].forEach(([x,y,a],i) => {
      ctx.save(); ctx.translate(w*x, h*y); ctx.rotate(a);
      ctx.fillStyle = yutColors[i];
      ctx.fillRect(-w*0.04, -h*0.1, w*0.08, h*0.2); ctx.restore();
    });
    // 다람쥐
    ctx.fillStyle = '#cd853f';
    ctx.beginPath(); ctx.ellipse(w*0.25, h*0.55, w*0.1, h*0.12, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.25, h*0.42, w*0.08, 0, Math.PI*2); ctx.fill();
    // 꼬리
    ctx.strokeStyle = '#cd853f'; ctx.lineWidth = w*0.05;
    ctx.beginPath(); ctx.moveTo(w*0.15, h*0.6); ctx.quadraticCurveTo(w*0.05, h*0.4, w*0.18, h*0.35); ctx.stroke();
    // 눈
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(w*0.28, h*0.41, w*0.015, 0, Math.PI*2); ctx.fill();
    // 귀
    ctx.fillStyle = '#cd853f';
    ctx.beginPath(); ctx.moveTo(w*0.2, h*0.36); ctx.lineTo(w*0.17, h*0.28); ctx.lineTo(w*0.25, h*0.33); ctx.fill();
    ctx.fillStyle = '#2c3e50'; ctx.font = `bold ${w*0.09}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('윷놀이', w*0.65, h*0.92);
  },

  // 말 연날리기
  (ctx, w, h) => {
    ctx.fillStyle = '#87ceeb'; ctx.fillRect(0, 0, w, h*0.7);
    ctx.fillStyle = '#7ec850'; ctx.fillRect(0, h*0.7, w, h*0.3);
    // 구름
    ctx.fillStyle = '#fff';
    [[0.2,0.15],[0.6,0.1],[0.8,0.2]].forEach(([cx,cy]) => {
      ctx.beginPath(); ctx.arc(w*cx, h*cy, w*0.08, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(w*(cx+0.06), h*cy, w*0.06, 0, Math.PI*2); ctx.fill();
    });
    // 연
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.moveTo(w*0.6, h*0.1); ctx.lineTo(w*0.72, h*0.22); ctx.lineTo(w*0.6, h*0.34); ctx.lineTo(w*0.48, h*0.22); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w*0.6, h*0.1); ctx.lineTo(w*0.6, h*0.34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.48, h*0.22); ctx.lineTo(w*0.72, h*0.22); ctx.stroke();
    // 실
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w*0.6, h*0.34); ctx.quadraticCurveTo(w*0.45, h*0.55, w*0.3, h*0.7); ctx.stroke();
    // 말
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.ellipse(w*0.28, h*0.78, w*0.1, h*0.07, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.38, h*0.73, w*0.06, 0, Math.PI*2); ctx.fill();
    // 말 다리
    ctx.strokeStyle = '#8B4513'; ctx.lineWidth = w*0.03;
    [[0.2,0.9],[0.26,0.9],[0.32,0.9],[0.36,0.9]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.moveTo(w*x, h*0.82); ctx.lineTo(w*x, h*y); ctx.stroke();
    });
    // 갈기
    ctx.fillStyle = '#5d3a1a';
    ctx.beginPath(); ctx.moveTo(w*0.34, h*0.68); ctx.quadraticCurveTo(w*0.4, h*0.65, w*0.42, h*0.7); ctx.fill();
    ctx.fillStyle = '#1a5276'; ctx.font = `bold ${w*0.09}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('연날리기', w*0.5, h*0.96);
  },

  // 개구리 팽이치기
  (ctx, w, h) => {
    ctx.fillStyle = '#d5f5e3'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7ec850'; ctx.fillRect(0, h*0.75, w, h*0.25);
    // 팽이
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.moveTo(w*0.5, h*0.72); ctx.lineTo(w*0.35, h*0.5); ctx.lineTo(w*0.65, h*0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.ellipse(w*0.5, h*0.5, w*0.15, h*0.05, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(w*0.5, h*0.72, w*0.02, 0, Math.PI*2); ctx.fill();
    // 채찍
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = w*0.025;
    ctx.beginPath(); ctx.moveTo(w*0.2, h*0.4); ctx.lineTo(w*0.42, h*0.58); ctx.stroke();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w*0.42, h*0.58); ctx.quadraticCurveTo(w*0.5, h*0.52, w*0.5, h*0.5); ctx.stroke();
    // 개구리
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.ellipse(w*0.22, h*0.52, w*0.1, h*0.08, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.15, h*0.44, w*0.06, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w*0.13, h*0.43, w*0.025, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(w*0.13, h*0.43, w*0.012, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#27ae60'; ctx.font = `bold ${w*0.09}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('팽이치기', w*0.65, h*0.92);
  },

  // 다람쥐·말 제기차기
  (ctx, w, h) => {
    ctx.fillStyle = '#fdf6e3'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7ec850'; ctx.fillRect(0, h*0.8, w, h*0.2);
    // 제기
    ctx.fillStyle = '#e67e22';
    ctx.beginPath(); ctx.ellipse(w*0.55, h*0.45, w*0.06, h*0.08, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(w*0.55, h*0.37);
      ctx.lineTo(w*0.55 + Math.cos(i*Math.PI/3)*w*0.08, h*0.37 + Math.sin(i*Math.PI/3)*h*0.06);
      ctx.lineTo(w*0.55 + Math.cos((i+1)*Math.PI/3)*w*0.06, h*0.37 + Math.sin((i+1)*Math.PI/3)*h*0.05);
      ctx.fill();
    }
    // 말
    ctx.fillStyle = '#a0522d';
    ctx.beginPath(); ctx.ellipse(w*0.35, h*0.68, w*0.09, h*0.06, 0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.44, h*0.63, w*0.055, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#a0522d'; ctx.lineWidth = w*0.025;
    [[0.27,0.82],[0.32,0.82],[0.38,0.82],[0.43,0.82]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.moveTo(w*x, h*0.72); ctx.lineTo(w*x, h*y); ctx.stroke();
    });
    // 다람쥐
    ctx.fillStyle = '#cd853f';
    ctx.beginPath(); ctx.ellipse(w*0.72, h*0.68, w*0.08, h*0.06, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.65, h*0.62, w*0.06, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#cd853f'; ctx.lineWidth = w*0.04;
    ctx.beginPath(); ctx.moveTo(w*0.78, h*0.7); ctx.quadraticCurveTo(w*0.86, h*0.55, w*0.76, h*0.5); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(w*0.63, h*0.61, w*0.012, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2c3e50'; ctx.font = `bold ${w*0.09}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('제기차기', w*0.5, h*0.97);
  },
];

function makeWallTexture(idx: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  DRAWINGS[idx % DRAWINGS.length](ctx, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function buildMazeScene(scene: THREE.Scene, maze: Maze) {
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xd4c5a9 });
  const wallBaseMat = new THREE.MeshLambertMaterial({ color: 0xf5f0e8 });
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });

  const W = maze.cols * CELL;
  const H = maze.rows * CELL;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.position.set(W/2, 0, H/2); scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, H), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(W/2, WALL_H, H/2); scene.add(ceil);

  const walls: { x: number; z: number; hw: number; hd: number }[] = [];
  let picIdx = 0;

  function addWall(x: number, z: number, w: number, d: number) {
    // 그림 붙일 면인지 (넓은 면)
    const hasPic = Math.random() < 0.35;
    let mat: THREE.Material;
    if (hasPic) {
      const tex = makeWallTexture(picIdx++);
      mat = new THREE.MeshLambertMaterial({ map: tex });
    } else {
      mat = wallBaseMat;
    }
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), mat);
    m.position.set(x, WALL_H/2, z); m.castShadow = true; scene.add(m);
    return { x, z, hw: w/2, hd: d/2 };
  }

  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const cell = maze.cells[r][c];
      const cx = c * CELL; const cz = r * CELL;
      if (cell.n) walls.push(addWall(cx+CELL/2, cz, CELL+WALL_T, WALL_T));
      if (cell.w) walls.push(addWall(cx, cz+CELL/2, WALL_T, CELL+WALL_T));
      if (r===maze.rows-1 && cell.s) walls.push(addWall(cx+CELL/2, cz+CELL, CELL+WALL_T, WALL_T));
      if (c===maze.cols-1 && cell.e) walls.push(addWall(cx+CELL, cz+CELL/2, WALL_T, CELL+WALL_T));
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
  const playerPosRef = useRef({ x: CELL/2, z: CELL/2 });

  const [showMinimap, setShowMinimap] = useState(true);
  const [minimapCount, setMinimapCount] = useState(MAX_MINIMAP);
  const [maze] = useState(() => generateMaze(COLS, ROWS));
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [finalTime, setFinalTime] = useState(0);
  const [rankings, setRankings] = useState<{ name: string; time_sec: number }[]>([]);
  const [locked, setLocked] = useState(false);
  const [playerPos, setPlayerPos] = useState({ x: CELL/2, z: CELL/2 });
  const [isMobile] = useState(() => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
  const [isFullscreen, setIsFullscreen] = useState(false);

  const onJoystickMove = useCallback((x: number, y: number) => {
    joystickRef.current.x = x;
    joystickRef.current.y = y;
  }, []);

  function openMinimap() {
    if (minimapCount <= 0) return;
    setPlayerPos({ ...playerPosRef.current });
    setMinimapCount(c => c - 1);
    setShowMinimap(true);
  }

  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      // 모바일 webkit 지원
      if (el.requestFullscreen) el.requestFullscreen();
      else if ((el as unknown as {webkitRequestFullscreen:()=>void}).webkitRequestFullscreen)
        (el as unknown as {webkitRequestFullscreen:()=>void}).webkitRequestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as unknown as {webkitExitFullscreen:()=>void}).webkitExitFullscreen)
        (document as unknown as {webkitExitFullscreen:()=>void}).webkitExitFullscreen();
      setIsFullscreen(false);
    }
  }

  async function saveAndFetchRankings(timeSec: number) {
    await supabase.from('maze_rankings').insert({ name: playerName, time_sec: timeSec });
    const { data } = await supabase.from('maze_rankings').select('name, time_sec').order('time_sec', { ascending: true }).limit(10);
    if (data) setRankings(data);
  }

  useEffect(() => {
    const mount = mountRef.current!;
    const keys: Record<string, boolean> = {};

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfff8f0);
    scene.fog = new THREE.FogExp2(0xfff8f0, 0.045);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth/mount.clientHeight, 0.1, 60);

    // 밝은 조명
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const dirLight = new THREE.DirectionalLight(0xfffbe0, 1.2);
    dirLight.position.set(5, 10, 5); scene.add(dirLight);
    const ptLight = new THREE.PointLight(0xffffee, 1.2, 10);
    camera.add(ptLight); scene.add(camera);

    const startX = CELL/2, startZ = CELL/2;
    const goalX = (COLS-1)*CELL+CELL/2, goalZ = (ROWS-1)*CELL+CELL/2;
    camera.position.set(startX, 1.6, startZ);
    playerPosRef.current = { x: startX, z: startZ };

    // 도착 표시
    const goalMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.7 });
    const goalMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 24), goalMat);
    goalMesh.position.set(goalX, 0.05, goalZ); scene.add(goalMesh);
    // 도착 기둥 빛
    const goalLight = new THREE.PointLight(0x00ff88, 2, 6);
    goalLight.position.set(goalX, 1, goalZ); scene.add(goalLight);

    const wallProxies = buildMazeScene(scene, maze);

    // 외벽
    const W = COLS*CELL, HH = ROWS*CELL;
    const wallMat2 = new THREE.MeshLambertMaterial({ color: 0xf5f0e8 });
    [[W/2,0,-WALL_T/2,W,WALL_H,WALL_T],[W/2,0,HH+WALL_T/2,W,WALL_H,WALL_T],
     [-WALL_T/2,0,HH/2,WALL_T,WALL_H,HH],[W+WALL_T/2,0,HH/2,WALL_T,WALL_H,HH]]
    .forEach(([x,,z,w,,d]) => {
      wallProxies.push({ x, z, hw: w/2, hd: d/2 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat2);
      m.position.set(x, WALL_H/2, z); scene.add(m);
    });

    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let isLocked = false;
    const startTime = Date.now();
    let done = false;

    const timerInterval = setInterval(() => {
      if (!done) setElapsed(Math.floor((Date.now()-startTime)/1000));
    }, 500);

    function checkWall(pos: THREE.Vector3, r = 0.38) {
      for (const w of wallProxies) {
        if (Math.abs(pos.x-w.x) < w.hw+r && Math.abs(pos.z-w.z) < w.hd+r) return true;
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
      euler.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, euler.x - e.movementY*0.002));
      camera.quaternion.setFromEuler(euler);
    };
    const onPLC = () => { isLocked = document.pointerLockElement === renderer.domElement; setLocked(isLocked); };
    const onMouseDown = () => { if (!isLocked) renderer.domElement.requestPointerLock(); };

    const lookTouch: { id: number|null; lx: number; ly: number } = { id: null, lx: 0, ly: 0 };
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
      for (const t of Array.from(e.changedTouches)) { if (t.identifier === lookTouch.id) lookTouch.id = null; }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPLC);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: true });

    const clock = new THREE.Clock();
    let animId: number;
    let posUpdateTimer = 0;

    function animate() {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (done) { renderer.render(scene, camera); return; }

      const { dx, dy } = mobileLookRef.current;
      if (dx || dy) {
        euler.y -= dx * 0.004;
        euler.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, euler.x - dy*0.004));
        camera.quaternion.setFromEuler(euler);
        mobileLookRef.current = { dx: 0, dy: 0 };
      }

      const jx = joystickRef.current.x, jy = joystickRef.current.y;
      const move = new THREE.Vector3();
      if (keys['KeyW']||keys['ArrowUp'])    move.z -= 1;
      if (keys['KeyS']||keys['ArrowDown'])  move.z += 1;
      if (keys['KeyA']||keys['ArrowLeft'])  move.x -= 1;
      if (keys['KeyD']||keys['ArrowRight']) move.x += 1;
      if (Math.abs(jx) > 0.1) move.x += jx;
      if (Math.abs(jy) > 0.1) move.z += jy;

      if (move.length() > 0) {
        move.normalize().multiplyScalar(4*dt);
        move.applyEuler(new THREE.Euler(0, euler.y, 0));
        const nx = camera.position.clone(); nx.x += move.x;
        const nz = camera.position.clone(); nz.z += move.z;
        if (!checkWall(nx)) camera.position.x = nx.x;
        if (!checkWall(nz)) camera.position.z = nz.z;
        camera.position.y = 1.6;
      }

      // 플레이어 위치 ref 업데이트 (0.1초마다)
      posUpdateTimer += dt;
      if (posUpdateTimer > 0.1) {
        posUpdateTimer = 0;
        playerPosRef.current = { x: camera.position.x, z: camera.position.z };
      }

      const d2 = Math.hypot(camera.position.x-goalX, camera.position.z-goalZ);
      if (d2 < 1.5) {
        done = true;
        clearInterval(timerInterval);
        const t = (Date.now()-startTime)/1000;
        setFinalTime(t);
        setFinished(true);
        saveAndFetchRankings(+t.toFixed(2));
      }

      goalMesh.rotation.y += dt * 1.5;
      goalLight.intensity = 1.5 + Math.sin(Date.now()*0.003) * 0.5;

      renderer.render(scene, camera);
    }

    animate();

    const onResize = () => {
      camera.aspect = mount.clientWidth/mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(timerInterval);
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
    <div className="relative w-full h-screen bg-amber-50">
      <div ref={mountRef} className="w-full h-full" />

      {/* 미니맵 오버레이 */}
      {showMinimap && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
          <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <h2 className="text-white font-bold text-lg mb-3 text-center">🗺️ 전체 미로 지도</h2>
            <MiniMap maze={maze} cols={COLS} rows={ROWS} playerPos={playerPos} cellSize={CELL} />
            <p className="text-gray-400 text-xs text-center mt-2">
              🟢 출발 &nbsp;·&nbsp; 🔴 도착 &nbsp;·&nbsp; 🟡 현재위치
            </p>
            <button
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition"
              onClick={() => setShowMinimap(false)}
            >
              {minimapCount === MAX_MINIMAP ? '게임 시작' : '닫기'}
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
              <div className="absolute top-1/2 left-0 w-full h-px bg-gray-800 opacity-60" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-gray-800 opacity-60" />
            </div>
          </div>

          {/* 타이머 */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 text-white font-mono text-xl font-bold px-4 py-1 rounded-xl drop-shadow">
            {formatTime(elapsed)}
          </div>

          {/* 우상단 버튼 */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={openMinimap}
              disabled={minimapCount <= 0}
              className="bg-black/40 hover:bg-black/60 text-white text-xs px-3 py-1 rounded-lg border border-white/20 transition disabled:opacity-30"
            >
              🗺️ 지도 ({minimapCount})
            </button>
            <button
              onClick={toggleFullscreen}
              className="bg-black/40 hover:bg-black/60 text-white text-xs px-3 py-1 rounded-lg border border-white/20 transition"
            >
              {isFullscreen ? '창 모드' : '전체화면'}
            </button>
          </div>

          {/* 클릭 유도 */}
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
                  <li key={i} className={`flex justify-between text-sm px-2 py-1 rounded ${r.name===playerName && +r.time_sec.toFixed(2)===+finalTime.toFixed(2) ? 'bg-yellow-900/50 text-yellow-300' : 'text-gray-300'}`}>
                    <span>{i+1}. {r.name}</span>
                    <span className="font-mono">{formatTime(r.time_sec)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-3 rounded-xl transition" onClick={() => window.location.reload()}>
            다시 하기
          </button>
        </div>
      )}
    </div>
  );
}
