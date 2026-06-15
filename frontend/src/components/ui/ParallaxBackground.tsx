"use client";

import { useEffect, useRef } from "react";

export default function ParallaxBackground() {
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only run on non-touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let rafId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (e: MouseEvent) => {
      const cx = e.clientX / window.innerWidth - 0.5;
      const cy = e.clientY / window.innerHeight - 0.5;
      targetX = cx;
      targetY = cy;
    };

    const animate = () => {
      // Spring easing
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      if (orb1Ref.current) {
        orb1Ref.current.style.transform = `translate(${currentX * -60}px, ${currentY * -40}px)`;
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.transform = `translate(${currentX * 40}px, ${currentY * 30}px)`;
      }
      if (orb3Ref.current) {
        orb3Ref.current.style.transform = `translate(${currentX * -25}px, ${currentY * 20}px)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMove);
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: -1,
        overflow: "hidden",
      }}
    >
      <div
        ref={orb1Ref}
        className="login-visual__orb"
        style={{
          width: 800,
          height: 800,
          top: "-200px",
          left: "-200px",
          background: "radial-gradient(circle, rgba(47, 109, 246, 0.05) 0%, transparent 70%)",
        }}
      />
      <div
        ref={orb2Ref}
        className="login-visual__orb"
        style={{
          width: 600,
          height: 600,
          bottom: "-100px",
          right: "-100px",
          background: "radial-gradient(circle, rgba(15, 139, 125, 0.04) 0%, transparent 70%)",
          animationDelay: "-2s",
        }}
      />
      <div
        ref={orb3Ref}
        className="login-visual__orb"
        style={{
          width: 400,
          height: 400,
          top: "40%",
          left: "60%",
          background: "radial-gradient(circle, rgba(148, 163, 184, 0.03) 0%, transparent 70%)",
          animationDelay: "-4s",
        }}
      />
    </div>
  );
}
