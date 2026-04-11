import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  base: number;
  phase: number;
  drift: number;
  /** 0 = fine dust, 1 = soft mote, 2 = brighter sparkle */
  tier: 0 | 1 | 2;
};

interface HeroSparkleFieldProps {
  className?: string;
}

/** +20% vs prior counts */
const PRIMARY = 264;
const DUST = 240;
const PRESENCE = 1.2;
const MOTION = 1.2;

export default function HeroSparkleField({ className = "" }: HeroSparkleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!canvasRef.current || !canvasRef.current.parentElement) return;
    const canvasEl: HTMLCanvasElement = canvasRef.current;
    const parentEl: HTMLElement = canvasRef.current.parentElement;
    const maybeContext = canvasEl.getContext("2d");
    if (!maybeContext) return;
    const context: CanvasRenderingContext2D = maybeContext;

    const particles: Particle[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;

    function pushParticle(i: number, tier: 0 | 1 | 2) {
      const ltr = i % 2 === 0;
      const slow = tier === 0;
      const vxBase = slow ? 0.012 + Math.random() * 0.035 : tier === 1 ? 0.018 + 0.045 * Math.random() : 0.022 + 0.055 * Math.random();
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (ltr ? 1 : -1) * vxBase,
        vy: (Math.random() - 0.5) * (slow ? 0.012 : 0.018),
        r:
          tier === 0
            ? 0.12 + Math.random() * 0.55
            : tier === 1
              ? 0.25 + Math.random() * 0.9
              : 0.35 + Math.random() * 1.35,
        base:
          PRESENCE *
          (tier === 0
            ? 0.06 + Math.random() * 0.18
            : tier === 1
              ? 0.08 + Math.random() * 0.22
              : 0.1 + Math.random() * 0.28),
        phase: Math.random() * Math.PI * 2,
        drift: slow ? 0.12 + Math.random() * 0.38 : 0.22 + Math.random() * 0.48,
        tier,
      });
    }

    function initParticles() {
      particles.length = 0;
      if (w < 8 || h < 8) return;
      let idx = 0;
      for (let i = 0; i < DUST; i++) pushParticle(idx++, 0);
      for (let i = 0; i < PRIMARY; i++) pushParticle(idx++, i % 3 === 0 ? 2 : 1);
    }

    function resize() {
      const rect = parentEl.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvasEl.width = w * dpr;
      canvasEl.height = h * dpr;
      canvasEl.style.width = `${w}px`;
      canvasEl.style.height = `${h}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(parentEl);
    resize();

    function loop() {
      raf = requestAnimationFrame(loop);
      if (w < 8 || h < 8 || particles.length === 0) return;

      t += 0.011;
      context.clearRect(0, 0, w, h);
      context.globalCompositeOperation = "lighter";

      for (const p of particles) {
        const speedMul = p.tier === 0 ? 0.85 : 1;
        p.x += p.vx * p.drift * speedMul * 0.55 * MOTION;
        p.y +=
          (p.vy * speedMul + Math.sin(t * 0.55 + p.phase) * (p.tier === 0 ? 0.022 : 0.03)) * MOTION;

        if (p.x < -12) p.x = w + 12;
        if (p.x > w + 12) p.x = -12;
        if (p.y < -12) p.y = h + 12;
        if (p.y > h + 12) p.y = -12;

        const twSlow = 0.58 + 0.42 * Math.sin(t * 0.85 + p.phase);
        const alpha = Math.min(0.95, p.base * twSlow);
        context.fillStyle = `rgba(200, 232, 255, ${alpha})`;
        context.beginPath();
        context.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        context.fill();

        if (p.tier > 0 && p.r > 0.45) {
          context.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.38})`;
          context.lineWidth = 0.3;
          context.beginPath();
          context.moveTo(p.x - p.r * 2, p.y);
          context.lineTo(p.x + p.r * 2, p.y);
          context.moveTo(p.x, p.y - p.r * 2);
          context.lineTo(p.x, p.y + p.r * 2);
          context.stroke();
        }
      }

      context.globalCompositeOperation = "source-over";
    }

    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full opacity-100" />
    </div>
  );
}
