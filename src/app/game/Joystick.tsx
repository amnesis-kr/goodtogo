'use client';

import { useEffect, useRef } from 'react';

interface Props {
  onMove: (x: number, y: number) => void; // -1 ~ 1
}

export default function Joystick({ onMove }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const touchId = useRef<number | null>(null);
  const baseRadius = 50;

  useEffect(() => {
    const base = baseRef.current!;
    const knob = knobRef.current!;

    function getCenter() {
      const r = base.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }

    function move(clientX: number, clientY: number) {
      const { cx, cy } = getCenter();
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > baseRadius) { dx = dx / dist * baseRadius; dy = dy / dist * baseRadius; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      onMove(dx / baseRadius, dy / baseRadius);
    }

    function reset() {
      knob.style.transform = 'translate(-50%, -50%)';
      onMove(0, 0);
      touchId.current = null;
    }

    function onTouchStart(e: TouchEvent) {
      if (touchId.current !== null) return;
      const t = e.changedTouches[0];
      touchId.current = t.identifier;
      move(t.clientX, t.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchId.current) { move(t.clientX, t.clientY); break; }
      }
    }
    function onTouchEnd(e: TouchEvent) {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchId.current) { reset(); break; }
      }
    }

    base.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      base.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onMove]);

  return (
    <div
      ref={baseRef}
      className="relative"
      style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)' }}
    >
      <div
        ref={knobRef}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(255,255,255,0.35)',
          border: '2px solid rgba(255,255,255,0.6)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
