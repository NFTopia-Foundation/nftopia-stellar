"use client";
import Link from "next/link";
import Image from "next/image";
import {
  Facebook,
  Instagram,
  Twitter,
  Mail,
  Youtube,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

const Footer = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState("English");

  const languages = ["English", "French", "Spanish"];

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  return (
    <footer className="bg-[#181359] text-white py-8 px-4 sm:px-6 lg:px-8 border-t border-purple-500/20">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Logo Section */}
          <div className="flex flex-col items-center md:items-start space-y-4">
            <Link href="/" className="flex items-center">
              <Image
                src="/nftopia-04.svg"
                alt="NFTopia Logo"
                width={120}
                height={32}
                className="h-8 w-auto"
              />
            </Link>
            <p className="text-sm text-gray-300 text-center md:text-left max-w-xs">
              {t("footer.description")}
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col items-center md:items-start space-y-4">
            <h3 className="text-lg font-semibold text-white">
              {t("footer.quickLinks")}
            </h3>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link
                href="/sitemap"
                className="hover:text-gray-300 transition-colors"
              >
                {t("footer.sitemap")}
              </Link>
              <Link
                href="/privacy-policy"
                className="hover:text-gray-300 transition-colors"
              >
                {t("footer.privacyPolicy")}
              </Link>
              <Link
                href="/terms-of-service"
                className="hover:text-gray-300 transition-colors"
              >
                {t("footer.termsOfService")}
              </Link>
            </nav>
          </div>

          {/* Support Links */}
          <div className="flex flex-col items-center md:items-start space-y-4">
            <h3 className="text-lg font-semibold text-white">
              {t("footer.support")}
            </h3>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link
                href="/contact"
                className="hover:text-gray-300 transition-colors"
              >
                {t("footer.contactUs")}
              </Link>
              <Link
                href="/shop"
                className="hover:text-gray-300 transition-colors"
              >
                {t("footer.officialShop")}
              </Link>
              <Link
                href="/help"
                className="hover:text-gray-300 transition-colors"
              >
                {t("footer.helpCenter")}
              </Link>
            </nav>
          </div>

          {/* Language Selector and Social */}
          <div className="flex flex-col items-center md:items-start space-y-4">
            <h3 className="text-lg font-semibold text-white">
              {t("footer.connect")}
            </h3>

            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="border border-gray-300 px-4 py-2 rounded-full text-sm flex items-center gap-2 hover:bg-gray-800 transition-colors"
              >
                {language}
                <ChevronDown className="w-4 h-4" />
              </button>

              {isOpen && (
                <ul className="absolute mt-2 w-36 bottom-full left-0 md:left-auto md:right-0 bg-white text-black rounded-md shadow-lg z-10">
                  {languages.map((lang) => (
                    <li
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-200 transition-colors first:rounded-t-md last:rounded-b-md"
                    >
                      {lang}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Social Media Icons */}
            <div className="flex gap-3 flex-wrap justify-center md:justify-start">
              <Link
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="border border-gray-300 rounded-full p-2 hover:opacity-80 transition-colors bg-gray-800 hover:bg-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <Facebook className="w-4 h-4" />
              </Link>
              <Link
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="border border-gray-300 rounded-full p-2 hover:opacity-80 transition-colors bg-gray-800 hover:bg-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <Instagram className="w-4 h-4" />
              </Link>
              <Link
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="border border-gray-300 rounded-full p-2 hover:opacity-80 transition-colors bg-gray-800 hover:bg-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <Twitter className="w-4 h-4" />
              </Link>
              <Link
                href="mailto:support@nftopia.com"
                aria-label="Email"
                className="border border-gray-300 rounded-full p-2 hover:opacity-80 transition-colors bg-gray-800 hover:bg-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <Mail className="w-4 h-4" />
              </Link>
              <Link
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="border border-gray-300 rounded-full p-2 hover:opacity-80 transition-colors bg-gray-800 hover:bg-gray-700 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <Youtube className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright Notice */}
        <div className="border-t border-purple-500/20 pt-6">
          <p className="text-center text-sm sm:text-base text-gray-400 leading-relaxed">
            {t("footer.copyright").replace('{YEAR}', new Date().getFullYear().toString())}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
