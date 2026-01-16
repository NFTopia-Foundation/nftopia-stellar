import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

// Declare JSX namespace to fix TypeScript errors
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

type ButtonLoadingState = {
  loading?: boolean;
  loadingText?: string;
};

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[clamp(1rem,2vw,1.1rem)] font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 min-h-[48px] min-w-[48px]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-lg shadow-primary/20 dark:shadow-primary/10 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30 dark:hover:shadow-primary/20 active:scale-[0.98]",
        destructive:
          "bg-gradient-to-br from-destructive/90 to-destructive text-destructive-foreground shadow-lg shadow-destructive/20 dark:shadow-destructive/10 hover:scale-[1.02] hover:shadow-xl hover:shadow-destructive/30 dark:hover:shadow-destructive/20 active:scale-[0.98]",
        outline:
          "border-2 border-input/80 bg-background/80 backdrop-blur-sm shadow-inner hover:border-primary/50 hover:bg-accent/20 hover:text-accent-foreground active:scale-[0.98]",
        secondary:
          "bg-gradient-to-br from-secondary/90 to-secondary text-secondary-foreground shadow-lg shadow-secondary/20 dark:shadow-secondary/10 hover:scale-[1.02] hover:shadow-xl hover:shadow-secondary/30 dark:hover:shadow-secondary/20 active:scale-[0.98]",
        ghost:
          "hover:bg-accent/20 hover:text-accent-foreground active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline active:text-primary/80",
        cosmic:
          "bg-gradient-to-br from-purple-600/90 to-purple-700 text-white shadow-lg shadow-purple-500/20 dark:shadow-purple-500/10 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/30 dark:hover:shadow-purple-500/20 active:scale-[0.98] border border-purple-400/20",
      },
      size: {
        default:
          "h-12 px-6 py-3 min-h-[48px] min-w-[48px] text-[clamp(1rem,2vw,1.1rem)]",
        sm: "h-10 rounded-md px-4 text-xs min-h-[48px] min-w-[48px] text-[clamp(0.95rem,2vw,1.05rem)]",
        lg: "h-14 rounded-lg px-8 text-base min-h-[48px] min-w-[48px] text-[clamp(1.05rem,2vw,1.2rem)]",
        icon: "h-12 w-12 min-h-[48px] min-w-[48px] text-[clamp(1rem,2vw,1.1rem)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants>,
    ButtonLoadingState {
  asChild?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          loading && "cursor-wait opacity-80"
        )}
        ref={ref}
        disabled={loading || props.disabled}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
