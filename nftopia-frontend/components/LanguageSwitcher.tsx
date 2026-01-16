"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Globe, Check } from "lucide-react";
import { useTranslation, Locale } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage =
    languages.find((lang) => lang.code === locale) || languages[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown when pressing Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleLanguageChange = (languageCode: Locale) => {
    changeLocale(languageCode);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white border-purple-500/30 bg-transparent hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50 transition-colors rounded-lg"
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLanguage.flag}</span>
        <span className="hidden md:inline">{currentLanguage.nativeName}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#181359]/95 backdrop-blur-md border border-purple-500/20 rounded-lg shadow-lg z-50">
          <div className="py-1" role="listbox">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-purple-500/10 transition-colors rounded-md ${
                  locale === language.code ? "text-purple-400 bg-purple-500/10" : "text-white"
                }`}
                role="option"
                aria-selected={locale === language.code}
              >
                <span className="text-lg">{language.flag}</span>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{language.nativeName}</span>
                  <span className="text-xs text-gray-400">{language.name}</span>
                </div>
                {locale === language.code && <Check className="h-4 w-4 ml-auto text-purple-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------
// Mobile Language Switcher
// -------------------------
export function MobileLanguageSwitcher() {
  const { locale, changeLocale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage =
    languages.find((lang) => lang.code === locale) || languages[0];

  const handleLanguageChange = (languageCode: Locale) => {
    changeLocale(languageCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white border-purple-500/30 bg-transparent hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50 transition-colors rounded-lg"
        aria-label="Select language"
      >
        <Globe className="h-4 w-4" />
        <span>{currentLanguage.flag}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-[#181359]/95 backdrop-blur-md border border-purple-500/20 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-purple-500/10 transition-colors rounded-md ${
                  locale === language.code ? "text-purple-400 bg-purple-500/10" : "text-white"
                }`}
              >
                <span className="text-base">{language.flag}</span>
                <span>{language.nativeName}</span>
                {locale === language.code && <Check className="h-4 w-4 ml-auto text-purple-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
