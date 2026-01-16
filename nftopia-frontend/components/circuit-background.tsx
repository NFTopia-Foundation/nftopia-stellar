"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function CircuitBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    container.innerHTML = "";

    const createGradientBackground = () => {
      const gradientContainer = document.createElement("div");
      gradientContainer.className =
        "absolute inset-0 bg-gradient-to-b from-[#0f0c38] via-[#181359] to-[#241970]";

      const noiseOverlay = document.createElement("div");
      noiseOverlay.className = "absolute inset-0 opacity-[0.03]";
      noiseOverlay.style.backgroundImage =
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")";

      gradientContainer.appendChild(noiseOverlay);
      container.appendChild(gradientContainer);
    };

    const createGlowingWaves = () => {
      const wavesContainer = document.createElement("div");
      wavesContainer.className = "absolute inset-0 overflow-hidden";

      for (let i = 0; i < 3; i++) {
        const wave = document.createElement("div");
        wave.className = "absolute w-full";
        wave.style.height = `${200 + i * 100}px`;
        wave.style.bottom = `${-50 - i * 20}px`;
        wave.style.opacity = `${0.15 - i * 0.03}`;
        wave.style.borderRadius = "50%";
        wave.style.background = `radial-gradient(ellipse at center, rgba(100,120,255,${
          0.2 - i * 0.05
        }) 0%, rgba(24,19,89,0) 70%)`;
        wave.style.transform = `scaleX(${1.5 + i * 0.5})`;

        wavesContainer.appendChild(wave);

        gsap.to(wave, {
          y: -30 - i * 10,
          duration: 6 + i * 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }

      container.appendChild(wavesContainer);
    };

    const createFlowingParticles = () => {
      const particlesContainer = document.createElement("div");
      particlesContainer.className = "absolute inset-0 pointer-events-none";

      for (let i = 0; i < 50; i++) {
        const particle = document.createElement("div");
        particle.className = "absolute rounded-full";

        particle.style.width = `${0.8 + Math.random() * 2.2}px`;
        particle.style.height = particle.style.width;

        const colorType = i % 4;
        if (colorType === 0) {
          particle.style.backgroundColor = "rgba(100, 120, 255, 0.8)";
          particle.style.boxShadow = "0 0 4px rgba(100, 120, 255, 0.8)";
        } else if (colorType === 1) {
          particle.style.backgroundColor = "rgba(140, 160, 255, 0.8)";
          particle.style.boxShadow = "0 0 4px rgba(140, 160, 255, 0.8)";
        } else if (colorType === 2) {
          particle.style.backgroundColor = "rgba(236, 121, 107, 0.8)";
          particle.style.boxShadow = "0 0 4px rgba(236, 121, 107, 0.8)";
        } else {
          particle.style.backgroundColor = "rgba(151, 71, 255, 0.8)";
          particle.style.boxShadow = "0 0 4px rgba(151, 71, 255, 0.8)";
        }

        particle.style.left = `${Math.random() * width}px`;
        particle.style.top = `${Math.random() * height}px`;

        particlesContainer.appendChild(particle);

        const duration = 4 + Math.random() * 8;
        const delay = Math.random() * 4;
        const xDistance = Math.random() * 220 - 110;
        const yDistance = 120 + Math.random() * 180;

        const restartParticleAnimation = () => {
          gsap.to(particle, {
            x: xDistance,
            y: yDistance,
            opacity: 0,
            scale: 0.5,
            duration: duration * 0.8,
            ease: "sine.out",
            onComplete: resetParticlePosition,
          });
        };

        const resetParticlePosition = () => {
          gsap.set(particle, {
            x: 0,
            y: 0,
            left: `${Math.random() * width}px`,
            top: `${Math.random() * height}px`,
            opacity: 0,
            scale: 0.5,
            onComplete: startParticleAnimation,
          });
        };

        const startParticleAnimation = () => {
          gsap.fromTo(
            particle,
            { opacity: 0, scale: 0.5 },
            {
              opacity: 1,
              scale: 1,
              duration: duration * 0.2,
              ease: "sine.in",
              onComplete: restartParticleAnimation,
            }
          );
        };

        gsap.fromTo(
          particle,
          {
            opacity: 0,
            scale: 0.5,
          },
          {
            opacity: 1,
            scale: 1,
            duration: duration * 0.2,
            delay: delay,
            ease: "sine.in",
            onComplete: restartParticleAnimation,
          }
        );
      }

      container.appendChild(particlesContainer);
    };

    const createGlowingNodes = () => {
      const nodesContainer = document.createElement("div");
      nodesContainer.className = "absolute inset-0";

      for (let i = 0; i < 15; i++) {
        const node = document.createElement("div");
        node.className = "absolute rounded-full";
        node.style.width = "3px";
        node.style.height = "3px";
        node.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
        node.style.boxShadow = "0 0 8px rgba(100, 120, 255, 0.8)";
        node.style.left = `${Math.random() * width}px`;
        node.style.top = `${Math.random() * height}px`;

        nodesContainer.appendChild(node);

        gsap.to(node, {
          scale: 1.5,
          opacity: 0.5,
          boxShadow: "0 0 12px rgba(100, 120, 255, 0.9)",
          duration: 1.5 + Math.random() * 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }

      container.appendChild(nodesContainer);
    };

    createGradientBackground();
    createGlowingWaves();
    createGlowingNodes();
    createFlowingParticles();

    const handleResize = () => {
      container.innerHTML = "";
      createGradientBackground();
      createGlowingWaves();
      createGlowingNodes();
      createFlowingParticles();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="circuit-background fixed inset-0 z-[-1]"
    ></div>
  );
}
