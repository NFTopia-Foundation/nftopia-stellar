import Link from "next/link";
import { CircuitBackground } from "@/components/circuit-background";
import { Button } from "@/components/ui/button";

interface NotFoundPageProps {
  locale?: string;
  title?: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function NotFoundPage({
  locale = "en",
  title = "Not Found",
  message = "The resource you're looking for doesn't exist or has been removed.",
  actionLabel = "Go to Marketplace",
  actionHref = `/${locale}/marketplace`,
}: NotFoundPageProps) {
  return (
    <main className="min-h-screen relative text-white overflow-hidden">
      <CircuitBackground />
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
          <div className="text-8xl mb-2">🔍</div>
          <h1 className="text-4xl font-bold text-white">{title}</h1>
          <p className="text-lg text-gray-400 max-w-md">{message}</p>
          <div className="flex gap-4 mt-2">
            <Link href={actionHref}>
              <Button
                size="lg"
                className="rounded-xl bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white"
              >
                {actionLabel}
              </Button>
            </Link>
            <Link href={`/${locale}`}>
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl border-gray-600 text-gray-300 hover:text-white"
              >
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
