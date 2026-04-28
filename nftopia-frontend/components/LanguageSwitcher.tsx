"use client";

import { ChevronDown, Globe, Check } from "lucide-react";
import { useTranslation, Locale } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@/components/ui/dropdown";

interface LanguageOption {
  code: Locale;
  name: string;
  flag: string;
  nativeName: string;
}

const languages: LanguageOption[] = [
  { code: "en", name: "English", flag: "🇺🇸", nativeName: "English" },
  { code: "fr", name: "French", flag: "🇫🇷", nativeName: "Français" },
  { code: "es", name: "Spanish", flag: "🇪🇸", nativeName: "Español" },
  { code: "de", name: "German", flag: "🇩🇪", nativeName: "Deutsch" },
];

// -------------------------
// Desktop Language Switcher
// -------------------------
export function LanguageSwitcher() {
  const { locale, changeLocale } = useTranslation();
  const currentLanguage = languages.find((l) => l.code === locale) ?? languages[0];

  return (
    <Dropdown>
      <DropdownTrigger
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white border border-purple-500/30 bg-transparent hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50 transition-colors rounded-lg"
        aria-label="Select language"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline" aria-hidden="true">{currentLanguage.flag}</span>
        <span className="hidden md:inline">{currentLanguage.nativeName}</span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </DropdownTrigger>

      <DropdownMenu className="w-48" align="right">
        {languages.map((language) => (
          <DropdownItem
            key={language.code}
            onClick={() => changeLocale(language.code)}
            role="option"
            aria-selected={locale === language.code}
            className={locale === language.code ? "text-purple-400 bg-purple-500/10" : "text-white"}
          >
            <span className="text-lg" aria-hidden="true">{language.flag}</span>
            <div className="flex flex-col items-start">
              <span className="font-medium">{language.nativeName}</span>
              <span className="text-xs text-gray-400">{language.name}</span>
            </div>
            {locale === language.code && (
              <Check className="h-4 w-4 ml-auto text-purple-400" aria-hidden="true" />
            )}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

// -------------------------
// Mobile Language Switcher
// -------------------------
export function MobileLanguageSwitcher() {
  const { locale, changeLocale } = useTranslation();
  const currentLanguage = languages.find((l) => l.code === locale) ?? languages[0];

  return (
    <Dropdown>
      <DropdownTrigger
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white border border-purple-500/30 bg-transparent hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50 transition-colors rounded-lg"
        aria-label="Select language"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span aria-hidden="true">{currentLanguage.flag}</span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </DropdownTrigger>

      <DropdownMenu className="w-40" align="right">
        {languages.map((language) => (
          <DropdownItem
            key={language.code}
            onClick={() => changeLocale(language.code)}
            role="option"
            aria-selected={locale === language.code}
            className={locale === language.code ? "text-purple-400 bg-purple-500/10" : "text-white"}
          >
            <span className="text-base" aria-hidden="true">{language.flag}</span>
            <span>{language.nativeName}</span>
            {locale === language.code && (
              <Check className="h-4 w-4 ml-auto text-purple-400" aria-hidden="true" />
            )}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
