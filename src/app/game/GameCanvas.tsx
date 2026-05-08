'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Joystick from './Joystick';

interface Props { playerName: string; }

const ROOM = 50;
const BULLET_SPEED = 28;
const NPC_SPEED = 2.5;
const NPC_SHOOT_INTERVAL = 2000;
const SPAWN_OFFSET = ROOM / 2 - 3;

interface NPC { group: THREE.Group; hp: number; shootTimer: number; }
interface Bullet { mesh: THREE.Mesh; vel: THREE.Vector3; owner: 'player' | number; life: number; }

function makeHuman(color: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf5cba7 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x222222 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.25), mat);
  body.position.set(0, 0.95, 0); group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin);
  head.position.set(0, 1.45, 0); group.add(head);
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.15), mat);
  lArm.position.set(-0.35, 0.9, 0); group.add(lArm);
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.15), mat);
  rArm.position.set(0.35, 0.9, 0); group.add(rArm);
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), mat);
  lLeg.position.set(-0.15, 0.3, 0); group.add(lLeg);
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), mat);
  rLeg.position.set(0.15, 0.3, 0); group.add(rLeg);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.35), dark);
  gun.position.set(0.5, 0.95, -0.2); group.add(gun);

  group.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return group;
}

function addShield(scene: THREE.Scene, obstacles: THREE.Mesh[], pos: THREE.Vector3, ry: number) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const H = 2.2;

  const back = new THREE.Mesh(new THREE.BoxGeometry(4, H, 0.4), mat);
  back.position.set(pos.x, H / 2, pos.z);
  back.rotation.y = ry; back.castShadow = true;
  scene.add(back); obstacles.push(back);

  [[-1, 1], [1, 1]].forEach(([sx]) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, H, 2.5), mat);
    const off = new THREE.Vector3(sx * 2, 0, 1.2).applyEuler(new THREE.Euler(0, ry, 0));
    side.position.set(pos.x + off.x, H / 2, pos.z + off.z);
    side.rotation.y = ry; side.castShadow = true;
    scene.add(side); obstacles.push(side);
  });
}

