"use client";

import React, { useId } from "react";

export function Vault() {
  // Generate unique IDs for gradients to avoid conflicts
  const metalGradientId = useId();
  const ringGradientId = useId();
  const handleGradientId = useId();
  const lockGradientId = useId();
  const shadowGradientId = useId();
  const sheenGradientId = useId();

  return (
    <div className="relative w-full h-full">
      {/* Subtle background glow */}
      <div className="absolute w-[500px] h-[500px] bg-gradient-to-r from-[#4e3bff]/10 to-[#9747ff]/10 rounded-full filter blur-xl animate-pulse-slow"></div>

      {/* SVG Vault with animations */}
      <div className="relative w-[500px] h-[500px] group">
        <svg
          version="1.2"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 1600"
          width="500"
          height="667"
          className="drop-shadow-2xl"
        >
          {/* Main vault door - outer circle */}
          <circle
            cx="600"
            cy="800"
            r="500"
            fill={`url(#${metalGradientId})`}
            className="transition-transform duration-1000 ease-out group-hover:rotate-[15deg] origin-center"
            stroke="#505050"
            strokeWidth="5"
          />

          {/* Outer bolts */}
          {[...Array(24)].map((_, i) => (
            <circle
              key={i}
              cx={600 + 480 * Math.cos((i * Math.PI) / 12)}
              cy={800 + 480 * Math.sin((i * Math.PI) / 12)}
              r="15"
              fill="#505050"
              stroke="#606060"
              strokeWidth="2"
              className="transition-all duration-700 group-hover:rotate-[15deg] origin-[600px_800px] group-hover:scale-110"
            />
          ))}

          {/* Middle ring */}
          <circle
            cx="600"
            cy="800"
            r="400"
            fill="none"
            stroke={`url(#${ringGradientId})`}
            strokeWidth="8"
            className="transition-transform duration-1000 ease-out group-hover:rotate-[30deg] origin-center"
          />

          {/* Inner ring */}
          <circle
            cx="600"
            cy="800"
            r="300"
            fill="none"
            stroke={`url(#${ringGradientId})`}
            strokeWidth="6"
            className="transition-transform duration-1000 ease-out group-hover:rotate-[-20deg] origin-center"
          />

          {/* Spokes */}
          {[...Array(6)].map((_, i) => (
            <line
              key={i}
              x1="600"
              y1="800"
              x2={600 + 400 * Math.cos((i * Math.PI) / 3)}
              y2={800 + 400 * Math.sin((i * Math.PI) / 3)}
              stroke="#707070"
              strokeWidth="20"
              className="transition-transform duration-1000 ease-out group-hover:rotate-[15deg] origin-[600px_800px]"
            />
          ))}

          {/* Center handle */}
          <g className="transition-transform duration-700 ease-out group-hover:rotate-[85deg] origin-[600px_800px]">
            <circle
              cx="600"
              cy="800"
              r="120"
              fill={`url(#${handleGradientId})`}
              stroke="#404040"
              strokeWidth="4"
            />
            <rect
              x="540"
              y="790"
              width="120"
              height="20"
              fill="#303030"
              rx="10"
              stroke="#404040"
              strokeWidth="2"
            />
          </g>

          {/* Lock mechanism */}
          <rect
            x="1100"
            y="730"
            width="50"
            height="140"
            fill={`url(#${lockGradientId})`}
            rx="5"
            stroke="#404040"
            strokeWidth="2"
            className="transition-all duration-700 group-hover:translate-x-[-20px] group-hover:opacity-50"
          />

          {/* Lock bolts */}
          <rect
            x="1080"
            y="750"
            width="30"
            height="30"
            fill="#404040"
            rx="4"
            className="transition-all duration-700 group-hover:translate-x-[-50px] group-hover:opacity-0"
          />
          <rect
            x="1080"
            y="820"
            width="30"
            height="30"
            fill="#404040"
            rx="4"
            className="transition-all duration-700 group-hover:translate-x-[-50px] group-hover:opacity-0"
          />

          {/* Shadows and highlights */}
          <circle
            cx="600"
            cy="800"
            r="500"
            fill={`url(#${shadowGradientId})`}
            opacity="0.3"
            className="transition-transform duration-1000 ease-out group-hover:rotate-[15deg] origin-center"
          />

          {/* Metallic sheen overlay */}
          <circle
            cx="600"
            cy="800"
            r="500"
            fill={`url(#${sheenGradientId})`}
            className="animate-sheen opacity-40"
          />

          {/* Scratches on metal */}
          <line
            x1="400"
            y1="600"
            x2="450"
            y2="620"
            stroke="#909090"
            strokeWidth="1"
            opacity="0.3"
            className="transition-transform duration-1000 ease-out group-hover:rotate-[15deg] origin-[600px_800px]"
          />
          <line
            x1="750"
            y1="950"
            x2="800"
            y2="930"
            stroke="#909090"
            strokeWidth="1"
            opacity="0.3"
            className="transition-transform duration-1000 ease-out group-hover:rotate-[15deg] origin-[600px_800px]"
          />
          <line
            x1="500"
            y1="1000"
            x2="550"
            y2="1050"
            stroke="#909090"
            strokeWidth="1"
            opacity="0.3"
            className="transition-transform duration-1000 ease-out group-hover:rotate-[15deg] origin-[600px_800px]"
          />

          {/* Gradients definitions with unique IDs */}
          <defs>
            <linearGradient
              id={metalGradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#808080" />
              <stop offset="30%" stopColor="#a0a0a0" />
              <stop offset="50%" stopColor="#d0d0d0" />
              <stop offset="70%" stopColor="#a0a0a0" />
              <stop offset="100%" stopColor="#707070" />
            </linearGradient>

            <linearGradient
              id={ringGradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#a0a0a0" />
              <stop offset="50%" stopColor="#e0e0e0" />
              <stop offset="100%" stopColor="#909090" />
            </linearGradient>

            <linearGradient
              id={handleGradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#505050" />
              <stop offset="50%" stopColor="#808080" />
              <stop offset="100%" stopColor="#404040" />
            </linearGradient>

            <linearGradient
              id={lockGradientId}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#808080" />
              <stop offset="50%" stopColor="#b0b0b0" />
              <stop offset="100%" stopColor="#606060" />
            </linearGradient>

            <linearGradient
              id={shadowGradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
              <stop offset="50%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
            </linearGradient>

            <linearGradient
              id={sheenGradientId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="30%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="70%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Digital elements */}
        <div className="absolute top-5 right-5 flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        </div>

        {/* Data particles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-purple-500 rounded-full animate-float"
            style={{
              left: `${20 + Math.random() * 60}%`,
              top: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          ></div>
        ))}

        {/* Digital scan effect */}
        <div className="absolute inset-0 overflow-hidden rounded-full opacity-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-purple-500 to-transparent animate-scan"></div>
        </div>

        {/* Purple glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#4e3bff]/5 to-[#9747ff]/5 rounded-full filter blur-xl animate-pulse-slow"></div>
      </div>

      {/* Enhanced Reflection Effect */}
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-3/4 h-12 bg-purple-500/10 filter blur-xl rounded-full"></div>
    </div>
  );
}
