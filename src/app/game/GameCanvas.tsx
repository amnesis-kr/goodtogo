'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface Props { playerName: string; }

const ROOM = 50;
const BULLET_SPEED = 30;
const NPC_SPEED = 2;
const NPC_SHOOT_INTERVAL = 1800;

function randomPos(margin = 4): THREE.Vector3 {
  return new THREE.Vector3(
    (Math.random() - 0.5) * (ROOM - margin * 2),
    0,
    (Math.random() - 0.5) * (ROOM - margin * 2),
  );
}

interface Entity {
  mesh: THREE.Mesh;
  hp: number;
  vel: THREE.Vector3;
  target: number;
  shootTimer: number;
}

interface Bullet {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  owner: 'player' | number;
  life: number;
}

export default function GameCanvas({ playerName }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'playing' | 'dead' | 'win'>('playing');
  const [hp, setHp] = useState(100);
  const [kills, setKills] = useState(0);
  const stateRef = useRef({ hp: 100, kills: 0, status: 'playing' as const });

  useEffect(() => {
    const mount = mountRef.current!;

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 10, 45);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // --- Camera (1인칭) ---
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.7, 0);

    // --- Lighting ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // --- Floor ---
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM, ROOM),
      new THREE.MeshLambertMaterial({ color: 0x2d2d2d }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // --- Walls ---
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a3a5c });
    const wallH = 5;
    [
      [0, wallH / 2, -ROOM / 2, ROOM, wallH, 0.5],
      [0, wallH / 2, ROOM / 2, ROOM, wallH, 0.5],
      [-ROOM / 2, wallH / 2, 0, 0.5, wallH, ROOM],
      [ROOM / 2, wallH / 2, 0, 0.5, wallH, ROOM],
    ].forEach(([x, y, z, w, h, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      scene.add(m);
    });

    // --- Obstacles ---
    const obstacles: THREE.Mesh[] = [];
    const obsMat = new THREE.MeshLambertMaterial({ color: 0x556b8c });
    for (let i = 0; i < 18; i++) {
      const isCylinder = Math.random() > 0.5;
      const geo = isCylinder
        ? new THREE.CylinderGeometry(0.6 + Math.random() * 0.6, 0.6 + Math.random() * 0.6, 2 + Math.random() * 3, 12)
        : new THREE.BoxGeometry(1 + Math.random() * 2, 1.5 + Math.random() * 3, 1 + Math.random() * 2);
      const m = new THREE.Mesh(geo, obsMat);
      const p = randomPos(3);
      m.position.set(p.x, 0, p.z);
      m.castShadow = true;
      scene.add(m);
      obstacles.push(m);
    }

    // --- Gun (화면에 고정) ---
    const gunGroup = new THREE.Group();
    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x333333 }),
    );
    const gunBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0, -0.35);
    gunGroup.add(gunBody, gunBarrel);
    gunGroup.position.set(0.25, -0.25, -0.5);
    camera.add(gunGroup);
    scene.add(camera);

    // --- NPC ---
    const npcColors = [0xe74c3c, 0x2ecc71, 0x9b59b6];
    const npcs: Entity[] = npcColors.map((color, i) => {
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 1.0, 4, 8),
        new THREE.MeshLambertMaterial({ color }),
      );
      const p = randomPos(5);
      mesh.position.set(p.x, 0.85, p.z);
      scene.add(mesh);
      return { mesh, hp: 100, vel: new THREE.Vector3(), target: (i + 1) % 3, shootTimer: i * 600 };
    });

    // --- Bullets ---
    const bullets: Bullet[] = [];
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const playerBulletMat = new THREE.MeshBasicMaterial({ color: 0x00cfff });

    function spawnBullet(pos: THREE.Vector3, dir: THREE.Vector3, owner: 'player' | number) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), owner === 'player' ? playerBulletMat : bulletMat);
      mesh.position.copy(pos);
      scene.add(mesh);
      bullets.push({ mesh, vel: dir.clone().multiplyScalar(BULLET_SPEED), owner, life: 3 });
    }

    // --- Player state ---
    const keys: Record<string, boolean> = {};
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let playerHp = 100;
    let playerKills = 0;
    let locked = false;

    // Pointer lock
    renderer.domElement.addEventListener('click', () => {
      if (!locked) renderer.domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === renderer.domElement;
    });
    document.addEventListener('mousemove', (e) => {
      if (!locked) return;
      euler.y -= e.movementX * 0.002;
      euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, euler.x - e.movementY * 0.002));
      camera.quaternion.setFromEuler(euler);
    });
    document.addEventListener('keydown', (e) => { keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // Shoot
    document.addEventListener('mousedown', (e) => {
      if (!locked || e.button !== 0 || stateRef.current.status !== 'playing') return;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      spawnBullet(camera.position.clone().add(dir.clone().multiplyScalar(0.5)), dir, 'player');
      // 총 반동
      gunGroup.position.z = -0.4;
      setTimeout(() => { gunGroup.position.z = -0.5; }, 80);
    });

    // Resize
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // --- Game loop ---
    const clock = new THREE.Clock();
    let animId: number;

    function checkObstacleCollision(pos: THREE.Vector3, radius: number) {
      for (const obs of obstacles) {
        const dx = Math.abs(pos.x - obs.position.x);
        const dz = Math.abs(pos.z - obs.position.z);
        if (dx < radius + 1.2 && dz < radius + 1.2) return true;
      }
      return false;
    }

    function animate() {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if (stateRef.current.status !== 'playing') { renderer.render(scene, camera); return; }

      // --- Player movement ---
      const move = new THREE.Vector3();
      if (keys['KeyW']) move.z -= 1;
      if (keys['KeyS']) move.z += 1;
      if (keys['KeyA']) move.x -= 1;
      if (keys['KeyD']) move.x += 1;
      if (move.length() > 0) {
        move.normalize().multiplyScalar(5 * dt);
        move.applyEuler(new THREE.Euler(0, euler.y, 0));
        const next = camera.position.clone().add(move);
        next.y = 1.7;
        const half = ROOM / 2 - 0.5;
        next.x = Math.max(-half, Math.min(half, next.x));
        next.z = Math.max(-half, Math.min(half, next.z));
        if (!checkObstacleCollision(next, 0.4)) camera.position.copy(next);
      }

      // --- NPC AI ---
      npcs.forEach((npc, i) => {
        if (npc.hp <= 0) return;
        // 타겟 설정: 살아있는 NPC 또는 플레이어
        const aliveNpcs = npcs.filter((n, j) => j !== i && n.hp > 0);
        let targetPos: THREE.Vector3;
        if (aliveNpcs.length > 0 && Math.random() > 0.3) {
          targetPos = aliveNpcs[0].mesh.position;
        } else {
          targetPos = camera.position;
        }

        // 이동
        const dir = targetPos.clone().sub(npc.mesh.position).setY(0).normalize();
        const next = npc.mesh.position.clone().addScaledVector(dir, NPC_SPEED * dt);
        const half = ROOM / 2 - 1;
        next.x = Math.max(-half, Math.min(half, next.x));
        next.z = Math.max(-half, Math.min(half, next.z));
        if (!checkObstacleCollision(next, 0.5)) npc.mesh.position.copy(next);
        npc.mesh.lookAt(targetPos.clone().setY(npc.mesh.position.y));

        // 사격
        npc.shootTimer -= dt * 1000;
        if (npc.shootTimer <= 0) {
          npc.shootTimer = NPC_SHOOT_INTERVAL + Math.random() * 800;
          const shootDir = targetPos.clone().sub(npc.mesh.position).normalize().add(
            new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)
          ).normalize();
          spawnBullet(npc.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)), shootDir, i);
        }
      });

      // --- Bullets ---
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.life -= dt;
        b.mesh.position.addScaledVector(b.vel, dt);

        // 벽 충돌
        const half = ROOM / 2;
        if (Math.abs(b.mesh.position.x) > half || Math.abs(b.mesh.position.z) > half || b.life <= 0) {
          scene.remove(b.mesh);
          bullets.splice(i, 1);
          continue;
        }

        // 장애물 충돌
        if (checkObstacleCollision(b.mesh.position, 0.1)) {
          scene.remove(b.mesh);
          bullets.splice(i, 1);
          continue;
        }

        // 플레이어 피격
        if (b.owner !== 'player' && b.mesh.position.distanceTo(camera.position) < 0.6) {
          playerHp = Math.max(0, playerHp - 15);
          stateRef.current.hp = playerHp;
          setHp(playerHp);
          scene.remove(b.mesh);
          bullets.splice(i, 1);
          if (playerHp <= 0) { stateRef.current.status = 'dead' as never; setStatus('dead'); }
          continue;
        }

        // NPC 피격
        let hit = false;
        npcs.forEach((npc, ni) => {
          if (hit || npc.hp <= 0 || b.owner === ni) return;
          if (b.mesh.position.distanceTo(npc.mesh.position) < 0.6) {
            npc.hp -= 25;
            if (npc.hp <= 0) {
              npc.mesh.visible = false;
              if (b.owner === 'player') {
                playerKills++;
                stateRef.current.kills = playerKills;
                setKills(playerKills);
              }
              const alive = npcs.filter((n) => n.hp > 0).length;
              if (alive === 0) { stateRef.current.status = 'win' as never; setStatus('win'); }
            }
            hit = true;
          }
        });
        if (hit) { scene.remove(b.mesh); bullets.splice(i, 1); }
      }

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      document.exitPointerLock();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black">
      <div ref={mountRef} className="w-full h-full" />

      {/* HUD */}
      {status === 'playing' && (
        <>
          {/* 조준선 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-6 h-6">
              <div className="absolute top-1/2 left-0 w-full h-px bg-white opacity-80" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-white opacity-80" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full opacity-60" />
            </div>
          </div>

          {/* HP */}
          <div className="absolute bottom-6 left-6 text-white">
            <div className="text-xs text-gray-400 mb-1">{playerName} · HP</div>
            <div className="w-40 h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${hp}%`, background: hp > 50 ? '#10b981' : hp > 25 ? '#f59e0b' : '#ef4444' }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">{hp} / 100</div>
          </div>

          {/* 킬 카운트 */}
          <div className="absolute top-4 right-6 text-white text-right">
            <div className="text-xs text-gray-400">킬</div>
            <div className="text-2xl font-bold">{kills}</div>
          </div>

          {/* 조작 안내 */}
          <div className="absolute top-4 left-6 text-gray-500 text-xs space-y-0.5">
            <div>WASD 이동</div>
            <div>마우스 시점</div>
            <div>클릭 사격</div>
          </div>

          {/* 클릭 유도 */}
          {typeof window !== 'undefined' && !document.pointerLockElement && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-white text-lg font-semibold opacity-60 animate-pulse mt-40">
                클릭하여 시작
              </div>
            </div>
          )}
        </>
      )}

      {/* 사망 */}
      {status === 'dead' && (
        <div className="absolute inset-0 bg-red-950/80 flex flex-col items-center justify-center text-white">
          <div className="text-5xl font-black mb-2">YOU DIED</div>
          <div className="text-gray-300 mb-6">킬 수: {kills}</div>
          <button
            className="bg-white text-red-900 font-bold px-8 py-3 rounded-lg hover:bg-gray-200 transition"
            onClick={() => window.location.reload()}
          >다시 하기</button>
        </div>
      )}

      {/* 승리 */}
      {status === 'win' && (
        <div className="absolute inset-0 bg-emerald-950/80 flex flex-col items-center justify-center text-white">
          <div className="text-5xl font-black mb-2">VICTORY!</div>
          <div className="text-gray-300 mb-1">{playerName} 님이 살아남았습니다</div>
          <div className="text-gray-300 mb-6">킬 수: {kills}</div>
          <button
            className="bg-white text-emerald-900 font-bold px-8 py-3 rounded-lg hover:bg-gray-200 transition"
            onClick={() => window.location.reload()}
          >다시 하기</button>
        </div>
      )}
    </div>
  );
}
