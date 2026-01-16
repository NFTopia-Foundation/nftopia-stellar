"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface StyledButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
}

export const StyledButton = ({
  children,
  className,
  onClick,
  icon: Icon,
  iconPosition = "left",
}: StyledButtonProps) => {
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={onClick}
        className="relative cursor-pointer rounded-full bg-black/75 shadow-[-0.15em_-0.15em_0.15em_-0.075em_rgba(5,5,5,0.25),0.0375em_0.0375em_0.0675em_0_rgba(5,5,5,0.1)] group"
      >
        {/* After element simulation */}
        <div className="absolute z-0 w-[calc(100%+0.3em)] h-[calc(100%+0.3em)] -top-[0.15em] -left-[0.15em] rounded-full bg-gradient-to-tr from-[rgba(5,5,5,0.5)] via-transparent to-transparent blur-[0.0125em] opacity-25 mix-blend-multiply"></div>

        {/* Button outer */}
        <div className="relative z-1 rounded-full transition-shadow duration-300 shadow-[0_0.05em_0.05em_-0.01em_rgba(5,5,5,1),0_0.01em_0.01em_-0.01em_rgba(5,5,5,0.5),0.15em_0.3em_0.1em_-0.01em_rgba(5,5,5,0.25)] group-hover:shadow-none">
          {/* Button inner */}
          <div
            className="relative z-1 rounded-full p-4 bg-gradient-to-br from-[rgba(230,230,230,1)] to-[rgba(180,180,180,1)] transition-all duration-300 overflow-clip 
            shadow-[0_0_0_0_inset_rgba(5,5,5,0.1),-0.05em_-0.05em_0.05em_0_inset_rgba(5,5,5,0.25),0_0_0_0_inset_rgba(5,5,5,0.1),0_0_0.05em_0.2em_inset_rgba(255,255,255,0.25),0.025em_0.05em_0.1em_0_inset_rgba(255,255,255,1),0.12em_0.12em_0.12em_inset_rgba(255,255,255,0.25),-0.075em_-0.25em_0.25em_0.1em_inset_rgba(5,5,5,0.25)]
            group-hover:shadow-[0.1em_0.15em_0.05em_0_inset_rgba(5,5,5,0.75),-0.025em_-0.03em_0.05em_0.025em_inset_rgba(5,5,5,0.5),0.25em_0.25em_0.2em_0_inset_rgba(5,5,5,0.5),0_0_0.05em_0.5em_inset_rgba(255,255,255,0.15),0_0_0_0_inset_rgba(255,255,255,1),0.12em_0.12em_0.12em_inset_rgba(255,255,255,0.25),-0.075em_-0.12em_0.2em_0.1em_inset_rgba(5,5,5,0.25)]
            group-hover:clip-path-inset-[1px_1px_1px_1px_round_100em] group-active:transform group-active:scale-[0.975]"
          >
            {/* Text span with icon */}
            <span className="relative z-[4] font-inter text-transparent bg-gradient-to-br from-[rgba(25,25,25,1)] to-[rgba(75,75,75,1)] bg-clip-text tracking-tight font-medium transition-transform duration-250 flex items-center gap-2 select-none shadow-[rgba(0,0,0,0.1)_0_0_0.1em] group-hover:scale-[0.975]">
              {iconPosition === "left" && Icon && (
                <Icon className="w-4 h-4 text-black" />
              )}
              {children}
              {iconPosition === "right" && Icon && (
                <Icon className="w-4 h-4 text-black" />
              )}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default StyledButton;
