'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Wraps children in a div that fades up into view when it enters the viewport.
 * Uses IntersectionObserver — no layout shift on initial render.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
}: ScrollRevealProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }, delay);
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: 'translateY(24px)',
        transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
      }}
    >
      {children}
    </div>
  );
}
