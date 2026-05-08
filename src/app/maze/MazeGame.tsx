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

// 캐릭터 공통 헬퍼
function drawFrog(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // 몸통
  ctx.fillStyle = '#3dbb6e';
  ctx.beginPath(); ctx.ellipse(cx, cy+r*0.2, r*1.1, r*0.85, 0, 0, Math.PI*2); ctx.fill();
  // 눈 받침
  ctx.fillStyle = '#52c97e';
  ctx.beginPath(); ctx.arc(cx-r*0.38, cy-r*0.3, r*0.38, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.38, cy-r*0.3, r*0.38, 0, Math.PI*2); ctx.fill();
  // 흰 눈
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx-r*0.38, cy-r*0.35, r*0.22, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.38, cy-r*0.35, r*0.22, 0, Math.PI*2); ctx.fill();
  // 눈동자
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(cx-r*0.36, cy-r*0.36, r*0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.36, cy-r*0.36, r*0.12, 0, Math.PI*2); ctx.fill();
  // 하이라이트
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx-r*0.31, cy-r*0.42, r*0.05, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.31, cy-r*0.42, r*0.05, 0, Math.PI*2); ctx.fill();
  // 입
  ctx.strokeStyle = '#27865a'; ctx.lineWidth = r*0.1;
  ctx.beginPath(); ctx.arc(cx, cy+r*0.15, r*0.35, 0.15, Math.PI-0.15); ctx.stroke();
  // 볼터치
  ctx.fillStyle = 'rgba(255,150,150,0.45)';
  ctx.beginPath(); ctx.ellipse(cx-r*0.6, cy+r*0.1, r*0.2, r*0.12, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+r*0.6, cy+r*0.1, r*0.2, r*0.12, 0, 0, Math.PI*2); ctx.fill();
}

function drawSquirrel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // 꼬리 (뒤에 먼저)
  ctx.fillStyle = '#d4873a';
  ctx.beginPath();
  ctx.moveTo(cx-r*0.3, cy+r*0.4);
  ctx.quadraticCurveTo(cx-r*1.5, cy-r*0.2, cx-r*0.8, cy-r*1.1);
  ctx.quadraticCurveTo(cx-r*0.2, cy-r*0.8, cx+r*0.1, cy+r*0.1);
  ctx.fill();
  ctx.strokeStyle = '#a8621c'; ctx.lineWidth = r*0.08;
  ctx.beginPath();
  ctx.moveTo(cx-r*0.3, cy+r*0.4);
  ctx.quadraticCurveTo(cx-r*1.5, cy-r*0.2, cx-r*0.8, cy-r*1.1);
  ctx.stroke();
  // 몸통
  ctx.fillStyle = '#c97730';
  ctx.beginPath(); ctx.ellipse(cx+r*0.1, cy+r*0.25, r*0.7, r*0.85, 0.15, 0, Math.PI*2); ctx.fill();
  // 배
  ctx.fillStyle = '#f0d0a0';
  ctx.beginPath(); ctx.ellipse(cx+r*0.15, cy+r*0.4, r*0.38, r*0.5, 0.1, 0, Math.PI*2); ctx.fill();
  // 머리
  ctx.fillStyle = '#c97730';
  ctx.beginPath(); ctx.arc(cx+r*0.2, cy-r*0.55, r*0.55, 0, Math.PI*2); ctx.fill();
  // 귀
  ctx.fillStyle = '#c97730';
  ctx.beginPath(); ctx.moveTo(cx-r*0.12, cy-r*1.0); ctx.lineTo(cx-r*0.32, cy-r*1.4); ctx.lineTo(cx+r*0.08, cy-r*1.1); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+r*0.42, cy-r*1.0); ctx.lineTo(cx+r*0.58, cy-r*1.4); ctx.lineTo(cx+r*0.52, cy-r*1.05); ctx.fill();
  ctx.fillStyle = '#ffb8a0';
  ctx.beginPath(); ctx.moveTo(cx-r*0.14, cy-r*1.05); ctx.lineTo(cx-r*0.26, cy-r*1.32); ctx.lineTo(cx+r*0.02, cy-r*1.13); ctx.fill();
  // 눈
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(cx+r*0.04, cy-r*0.62, r*0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.44, cy-r*0.62, r*0.12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx+r*0.07, cy-r*0.66, r*0.05, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.47, cy-r*0.66, r*0.05, 0, Math.PI*2); ctx.fill();
  // 코
  ctx.fillStyle = '#e86060';
  ctx.beginPath(); ctx.ellipse(cx+r*0.22, cy-r*0.45, r*0.1, r*0.07, 0, 0, Math.PI*2); ctx.fill();
  // 볼터치
  ctx.fillStyle = 'rgba(255,150,100,0.4)';
  ctx.beginPath(); ctx.ellipse(cx-r*0.05, cy-r*0.38, r*0.18, r*0.1, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+r*0.45, cy-r*0.38, r*0.18, r*0.1, 0, 0, Math.PI*2); ctx.fill();
}

