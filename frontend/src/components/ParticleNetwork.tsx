import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  radius: number;
  alpha: number;
  pulsePhase: number;
}

const CONFIG = {
  particleCount: window.innerWidth < 640 ? 30 : 60,
  connectDistance: 120,
  mouseRadius: 150,
  mouseForce: 0.015,
  baseDrift: 0.25,
  particleMin: 1,
  particleMax: 2.5,
  alphaMin: 0.15,
  alphaMax: 0.5,
  lineAlpha: 0.1,
  mouseLineAlpha: 0.2,
  pulseSpeed: 0.002,
  damping: 0.998,
} as const;

const GOLD_DARK = "251, 191, 36";
const DARK_PARTICLE = "9, 9, 11";
const DARK_MOUSE_LINE = "120, 80, 20";

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

export function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let mouse: { x: number; y: number } | null = null;
    let frame: number;
    let startTime = performance.now();

    function spawnParticles() {
      const { width, height } = canvas!.getBoundingClientRect();
      particles = Array.from({ length: CONFIG.particleCount }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = CONFIG.baseDrift * (0.5 + Math.random() * 0.5);
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          baseVx: Math.cos(angle) * speed,
          baseVy: Math.sin(angle) * speed,
          radius: CONFIG.particleMin + Math.random() * (CONFIG.particleMax - CONFIG.particleMin),
          alpha: CONFIG.alphaMin + Math.random() * (CONFIG.alphaMax - CONFIG.alphaMin),
          pulsePhase: Math.random() * Math.PI * 2,
        };
      });
    }

    function resize() {
      const { width, height } = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      spawnParticles();
    }

    function draw(time: number) {
      const elapsed = time - startTime;
      const { width: w, height: h } = canvas!.getBoundingClientRect();
      ctx!.clearRect(0, 0, w, h);

      const dark = isDarkMode();
      const particleColor = dark ? GOLD_DARK : DARK_PARTICLE;
      const lineColor = dark ? GOLD_DARK : GOLD_DARK;
      const mouseLineColor = dark ? GOLD_DARK : DARK_MOUSE_LINE;

      for (const p of particles) {
        const driftScale = 1 + Math.sin(elapsed * 0.0003 + p.pulsePhase) * 0.3;
        p.vx = p.baseVx * driftScale;
        p.vy = p.baseVy * driftScale;

        if (mouse) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CONFIG.mouseRadius) {
            const strength = (1 - dist / CONFIG.mouseRadius) * CONFIG.mouseForce;
            p.vx += dx * strength;
            p.vy += dy * strength;
          }
        }

        p.vx *= CONFIG.damping;
        p.vy *= CONFIG.damping;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        const pulse = Math.sin(elapsed * CONFIG.pulseSpeed + p.pulsePhase) * 0.15 + 0.85;

        ctx!.beginPath();
        ctx!.fillStyle = `rgba(${particleColor}, ${p.alpha * pulse})`;
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!;
          const b = particles[j]!;
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < CONFIG.connectDistance) {
            const alpha = (1 - dist / CONFIG.connectDistance) * CONFIG.lineAlpha;
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(${lineColor}, ${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      if (mouse) {
        for (const p of particles) {
          const dist = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (dist < CONFIG.mouseRadius) {
            const alpha = (1 - dist / CONFIG.mouseRadius) * CONFIG.mouseLineAlpha;
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(${mouseLineColor}, ${alpha})`;
            ctx!.lineWidth = 0.8;
            ctx!.moveTo(mouse.x, mouse.y);
            ctx!.lineTo(p.x, p.y);
            ctx!.stroke();
          }
        }
      }

      frame = requestAnimationFrame(draw);
    }

    function onMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function onLeave() {
      mouse = null;
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: -3,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}
