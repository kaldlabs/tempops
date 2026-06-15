"use client";

import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const cursorDotPos = useRef({ x: 0, y: 0 });
  const cursorRingPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Only run on non-touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const animateCursor = () => {
      // Dot snaps instantly
      cursorDotPos.current.x = mousePos.current.x;
      cursorDotPos.current.y = mousePos.current.y;

      // Ring lags behind (spring easing)
      cursorRingPos.current.x += (mousePos.current.x - cursorRingPos.current.x) * 0.13;
      cursorRingPos.current.y += (mousePos.current.y - cursorRingPos.current.y) * 0.13;

      if (cursorDotRef.current) {
        cursorDotRef.current.style.transform = `translate(${cursorDotPos.current.x}px, ${cursorDotPos.current.y}px)`;
      }
      if (cursorRingRef.current) {
        cursorRingRef.current.style.transform = `translate(${cursorRingPos.current.x}px, ${cursorRingPos.current.y}px)`;
      }

      rafRef.current = requestAnimationFrame(animateCursor);
    };

    const onMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    // Scale cursor ring when hovering interactive elements
    const interactiveSelector = 'a, button, input, textarea, [role="button"], select';
    const onEnterInteractive = () => {
      if (cursorDotRef.current) {
        cursorDotRef.current.style.transform += " scale(0.5)";
        cursorDotRef.current.style.background = "white";
      }
      if (cursorRingRef.current) {
        cursorRingRef.current.style.width = "54px";
        cursorRingRef.current.style.height = "54px";
        cursorRingRef.current.style.marginLeft = "-27px";
        cursorRingRef.current.style.marginTop = "-27px";
        cursorRingRef.current.style.borderColor = "rgba(47, 109, 246, 0.9)";
      }
    };
    const onLeaveInteractive = () => {
      if (cursorDotRef.current) {
        cursorDotRef.current.style.background = "";
      }
      if (cursorRingRef.current) {
        cursorRingRef.current.style.width = "36px";
        cursorRingRef.current.style.height = "36px";
        cursorRingRef.current.style.marginLeft = "-18px";
        cursorRingRef.current.style.marginTop = "-18px";
        cursorRingRef.current.style.borderColor = "";
      }
    };

    // Use MutationObserver or attach statically to document since elements can change dynamically
    const attachToElement = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(interactiveSelector)) {
        onEnterInteractive();
      } else {
        onLeaveInteractive();
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", attachToElement);
    rafRef.current = requestAnimationFrame(animateCursor);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", attachToElement);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <div ref={cursorDotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={cursorRingRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