function drawHorse(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // 몸통
  ctx.fillStyle = '#c8956b';
  ctx.beginPath(); ctx.ellipse(cx, cy+r*0.3, r*1.0, r*0.65, 0, 0, Math.PI*2); ctx.fill();
  // 목
  ctx.beginPath(); ctx.ellipse(cx+r*0.55, cy-r*0.1, r*0.35, r*0.55, 0.4, 0, Math.PI*2); ctx.fill();
  // 머리
  ctx.beginPath(); ctx.ellipse(cx+r*0.85, cy-r*0.55, r*0.42, r*0.32, -0.3, 0, Math.PI*2); ctx.fill();
  // 귀
  ctx.beginPath(); ctx.moveTo(cx+r*0.75, cy-r*0.82); ctx.lineTo(cx+r*0.65, cy-r*1.1); ctx.lineTo(cx+r*0.88, cy-r*0.9); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+r*0.98, cy-r*0.78); ctx.lineTo(cx+r*0.95, cy-r*1.08); ctx.lineTo(cx+r*1.1, cy-r*0.87); ctx.fill();
  // 갈기
  ctx.fillStyle = '#7a4020';
  ctx.beginPath(); ctx.moveTo(cx+r*0.55, cy-r*0.6); ctx.quadraticCurveTo(cx+r*0.3, cy-r*1.0, cx+r*0.6, cy-r*0.85); ctx.quadraticCurveTo(cx+r*0.35, cy-r*0.7, cx+r*0.55, cy-r*0.2); ctx.fill();
  // 눈
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(cx+r*0.98, cy-r*0.6, r*0.1, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx+r*1.01, cy-r*0.63, r*0.04, 0, Math.PI*2); ctx.fill();
  // 코
  ctx.fillStyle = '#b07850';
  ctx.beginPath(); ctx.ellipse(cx+r*1.18, cy-r*0.42, r*0.16, r*0.1, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(cx+r*1.14, cy-r*0.42, r*0.05, r*0.04, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+r*1.24, cy-r*0.43, r*0.05, r*0.04, 0, 0, Math.PI*2); ctx.fill();
  // 다리 4개
  ctx.fillStyle = '#c8956b';
  [[-0.5,0],[-0.18,0],[0.18,0],[0.5,0]].forEach(([dx]) => {
    ctx.beginPath(); ctx.roundRect(cx+dx*r-r*0.1, cy+r*0.85, r*0.2, r*0.7, r*0.08); ctx.fill();
    ctx.fillStyle = '#3a2010';
    ctx.beginPath(); ctx.roundRect(cx+dx*r-r*0.1, cy+r*1.42, r*0.2, r*0.18, r*0.05); ctx.fill();
    ctx.fillStyle = '#c8956b';
  });
  // 꼬리
  ctx.strokeStyle = '#7a4020'; ctx.lineWidth = r*0.18;
  ctx.beginPath(); ctx.moveTo(cx-r*0.9, cy+r*0.1); ctx.quadraticCurveTo(cx-r*1.3, cy+r*0.6, cx-r*1.0, cy+r*1.0); ctx.stroke();
}