export default function GameCanvas({ playerName }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'playing' | 'dead' | 'win'>('playing');
  const [hp, setHp] = useState(100);
  const [kills, setKills] = useState(0);
  const [locked, setLocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }
  const stateRef = useRef({ hp: 100, kills: 0, status: 'playing' as 'playing' | 'dead' | 'win' });

  // 조이스틱/모바일 시점 입력을 게임 루프와 공유
  const joystickRef = useRef({ x: 0, y: 0 });
  const mobileLookRef = useRef({ dx: 0, dy: 0 });
  const shootRef = useRef(false);

  const onJoystickMove = useCallback((x: number, y: number) => {
    joystickRef.current.x = x;
    joystickRef.current.y = y;
  }, []);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    const mount = mountRef.current!;
    const keys: Record<string, boolean> = {};

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 15, 50);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 100);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(15, 30, 15); sun.castShadow = true; scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.6));

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), new THREE.MeshLambertMaterial({ color: 0x7ec850 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    // Outer walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xc8a97e });
    const WH = 5;
    ([
      [0, WH/2, -ROOM/2, ROOM, WH, 0.5],
      [0, WH/2,  ROOM/2, ROOM, WH, 0.5],
      [-ROOM/2, WH/2, 0, 0.5, WH, ROOM],
      [ ROOM/2, WH/2, 0, 0.5, WH, ROOM],
    ] as number[][]).forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
      m.position.set(x,y,z); m.castShadow = true; scene.add(m);
    });

    // Obstacles
    const obstacles: THREE.Mesh[] = [];
    const obsMats = [
      new THREE.MeshLambertMaterial({ color: 0x8b7355 }),
      new THREE.MeshLambertMaterial({ color: 0x708090 }),
      new THREE.MeshLambertMaterial({ color: 0xa0522d }),
    ];
    for (let i = 0; i < 16; i++) {
      const mat = obsMats[i % 3];
      const isCyl = Math.random() > 0.5;
      const h = 1.5 + Math.random() * 2.5;
      const geo = isCyl
        ? new THREE.CylinderGeometry(0.5 + Math.random()*0.5, 0.5 + Math.random()*0.5, h, 12)
        : new THREE.BoxGeometry(1 + Math.random()*2, h, 1 + Math.random()*2);
      const m = new THREE.Mesh(geo, mat);
      const px = (Math.random()-0.5)*(ROOM-12);
      const pz = (Math.random()-0.5)*(ROOM-12);
      m.position.set(px, h/2, pz); m.castShadow = true; scene.add(m);
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(isCyl ? 1.4 : 1+Math.random()*2, 0.1, isCyl ? 1.4 : 1+Math.random()*2));
      proxy.position.copy(m.position); proxy.visible = false;
      obstacles.push(proxy);
    }

    // Spawn points & shields
    const spawnPoints = [
      new THREE.Vector3(0, 0,  SPAWN_OFFSET),  // 플레이어: 남
      new THREE.Vector3(0, 0, -SPAWN_OFFSET),  // NPC0: 북
      new THREE.Vector3( SPAWN_OFFSET, 0, 0),  // NPC1: 동
      new THREE.Vector3(-SPAWN_OFFSET, 0, 0),  // NPC2: 서
    ];
    const shieldAngles = [0, Math.PI, -Math.PI/2, Math.PI/2];
    spawnPoints.forEach((sp, i) => addShield(scene, obstacles, sp, shieldAngles[i]));

    // Player start
    camera.position.set(spawnPoints[0].x, 1.7, spawnPoints[0].z);

    // HUD gun
    const gunGroup = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.1,0.4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.28,8), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barrel.rotation.x = Math.PI/2; barrel.position.set(0,0.01,-0.34);
    gunGroup.add(gunBody, barrel);
    gunGroup.position.set(0.25,-0.25,-0.5);
    camera.add(gunGroup); scene.add(camera);

    // NPCs
    const npcColors = [0x3498db, 0xe74c3c, 0x9b59b6];
    const npcs: NPC[] = npcColors.map((color, i) => {
      const group = makeHuman(color);
      group.position.set(spawnPoints[i+1].x, 0, spawnPoints[i+1].z);
      scene.add(group);
      return { group, hp: 100, shootTimer: i * 700 };
    });

    // Bullets
    const bullets: Bullet[] = [];
    const playerBulletMat = new THREE.MeshBasicMaterial({ color: 0x00eeff });
    const npcBulletMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });

    function spawnBullet(pos: THREE.Vector3, dir: THREE.Vector3, owner: 'player' | number) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07,6,6), owner === 'player' ? playerBulletMat : npcBulletMat);
      mesh.position.copy(pos); scene.add(mesh);
      bullets.push({ mesh, vel: dir.clone().multiplyScalar(BULLET_SPEED), owner, life: 2.5 });
    }

    function doShoot() {
      if (stateRef.current.status !== 'playing') return;
      const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
      spawnBullet(camera.position.clone().add(dir.clone().multiplyScalar(0.6)), dir, 'player');
      gunGroup.position.z = -0.42;
      setTimeout(() => { gunGroup.position.z = -0.5; }, 80);
    }

    // Controls
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.y = Math.PI; // 북쪽 바라보기
    camera.quaternion.setFromEuler(euler);

    let playerHp = 100;
    let playerKills = 0;
    let isLocked = false;

    // 키보드
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };

    // 마우스
    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked) return;
      euler.y -= e.movementX * 0.002;
      euler.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, euler.x - e.movementY * 0.002));
      camera.quaternion.setFromEuler(euler);
    };
    const onPointerLockChange = () => {
      isLocked = document.pointerLockElement === renderer.domElement;
      setLocked(isLocked);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!isLocked) { renderer.domElement.requestPointerLock(); return; }
      if (e.button === 0) doShoot();
    };

    // 모바일 시점 (우측 터치)
    const lookTouchRef: { id: number | null; lx: number; ly: number } = { id: null, lx: 0, ly: 0 };
    const onTouchStartLook = (e: TouchEvent) => {
      const joystickEl = document.getElementById('joystick-area');
      const fireEl = document.getElementById('fire-btn');
      for (const t of Array.from(e.changedTouches)) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (joystickEl?.contains(el) || fireEl?.contains(el)) continue;
        if (lookTouchRef.id === null) {
          lookTouchRef.id = t.identifier;
          lookTouchRef.lx = t.clientX;
          lookTouchRef.ly = t.clientY;
        }
      }
    };
    const onTouchMoveLook = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookTouchRef.id) {
          mobileLookRef.current.dx = t.clientX - lookTouchRef.lx;
          mobileLookRef.current.dy = t.clientY - lookTouchRef.ly;
          lookTouchRef.lx = t.clientX;
          lookTouchRef.ly = t.clientY;
        }
      }
    };
    const onTouchEndLook = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === lookTouchRef.id) { lookTouchRef.id = null; }
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('touchstart', onTouchStartLook, { passive: true });
    renderer.domElement.addEventListener('touchmove', onTouchMoveLook, { passive: true });
    renderer.domElement.addEventListener('touchend', onTouchEndLook, { passive: true });

    // Helpers
    function checkObs(pos: THREE.Vector3, radius: number) {
      for (const obs of obstacles) {
        const dx = Math.abs(pos.x - obs.position.x);
        const dz = Math.abs(pos.z - obs.position.z);
        const geo = obs.geometry as THREE.BoxGeometry;
        const hw = ((geo.parameters?.width) ?? 1.5) / 2 + radius;
        const hd = ((geo.parameters?.depth) ?? 1.5) / 2 + radius;
        if (dx < hw && dz < hd) return true;
      }
      return false;
    }
    function clampRoom(pos: THREE.Vector3, margin: number) {
      const half = ROOM/2 - margin;
      pos.x = Math.max(-half, Math.min(half, pos.x));
      pos.z = Math.max(-half, Math.min(half, pos.z));
    }

    // Game loop
    const clock = new THREE.Clock();
    let animId: number;
    let walkTime = 0;
    let shootCooldown = 0;

    function animate() {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (stateRef.current.status !== 'playing') { renderer.render(scene, camera); return; }

      walkTime += dt;
      shootCooldown = Math.max(0, shootCooldown - dt);

      // 모바일 시점
      const { dx, dy } = mobileLookRef.current;
      if (dx !== 0 || dy !== 0) {
        euler.y -= dx * 0.004;
        euler.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, euler.x - dy * 0.004));
        camera.quaternion.setFromEuler(euler);
        mobileLookRef.current = { dx: 0, dy: 0 };
      }

      // 모바일 발사
      if (shootRef.current && shootCooldown <= 0) {
        doShoot(); shootCooldown = 0.25;
      }

      // Player move (키보드 + 조이스틱)
      const jx = joystickRef.current.x;
      const jy = joystickRef.current.y;
      const moveDir = new THREE.Vector3();
      if (keys['KeyW'] || keys['ArrowUp'])    moveDir.z -= 1;
      if (keys['KeyS'] || keys['ArrowDown'])  moveDir.z += 1;
      if (keys['KeyA'] || keys['ArrowLeft'])  moveDir.x -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) moveDir.x += 1;
      if (Math.abs(jx) > 0.1 || Math.abs(jy) > 0.1) {
        moveDir.x += jx; moveDir.z += jy;
      }
      if (moveDir.length() > 0) {
        moveDir.normalize().multiplyScalar(5 * dt);
        moveDir.applyEuler(new THREE.Euler(0, euler.y, 0));
        const next = camera.position.clone().add(moveDir);
        next.y = 1.7; clampRoom(next, 0.6);
        if (!checkObs(next, 0.4)) camera.position.copy(next);
      }

      // NPC AI
      npcs.forEach((npc, i) => {
        if (npc.hp <= 0) return;
        const aliveNpcs = npcs.filter((n, j) => j !== i && n.hp > 0);
        const targetPos = aliveNpcs.length > 0 && Math.random() > 0.35
          ? aliveNpcs[Math.floor(Math.random()*aliveNpcs.length)].group.position.clone().setY(0)
          : camera.position.clone().setY(0);

        const dir = targetPos.clone().sub(npc.group.position).setY(0);
        if (dir.length() > 2) {
          dir.normalize();
          const next = npc.group.position.clone().addScaledVector(dir, NPC_SPEED * dt);
          clampRoom(next, 0.8);
          if (!checkObs(next, 0.5)) npc.group.position.copy(next);
        }
        npc.group.lookAt(targetPos.clone().setY(npc.group.position.y));

        const swing = Math.sin(walkTime*6 + i*2)*0.3;
        npc.group.children.forEach((c, ci) => {
          if (ci===2) (c as THREE.Object3D).rotation.x = swing;
          if (ci===3) (c as THREE.Object3D).rotation.x = -swing;
          if (ci===4) (c as THREE.Object3D).rotation.x = -swing;
          if (ci===5) (c as THREE.Object3D).rotation.x = swing;
        });

        npc.shootTimer -= dt * 1000;
        if (npc.shootTimer <= 0) {
          npc.shootTimer = NPC_SHOOT_INTERVAL + Math.random()*1000;
          const sd = targetPos.clone().sub(npc.group.position).normalize()
            .add(new THREE.Vector3((Math.random()-0.5)*0.25, 0, (Math.random()-0.5)*0.25)).normalize();
          spawnBullet(npc.group.position.clone().add(new THREE.Vector3(0,1.1,0)), sd, i);
        }
      });

      // Bullets
      for (let i = bullets.length-1; i >= 0; i--) {
        const b = bullets[i];
        b.life -= dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        const half = ROOM/2;
        if (Math.abs(b.mesh.position.x)>half || Math.abs(b.mesh.position.z)>half || b.life<=0) {
          scene.remove(b.mesh); bullets.splice(i,1); continue;
        }
        if (checkObs(b.mesh.position, 0.1)) { scene.remove(b.mesh); bullets.splice(i,1); continue; }

        if (b.owner !== 'player' && b.mesh.position.distanceTo(camera.position) < 0.7) {
          playerHp = Math.max(0, playerHp-12);
          stateRef.current.hp = playerHp; setHp(playerHp);
          scene.remove(b.mesh); bullets.splice(i,1);
          if (playerHp<=0) { stateRef.current.status='dead'; setStatus('dead'); }
          continue;
        }

        let hit = false;
        npcs.forEach((npc, ni) => {
          if (hit||npc.hp<=0||b.owner===ni) return;
          if (b.mesh.position.distanceTo(npc.group.position.clone().setY(b.mesh.position.y)) < 0.7) {
            npc.hp -= 25;
            if (npc.hp<=0) {
              npc.group.visible = false;
              if (b.owner==='player') { playerKills++; stateRef.current.kills=playerKills; setKills(playerKills); }
              if (npcs.filter(n=>n.hp>0).length===0) { stateRef.current.status='win'; setStatus('win'); }
            }
            hit = true;
          }
        });
        if (hit) { scene.remove(b.mesh); bullets.splice(i,1); }
      }

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
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('touchstart', onTouchStartLook);
      renderer.domElement.removeEventListener('touchmove', onTouchMoveLook);
      renderer.domElement.removeEventListener('touchend', onTouchEndLook);
      document.exitPointerLock();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black">
      <div ref={mountRef} className="w-full h-full" />

      {status === 'playing' && (
        <>
          {/* 조준선 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-5 h-5">
              <div className="absolute top-1/2 left-0 w-full h-px bg-white opacity-90" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-white opacity-90" />
            </div>
          </div>

          {/* HP */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-center drop-shadow md:left-6 md:translate-x-0">
            <div className="text-xs text-gray-200 mb-1">{playerName} · HP</div>
            <div className="w-44 h-3 bg-black/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-200"
                style={{ width: `${hp}%`, background: hp>50?'#10b981':hp>25?'#f59e0b':'#ef4444' }} />
            </div>
            <div className="text-xs text-gray-200 mt-1">{hp} / 100</div>
          </div>

          {/* 킬 + 전체화면 */}
          <div className="absolute top-4 right-6 text-white text-right drop-shadow flex flex-col items-end gap-2">
            <button
              onClick={toggleFullscreen}
              className="bg-black/40 hover:bg-black/60 text-white text-xs px-3 py-1 rounded-lg border border-white/20 transition"
            >
              {isFullscreen ? '전체화면 해제' : '전체화면'}
            </button>
            <div>
              <div className="text-xs text-gray-200">킬</div>
              <div className="text-3xl font-black">{kills}</div>
            </div>
          </div>

          {/* 조작 안내 (데스크탑) */}
          {!isMobile && (
            <div className="absolute top-4 left-6 text-white/70 text-xs space-y-0.5 drop-shadow">
              <div>WASD / 방향키 이동</div>
              <div>마우스 시점</div>
              <div>클릭 사격</div>
            </div>
          )}

          {/* 클릭 유도 (데스크탑) */}
          {!isMobile && !locked && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white px-6 py-3 rounded-xl text-lg font-semibold animate-pulse">
                클릭하여 시작
              </div>
            </div>
          )}

          {/* 모바일 조이스틱 */}
          {isMobile && (
            <>
              <div id="joystick-area" className="absolute bottom-8 left-8" style={{ touchAction: 'none' }}>
                <Joystick onMove={onJoystickMove} />
              </div>
              <button
                id="fire-btn"
                className="absolute bottom-8 right-8 w-20 h-20 rounded-full text-white font-bold text-sm select-none"
                style={{ background: 'rgba(239,68,68,0.5)', border: '2px solid rgba(255,255,255,0.4)', touchAction: 'none' }}
                onTouchStart={(e) => { e.preventDefault(); shootRef.current = true; }}
                onTouchEnd={(e) => { e.preventDefault(); shootRef.current = false; }}
              >
                FIRE
              </button>
            </>
          )}
        </>
      )}

      {status === 'dead' && (
        <div className="absolute inset-0 bg-red-950/85 flex flex-col items-center justify-center text-white">
          <div className="text-6xl font-black mb-3">YOU DIED</div>
          <div className="text-gray-300 mb-2">{playerName}</div>
          <div className="text-gray-300 mb-8">킬 수: {kills}</div>
          <button className="bg-white text-red-900 font-bold px-10 py-3 rounded-xl hover:bg-gray-100 transition" onClick={() => window.location.reload()}>다시 하기</button>
        </div>
      )}

      {status === 'win' && (
        <div className="absolute inset-0 bg-emerald-950/85 flex flex-col items-center justify-center text-white">
          <div className="text-6xl font-black mb-3">VICTORY!</div>
          <div className="text-gray-300 mb-2">{playerName} 님이 살아남았습니다</div>
          <div className="text-gray-300 mb-8">킬 수: {kills}</div>
          <button className="bg-white text-emerald-900 font-bold px-10 py-3 rounded-xl hover:bg-gray-100 transition" onClick={() => window.location.reload()}>다시 하기</button>
        </div>
      )}
    </div>
  );
}
