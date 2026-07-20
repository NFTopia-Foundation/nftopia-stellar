"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const fallbacks: Record<string, { title: string; message: string; homeLabel: string; marketplaceLabel: string }> = {
  en: { title: "Oops!", message: "We can't seem to find the page you're looking for.", homeLabel: "Back to Homepage", marketplaceLabel: "Go to Marketplace" },
  fr: { title: "Oups !", message: "Nous ne trouvons pas la page que vous recherchez.", homeLabel: "Retour à l'accueil", marketplaceLabel: "Aller au Marketplace" },
  es: { title: "¡Oops!", message: "No podemos encontrar la página que buscas.", homeLabel: "Volver al inicio", marketplaceLabel: "Ir al Marketplace" },
  de: { title: "Hoppla!", message: "Die von Ihnen gesuchte Seite konnte nicht gefunden werden.", homeLabel: "Zurück zur Startseite", marketplaceLabel: "Zum Marketplace" },
};

export default function LocaleNotFound() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const t = fallbacks[locale as keyof typeof fallbacks] || fallbacks.en;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 px-4">
      <div className="text-8xl mb-2">🔍</div>
      <h1 className="text-4xl md:text-5xl font-bold text-white">{t.title}</h1>
      <p className="text-lg md:text-xl text-gray-300 max-w-md">{t.message}</p>
      <p className="text-base text-gray-500">Error code: 404</p>
      <div className="flex gap-4 mt-2">
        <Link
          href={`/${locale}/marketplace`}
          className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white font-semibold hover:opacity-90 transition-opacity"
        >
          {t.marketplaceLabel}
        </Link>
        <Link
          href={`/${locale}`}
          className="inline-flex items-center px-6 py-3 rounded-xl border border-gray-600 text-gray-300 font-semibold hover:text-white hover:border-gray-500 transition-colors"
        >
          {t.homeLabel}
        </Link>
      </div>
    </div>
  );
}