// 배경 + 테두리 공통
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, skyColor: string, groundColor: string) {
  // 하늘
  const grad = ctx.createLinearGradient(0, 0, 0, h*0.72);
  grad.addColorStop(0, skyColor); grad.addColorStop(1, '#fff');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h*0.72);
  // 땅
  ctx.fillStyle = groundColor; ctx.fillRect(0, h*0.72, w, h*0.28);
  // 잔디 물결
  ctx.fillStyle = '#5ab540';
  ctx.beginPath(); ctx.moveTo(0, h*0.72);
  for (let x = 0; x <= w; x += w*0.1) ctx.quadraticCurveTo(x+w*0.05, h*0.69, x+w*0.1, h*0.72);
  ctx.lineTo(w, h*0.72); ctx.lineTo(0, h*0.72); ctx.fill();
  // 테두리
  ctx.strokeStyle = '#ffd700'; ctx.lineWidth = w*0.04;
  ctx.strokeRect(w*0.02, h*0.02, w*0.96, h*0.96);
  ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = w*0.015;
  ctx.strokeRect(w*0.04, h*0.04, w*0.92, h*0.92);
}

function drawTitleBadge(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, color: string) {
  const bw = w*0.7, bh = h*0.1, bx = w*0.15, by = h*0.86;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh*0.4); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${w*0.1}px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w*0.5, by+bh*0.5);
  ctx.textBaseline = 'alphabetic';
}

