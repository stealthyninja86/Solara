import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  /** milliseconds per character — rAF-driven for smooth, drift-free reveal */
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function TypewriterText({ text, speed = 30, className, onComplete }: Props) {
  const [charCount, setCharCount] = useState(0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setCharCount(0);
    if (!text) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCharCount(text.length);
      onCompleteRef.current?.();
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    let started = false;
    let frame = 0;
    let startTime = 0;

    const animate = (time: number) => {
      if (!started) return;
      if (startTime === 0) startTime = time;
      const elapsed = time - startTime;
      const next = Math.min(text.length, Math.floor(elapsed / speed));
      setCharCount(next);
      if (next < text.length) {
        frame = requestAnimationFrame(animate);
      } else {
        onCompleteRef.current?.();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
            started = true;
            frame = requestAnimationFrame(animate);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [text, speed]);

  return (
    <span ref={elementRef} className={className}>
      {text.slice(0, charCount)}
      {charCount < text.length && <span className="typewriter-cursor" />}
    </span>
  );
}
