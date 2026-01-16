"use client";

import { type LucideIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  isCompleted: boolean;
}

interface CreationStepCardProps {
  step: Step;
  index: number;
  layout: "desktop" | "mobile";
}

export default function CreationStepCard({
  step,
  index,
  layout,
}: CreationStepCardProps) {
  const { icon: Icon, title, description, color, isCompleted } = step;

  return (
    <div
      className={cn(
        "group relative flex-1 min-h-[48px] min-w-[48px] w-full max-w-[300px]",
        layout === "mobile" && "flex items-start space-x-4"
      )}
    >
      {/* Card Content */}
      <div
        className={cn(
          "relative pl-3 pr-6 py-[clamp(1rem,2vw,1.5rem)] rounded-xl transition-all duration-300",
          "backdrop-blur-sm",
          "hover:shadow-xl hover:-translate-y-1 hover:cursor-pointer hover:shadow-purple-500/10",
          layout === "mobile" && "flex-1"
        )}
      >
        {/* Completion Badge */}
        {isCompleted && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center min-h-[24px] min-w-[24px]">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
        {/* Icon */}
        <div
          className={cn(
            "w-16 h-16 rounded-lg flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 min-h-[48px] min-w-[48px]",
            color,
            layout === "mobile" && "w-12 h-12 mb-3"
          )}
        >
          <Icon
            className={cn(
              "text-white",
              layout === "desktop" ? "w-8 h-8" : "w-6 h-6"
            )}
          />
        </div>
        {/* Content */}
        <div className="space-y-3">
          <h3
            className={cn(
              "font-bold text-white text-[clamp(1rem,2vw,1.25rem)]",
              layout === "desktop" ? "text-xl" : "text-lg"
            )}
          >
            {title}
          </h3>
          <p
            className={cn(
              "text-gray-300 leading-relaxed text-[clamp(0.9rem,2vw,1.05rem)]",
              layout === "desktop" ? "text-sm" : "text-base"
            )}
          >
            {description}
          </p>
        </div>
        {/* Hover Glow Effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none",
            color
              .replace("bg-", "bg-gradient-to-br from-")
              .replace("-500", "-400/20 to-transparent")
          )}
        />
      </div>
    </div>
  );
}
