import React, { useEffect, useRef, useState } from 'react';

export interface AnimatedCounterProps {
  value: number;
  duration?: number; // duration in ms, default 1500ms
  decimals?: number;
  formatter?: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
  prefix?: string;
  suffix?: string;
  startOnView?: boolean;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1500,
  decimals = 0,
  formatter,
  className,
  style,
  prefix = '',
  suffix = '',
  startOnView = true,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [hasStarted, setHasStarted] = useState<boolean>(!startOnView);
  const elementRef = useRef<HTMLSpanElement | null>(null);
  const currentValRef = useRef<number>(0);
  const isFirstRunRef = useRef<boolean>(true);

  // Trigger on viewport intersection if startOnView is true
  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
      return;
    }
    const el = elementRef.current;
    if (!el || typeof window === 'undefined') {
      setHasStarted(true);
      return;
    }

    // Check if already in viewport
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setHasStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!hasStarted) return;

    let animId: number;
    let startTime: number | null = null;
    const startVal = isFirstRunRef.current ? 0 : currentValRef.current;
    const endVal = value;
    const diff = Math.abs(endVal - startVal);
    isFirstRunRef.current = false;

    // Fast transition for live +1 / +2 increments
    const currentDuration = diff <= 5 && startVal > 0 ? 350 : duration;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / currentDuration, 1);

      // Smooth easeOutCubic curve: satisfying roll-up with gentle deceleration
      const ease = 1 - Math.pow(1 - progress, 3);
      const rawCurrent = startVal + (endVal - startVal) * ease;
      const current = decimals > 0 ? parseFloat(rawCurrent.toFixed(decimals)) : Math.round(rawCurrent);

      currentValRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        currentValRef.current = endVal;
        setDisplayValue(endVal);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [value, duration, decimals, hasStarted]);

  const defaultFormat = (n: number) => {
    if (decimals > 0) {
      return n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return n.toLocaleString();
  };

  const formattedOutput = formatter ? formatter(displayValue) : defaultFormat(displayValue);

  return (
    <span ref={elementRef} className={className} style={style}>
      {prefix}
      {formattedOutput}
      {suffix}
    </span>
  );
};
