import { useEffect, useRef, useState } from 'react';
import './SessionLoading.css';

// A local, bounded Lorenz orbit: no network or animation dependency during sign-in.
function useLorenzButterfly(paused: boolean) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const points: number[][] = [];
    let x = .1, y = 0, z = 0;
    for (let i = 0; i < 10500; i++) {
      const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - 8 * z / 3;
      x += dx * .005; y += dy * .005; z += dz * .005;
      if (i > 1500) points.push([x, y, z - 25]);
    }
    let frame = 0, time = 0, previous = 0;
    const draw = () => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const angle = .28 + Math.sin(time * .13) * .42;
      const scale = Math.min(width / 58, height / 54);
      const head = (Math.floor(time * 330) + 3600) % points.length;
      const colors = ['#687fc5', '#9561bc', '#cf599e', '#ee8b67', '#f6bc70', '#ffe1a4'];
      for (let i = 0; i < points.length; i++) {
        const [px, py, pz] = points[i];
        const horizontal = px * Math.cos(angle) + py * Math.sin(angle);
        const depth = py * Math.cos(angle) - px * Math.sin(angle);
        const sx = Math.round((width / 2 + horizontal * scale) / 3) * 3;
        const sy = Math.round((height / 2 - (pz + depth * .12) * scale) / 3) * 3;
        const age = (head - i + points.length) % points.length;
        const bright = age < 1400;
        context.globalAlpha = bright ? .95 - age / 1900 : .24;
        context.fillStyle = bright ? colors[Math.min(5, Math.floor((1 - age / 1400) * 6))] : colors[i % 2];
        const size = bright ? 1.8 : 1.2;
        context.fillRect(sx, sy, size, size);
        if (age < 12) {
          context.globalAlpha = .95;
          context.fillStyle = '#fff4d8';
          context.fillRect(sx - .5, sy - .5, 2.8, 2.8);
        }
      }
      context.globalAlpha = 1;
    };
    const tick = (now: number) => {
      if (now - previous >= 1000 / 30) {
        time += Math.min((now - previous) / 1000, .05);
        previous = now;
        draw();
      }
      frame = window.requestAnimationFrame(tick);
    };
    const sync = () => {
      window.cancelAnimationFrame(frame);
      draw();
      if (!paused && !motion.matches && !document.hidden) {
        previous = performance.now();
        frame = window.requestAnimationFrame(tick);
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [paused]);
  return ref;
}

export function SessionLoading({ error, onRetry }: { error?: string | null; onRetry: () => void }) {
  const butterfly = useLorenzButterfly(Boolean(error));
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (error) return;
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  return <main className="rf-session-screen" aria-busy={!error}>
    <a className="rf-session-brand" href="/">RelayForge<span aria-hidden="true">↗</span></a>
    <div className="rf-session-content">
      <canvas ref={butterfly} className="rf-session-butterfly" aria-hidden="true" />
      <div role={error ? 'alert' : 'status'} aria-live="polite">
        <h1>{error ? 'Let’s try that again.' : 'Opening your workspace.'}</h1>
        <p>{error ? 'Unable to verify your session. Your session may still be active.' : slow
          ? 'This is taking longer than usual. We’re still checking your secure session.'
          : 'Checking your secure session. You’ll be right in.'}</p>
      </div>
      {error && <div className="rf-session-actions">
        <button type="button" onClick={onRetry}>Retry<span aria-hidden="true"> ↗</span></button>
        <a href="/">Back to home</a>
      </div>}
    </div>
    <p className="rf-session-footnote">Your workspace, securely connected.</p>
  </main>;
}
