"use client";

import Link from "next/link";
import Image from "next/image";
import { ModernSearchInput } from "@/components/ui/modern-search-input";
import {
  Menu,
  X,
  Compass,
  ShoppingBag,
  Users,
  Lock,
  House,
  PlusSquare,
  Layers,
  Activity,
  Settings,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { WalletConnector } from "@/components/wallet/WalletConnector";
import { UserDropdown } from "./user-dropdown";
import { useAuth } from "@/lib/stores/auth-store";
import { useTranslation } from "@/hooks/useTranslation";
import { LanguageSwitcher, MobileLanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasMenuOpenRef = useRef(false);
  const { isAuthenticated, loading } = useAuth();
  const { t, locale } = useTranslation();

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const openMenu = useCallback(() => setIsMenuOpen(true), []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, isMenuOpen]);

  useEffect(() => {
    if (wasMenuOpenRef.current && !isMenuOpen) {
      hamburgerButtonRef.current?.focus();
    }
    wasMenuOpenRef.current = isMenuOpen;
  }, [isMenuOpen]);

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

          {/* Desktop nav links */}
          <div className="hidden xl:flex items-center justify-center space-x-8">
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

          {/* Right side */}
          <div className="flex items-center gap-4">
            <div className="hidden xl:block">
              <ModernSearchInput
                placeholder={t("navigation.search")}
                className="w-[180px] lg:w-[220px]"
              />
            </div>

            <div className="hidden lg:block">
              <LanguageSwitcher />
            </div>

            {/* Desktop: UserDropdown if logged in, WalletConnector if not */}
            {!loading && (
              isAuthenticated
                ? <UserDropdown />
                : <WalletConnector />
            )}

            {/* Mobile hamburger */}
            <button
              ref={hamburgerButtonRef}
              className="xl:hidden flex h-11 w-11 items-center justify-center rounded-full bg-gray-900/40 backdrop-blur-sm border border-gray-800/50"
              onClick={openMenu}
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation-drawer"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile drawer + backdrop */}
      <div
        className={`xl:hidden fixed inset-0 z-[60] transition-opacity duration-300 ${
          isMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!isMenuOpen}
      >
        <button
          className={`absolute inset-0 bg-black/55 transition-opacity duration-300 ${
            isMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close navigation menu"
          onClick={closeMenu}
        />

        <aside
          id="mobile-navigation-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          className={`absolute left-0 top-0 h-full w-[80vw] max-w-sm border-r border-purple-500/30 bg-[#100c44] shadow-2xl transition-transform duration-300 ease-out ${
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-purple-500/20 px-4 py-4">
              <span className="text-sm font-semibold tracking-wide text-purple-200">Menu</span>
              <button
                ref={closeButtonRef}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-purple-500/30 bg-gray-900/30"
                onClick={closeMenu}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div className="flex flex-col space-y-3">
                <Link
                  href={`/${locale}`}
                  className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                  onClick={closeMenu}
                >
                  <House className="h-5 w-5" />
                  Home
                </Link>
                <Link
                  href={`/${locale}/explore`}
                  className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                  onClick={closeMenu}
                >
                  <Compass className="h-5 w-5" />
                  {t("navigation.explore")}
                </Link>
                <Link
                  href={`/${locale}/creator-dashboard/create-your-collection`}
                  className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                  onClick={closeMenu}
                >
                  <PlusSquare className="h-5 w-5" />
                  Create
                </Link>
                <Link
                  href={`/${locale}/creator-dashboard/collections`}
                  className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                  onClick={closeMenu}
                >
                  <Layers className="h-5 w-5" />
                  Collections
                </Link>
                <Link
                  href={`/${locale}/creator-dashboard/sales`}
                  className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                  onClick={closeMenu}
                >
                  <Activity className="h-5 w-5" />
                  Activity
                </Link>
                <Link
                  href={`/${locale}/marketplace`}
                  className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                  onClick={closeMenu}
                >
                  <ShoppingBag className="h-5 w-5" />
                  {t("navigation.marketplace")}
                </Link>
                <Link
                  href={`/${locale}/artists`}
                  className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                  onClick={closeMenu}
                >
                  <Users className="h-5 w-5" />
                  {t("navigation.artists")}
                </Link>
                <Link
                  href={`/${locale}/vault`}
                  className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                  onClick={closeMenu}
                >
                  <Lock className="h-5 w-5" />
                  {t("navigation.vault")}
                </Link>

                {isAuthenticated && (
                  <>
                    <Link
                      href={`/${locale}/creator-dashboard`}
                      className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                      onClick={closeMenu}
                    >
                      <Layers className="h-5 w-5" />
                      {t("navigation.dashboard")}
                    </Link>
                    <Link
                      href={`/${locale}/creator-dashboard/settings`}
                      className="text-sm font-medium py-2.5 hover:text-purple-400 transition-colors flex items-center gap-2"
                      onClick={closeMenu}
                    >
                      <Settings className="h-5 w-5" />
                      Settings
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile search */}
              <div className="mt-4">
                <ModernSearchInput placeholder={t("navigation.search")} />
              </div>

              {/* Mobile language switcher */}
              <div className="mt-4">
                <MobileLanguageSwitcher />
              </div>

              {/* Mobile auth / wallet */}
              <div className="mt-4 pb-6">
                {!loading && (
                  isAuthenticated ? (
                    <Link
                      href={`/${locale}/creator-dashboard`}
                      className="block w-full text-center rounded-full px-6 py-3 bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white hover:opacity-90"
                      onClick={closeMenu}
                    >
                      {t("navigation.dashboard")}
                    </Link>
                  ) : (
                    <WalletConnector forceVisible fullWidth />
                  )
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </header>
  );
}