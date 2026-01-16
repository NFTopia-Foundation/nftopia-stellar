import * as React from "react";
import { cn } from "@/lib/utils";

const Web3Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-lg border-2 border-purple-500/30 bg-[#1a1347]/70 px-4 py-3 text-base text-purple-100 shadow-inner shadow-purple-900/20 backdrop-blur-sm transition-all duration-200",
        "placeholder:text-purple-300/50",
        "focus:border-purple-400/70 focus:ring-1 focus:ring-purple-400/70 focus:outline-none",
        "hover:border-purple-400/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Web3Input.displayName = "Web3Input";

export { Web3Input };