const DRAWINGS: DrawFn[] = [
  // 개구리 구슬치기
  (ctx, w, h) => {
    drawBackground(ctx, w, h, '#b8e8ff', '#8cc84b');
    // 구름
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    [[0.18,0.12,0.07],[0.28,0.1,0.05],[0.65,0.15,0.08],[0.75,0.12,0.06]].forEach(([cx,cy,r]) => {
      ctx.beginPath(); ctx.arc(w*cx, h*cy, w*r, 0, Math.PI*2); ctx.fill();
    });
    // 구슬들
    const marbles = ['#ff5252','#ffd740','#40c4ff','#e040fb','#69f0ae','#ff6e40'];
    marbles.forEach((c, i) => {
      const mx = w*(0.12+i*0.14), my = h*0.76, mr = w*0.055;
      const g = ctx.createRadialGradient(mx-mr*0.3, my-mr*0.3, mr*0.1, mx, my, mr);
      g.addColorStop(0, '#fff'); g.addColorStop(0.25, c); g.addColorStop(1, c+'88');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = c+'aa'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI*2); ctx.stroke();
    });
    // 개구리 (크게, 중앙)
    drawFrog(ctx, w*0.5, h*0.48, w*0.17);
    // 팔 구슬치기 동작
    ctx.strokeStyle = '#27865a'; ctx.lineWidth = w*0.04; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*0.34, h*0.56); ctx.lineTo(w*0.22, h*0.68); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.66, h*0.56); ctx.lineTo(w*0.8, h*0.62); ctx.stroke();
    drawTitleBadge(ctx, w, h, '구슬치기', '#e53935');
  },

  // 다람쥐 윷놀이
  (ctx, w, h) => {
    drawBackground(ctx, w, h, '#ffe082', '#a5d6a7');
    // 윷판 원형
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = w*0.015;
    ctx.beginPath(); ctx.arc(w*0.72, h*0.38, w*0.2, 0, Math.PI*2); ctx.stroke();
    [0,1,2,3,4].forEach(i => {
      const a = i*Math.PI*2/5 - Math.PI/2;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = w*0.01;
      ctx.beginPath(); ctx.arc(w*0.72+Math.cos(a)*w*0.2, h*0.38+Math.sin(a)*h*0.18, w*0.04, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
    });
    // 윷 4개 (반달형)
    [[0.58,0.28,-0.5],[0.68,0.22,0.3],[0.78,0.25,-0.2],[0.88,0.32,0.6]].forEach(([x,y,a]) => {
      ctx.save(); ctx.translate(w*x, h*y); ctx.rotate(a);
      const wg = ctx.createLinearGradient(-w*0.04, -h*0.1, w*0.04, h*0.1);
      wg.addColorStop(0, '#d7a05a'); wg.addColorStop(1, '#8B4513');
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.roundRect(-w*0.04, -h*0.1, w*0.08, h*0.2, w*0.03); ctx.fill();
      ctx.fillStyle = '#f5deb3';
      ctx.beginPath(); ctx.ellipse(0, -h*0.04, w*0.03, h*0.07, 0, 0, Math.PI, false); ctx.fill();
      ctx.restore();
    });
    // 다람쥐
    drawSquirrel(ctx, w*0.26, h*0.55, w*0.14);
    // 팔 윷 던지는 동작
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = w*0.03; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*0.34, h*0.48); ctx.lineTo(w*0.55, h*0.35); ctx.stroke();
    drawTitleBadge(ctx, w, h, '윷놀이', '#ff8f00');
  },

  // 말 연날리기
  (ctx, w, h) => {
    // 하늘 그라디언트
    const sky = ctx.createLinearGradient(0, 0, 0, h*0.72);
    sky.addColorStop(0, '#1e88e5'); sky.addColorStop(1, '#90caf9');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h*0.72);
    ctx.fillStyle = '#66bb6a'; ctx.fillRect(0, h*0.72, w, h*0.28);
    ctx.fillStyle = '#4caf50';
    ctx.beginPath(); ctx.moveTo(0, h*0.72);
    for (let x = 0; x <= w; x += w*0.1) ctx.quadraticCurveTo(x+w*0.05, h*0.69, x+w*0.1, h*0.72);
    ctx.lineTo(w, h*0.72); ctx.lineTo(0, h*0.72); ctx.fill();
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = w*0.04;
    ctx.strokeRect(w*0.02, h*0.02, w*0.96, h*0.96);
    ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = w*0.015;
    ctx.strokeRect(w*0.04, h*0.04, w*0.92, h*0.92);
    // 구름
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    [[0.15,0.1,0.07],[0.25,0.08,0.05],[0.16,0.1,0.04]].forEach(([cx,cy,r]) => {
      ctx.beginPath(); ctx.arc(w*cx, h*cy, w*r, 0, Math.PI*2); ctx.fill();
    });
    // 연 (큰, 화려하게)
    ctx.save(); ctx.translate(w*0.65, h*0.2); ctx.rotate(0.1);
    const kite = ctx.createLinearGradient(-w*0.14, 0, w*0.14, 0);
    kite.addColorStop(0, '#e53935'); kite.addColorStop(0.5, '#ffee58'); kite.addColorStop(1, '#42a5f5');
    ctx.fillStyle = kite;
    ctx.beginPath(); ctx.moveTo(0, -h*0.15); ctx.lineTo(w*0.14, 0); ctx.lineTo(0, h*0.15); ctx.lineTo(-w*0.14, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -h*0.15); ctx.lineTo(0, h*0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w*0.14, 0); ctx.lineTo(w*0.14, 0); ctx.stroke();
    // 연 꼬리
    ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = w*0.015;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-w*0.03+i*w*0.02, h*0.15+i*h*0.04); ctx.lineTo(w*0.03+i*w*0.02, h*0.19+i*h*0.04); ctx.stroke();
    }
    ctx.restore();
    // 실 (곡선)
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w*0.65, h*0.35); ctx.quadraticCurveTo(w*0.5, h*0.55, w*0.32, h*0.72); ctx.stroke();
    // 말
    drawHorse(ctx, w*0.28, h*0.6, w*0.14);
    drawTitleBadge(ctx, w, h, '연날리기', '#1565c0');
  },

  // 개구리 팽이치기
  (ctx, w, h) => {
    drawBackground(ctx, w, h, '#c8e6c9', '#8bc34a');
    // 팽이 몸체
    ctx.save(); ctx.translate(w*0.62, h*0.6);
    const tg = ctx.createLinearGradient(-w*0.16, -h*0.18, w*0.16, h*0.1);
    tg.addColorStop(0, '#e53935'); tg.addColorStop(0.35, '#ffee58'); tg.addColorStop(0.7, '#42a5f5'); tg.addColorStop(1, '#ab47bc');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.moveTo(0, h*0.15); ctx.lineTo(-w*0.16, -h*0.18); ctx.lineTo(w*0.16, -h*0.18); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = w*0.012;
    ctx.beginPath(); ctx.moveTo(-w*0.16, -h*0.18); ctx.lineTo(w*0.16, -h*0.18); ctx.stroke();
    // 팽이 윗면 타원
    const topg = ctx.createRadialGradient(0, -h*0.18, 0, 0, -h*0.18, w*0.16);
    topg.addColorStop(0, '#fff'); topg.addColorStop(1, '#ffee58aa');
    ctx.fillStyle = topg;
    ctx.beginPath(); ctx.ellipse(0, -h*0.18, w*0.16, h*0.045, 0, 0, Math.PI*2); ctx.fill();
    // 팽이 끝점
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(0, h*0.15, w*0.025, 0, Math.PI*2); ctx.fill();
    // 회전 무늬
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = w*0.01;
    ctx.beginPath(); ctx.arc(0, -h*0.04, w*0.08, 0, Math.PI*1.3); ctx.stroke();
    ctx.restore();
    // 채찍
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = w*0.03; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*0.18, h*0.38); ctx.lineTo(w*0.5, h*0.56); ctx.stroke();
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = w*0.012;
    ctx.beginPath(); ctx.moveTo(w*0.5, h*0.56); ctx.quadraticCurveTo(w*0.58, h*0.5, w*0.62, h*0.43); ctx.stroke();
    // 개구리
    drawFrog(ctx, w*0.26, h*0.5, w*0.16);
    // 팔
    ctx.strokeStyle = '#27865a'; ctx.lineWidth = w*0.035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*0.38, h*0.54); ctx.lineTo(w*0.52, h*0.58); ctx.stroke();
    drawTitleBadge(ctx, w, h, '팽이치기', '#2e7d32');
  },

  // 제기차기 (다람쥐 + 말)
  (ctx, w, h) => {
    drawBackground(ctx, w, h, '#f3e5f5', '#c8e6c9');
    // 제기 (공중에 화려하게)
    ctx.save(); ctx.translate(w*0.55, h*0.28);
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.ellipse(0, 0, w*0.07, h*0.1, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.ellipse(0, h*0.1, w*0.03, h*0.02, 0, 0, Math.PI*2); ctx.fill();
    // 제기 깃털 (화려하게)
    const feathers = ['#ffee58','#ff7043','#4fc3f7','#a5d6a7','#ce93d8','#ffb74d'];
    feathers.forEach((c, i) => {
      ctx.fillStyle = c;
      const a = (i/feathers.length)*Math.PI*2 - Math.PI/2;
      ctx.save(); ctx.translate(Math.cos(a)*w*0.04, -h*0.1+Math.sin(a)*h*0.03);
      ctx.rotate(a+Math.PI/2);
      ctx.beginPath(); ctx.ellipse(0, -h*0.07, w*0.025, h*0.07, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.restore();
    // 다람쥐 (왼쪽, 발차기 자세)
    drawSquirrel(ctx, w*0.22, h*0.57, w*0.12);
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = w*0.03; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*0.3, h*0.68); ctx.lineTo(w*0.44, h*0.52); ctx.stroke();
    // 말 (오른쪽, 발차기 자세)
    drawHorse(ctx, w*0.68, h*0.58, w*0.12);
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = w*0.03; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w*0.58, h*0.65); ctx.lineTo(w*0.5, h*0.48); ctx.stroke();
    drawTitleBadge(ctx, w, h, '제기차기', '#7b1fa2');
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
  const [iosFakeFS, setIosFakeFS] = useState(false);

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
    if (isFullscreen) {
      document.body.style.overflow = '';
      setIosFakeFS(false);
      setIsFullscreen(false);
      const doc = document as unknown as { webkitExitFullscreen?: () => void };
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      return;
    }

    const el = document.documentElement;
    const elExt = el as unknown as { webkitRequestFullscreen?: () => void };

    // iOS Safari는 fullscreen API 미지원 — CSS로 화면 가득 채우기
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
      document.body.style.overflow = 'hidden';
      setIosFakeFS(true);
      setIsFullscreen(true);
    } else if (el.requestFullscreen) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {
        setIosFakeFS(true); setIsFullscreen(true);
      });
    } else if (elExt.webkitRequestFullscreen) {
      elExt.webkitRequestFullscreen();
      setIsFullscreen(true);
    } else {
      setIosFakeFS(true);
      setIsFullscreen(true);
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
    <div className="relative w-full h-screen bg-amber-50" style={iosFakeFS ? { position: 'fixed', inset: 0, zIndex: 9999, width: '100vw', height: '100vh' } : {}}>
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
