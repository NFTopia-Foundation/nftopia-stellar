import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        interactive?: boolean;
    }
>(({ className, interactive = false, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all",
            interactive &&
                "hover:shadow-xl hover:-translate-y-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50",
            className,
        )}
        {...props}
    />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col gap-1.5 p-4 sm:p-5", className)}
        {...props}
    />
));
CardHeader.displayName = "CardHeader";

const CardMedia = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "relative aspect-square w-full bg-muted overflow-hidden",
            className,
        )}
        {...props}
    />
));
CardMedia.displayName = "CardMedia";

const CardTitle = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "font-semibold leading-none tracking-tight text-[clamp(1rem,2vw,1.25rem)]",
            className,
        )}
        {...props}
    />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "text-sm text-muted-foreground text-[clamp(0.9rem,2vw,1.05rem)]",
            className,
        )}
        {...props}
    />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-4 pb-4", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center justify-between px-4 pb-4", className)}
        {...props}
    />
));
CardFooter.displayName = "CardFooter";

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardDescription,
    CardContent,
    CardMedia,
};
