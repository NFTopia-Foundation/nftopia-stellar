"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ModernSearchInput } from "@/components/ui/modern-search-input";
import { Menu, X, Compass, ShoppingBag, Users, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import ConnectWallet from "./ConnectWallet";
import { UserDropdown } from "./user-dropdown";
import { useAuth } from "@/lib/stores/auth-store";
import { useTranslation } from "@/hooks/useTranslation";
import { LanguageSwitcher, MobileLanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, loading } = useAuth();
  const { t, locale } = useTranslation();

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 
      bg-[#181359] shadow-md border-t-0 mt-[-80px] border-b border-purple-500/20`}
    >
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex items-center justify-between h-16 md:h-20 relative">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center">
            <Image
              src="/nftopia-04.svg"
              alt="NFTopia Logo"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
          </Link>

          <div className="hidden xl:flex items-center justify-center transform  space-x-8">
            <Link
              href={`/${locale}/explore`}
              className="text-sm font-medium tracking-wide hover:text-purple-400 transition-colors flex items-center gap-1.5"
            >
              <Compass className="h-4 w-4" />
              {t("navigation.explore")}
            </Link>
            <Link
              href={`/${locale}/marketplace`}
              className="text-sm font-medium tracking-wide hover:text-purple-400 transition-colors flex items-center gap-1.5"
            >
              <ShoppingBag className="h-4 w-4" />
              {t("navigation.marketplace")}
            </Link>
            <Link
              href={`/${locale}/artists`}
              className="text-sm font-medium tracking-wide hover:text-purple-400 transition-colors flex items-center gap-1.5"
            >
              <Users className="h-4 w-4" />
              {t("navigation.artists")}
            </Link>
            <Link
              href={`/${locale}/vault`}
              className="text-sm font-medium tracking-wide hover:text-purple-400 transition-colors flex items-center gap-1.5"
            >
              <Lock className="h-4 w-4" />
              {t("navigation.vault")}
            </Link>
          </div>

          {/* Right Side - Search, Language Switcher & Auth */}
          <div className="flex items-center gap-4">
            <div className="hidden xl:block">
              <ModernSearchInput
                placeholder={t("navigation.search")}
                className="w-[180px] lg:w-[220px]"
              />
            </div>

            {/* Language Switcher */}
            <div className="hidden lg:block">
              <LanguageSwitcher />
            </div>

            {/* Conditional Auth Component */}
            {!loading &&
              (isAuthenticated ? <UserDropdown /> : <ConnectWallet />)}

            <button
              className="xl:hidden flex items-center justify-center p-2 rounded-full bg-gray-900/40 backdrop-blur-sm border border-gray-800/50"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5 text-white" />
              ) : (
                <Menu className="h-5 w-5 text-white" />
              )}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Menu */}
      <div
        className={`xl:hidden transition-all duration-300 overflow-hidden ${
          isMenuOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        } bg-glass backdrop-blur-md border-t border-purple-500/20`}
      >
        <div className="px-4 py-4 space-y-4">
          <div className="flex flex-col space-y-4">
            <Link
              href={`/${locale}/explore`}
              className="text-sm font-medium py-2 hover:text-purple-400 transition-colors flex items-center gap-2"
              onClick={() => setIsMenuOpen(false)}
            >
              <Compass className="h-5 w-5" />
              {t("navigation.explore")}
            </Link>
            <Link
              href={`/${locale}/marketplace`}
              className="text-sm font-medium py-2 hover:text-purple-400 transition-colors flex items-center gap-2"
              onClick={() => setIsMenuOpen(false)}
            >
              <ShoppingBag className="h-5 w-5" />
              {t("navigation.marketplace")}
            </Link>
            <Link
              href={`/${locale}/artists`}
              className="text-sm font-medium py-2 hover:text-purple-400 transition-colors flex items-center gap-2"
              onClick={() => setIsMenuOpen(false)}
            >
              <Users className="h-5 w-5" />
              {t("navigation.artists")}
            </Link>
            <Link
              href={`/${locale}/vault`}
              className="text-sm font-medium py-2 hover:text-purple-400 transition-colors flex items-center gap-2"
              onClick={() => setIsMenuOpen(false)}
            >
              <Lock className="h-5 w-5" />
              {t("navigation.vault")}
            </Link>
          </div>

          {/* Mobile Search */}
          <div className="mt-4">
            <ModernSearchInput placeholder={t("navigation.search")} />
          </div>

          {/* Mobile Language Switcher */}
          <div className="mt-4">
            <MobileLanguageSwitcher />
          </div>

          {/* Mobile Auth Actions */}
          <div className="mt-4">
            {!loading &&
              (isAuthenticated ? (
                <div className="space-y-2">
                  <Link
                    href={`/${locale}/creator-dashboard`}
                    className="block w-full text-center rounded-full px-6 py-2 bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white hover:opacity-90"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t("navigation.dashboard")}
                  </Link>
                </div>
              ) : (
                <Button
                  className="w-full rounded-full px-6 py-2 bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white hover:opacity-90"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t("navigation.register")}
                </Button>
              ))}
          </div>
        </div>
      </div>
    </header>
  );
}
