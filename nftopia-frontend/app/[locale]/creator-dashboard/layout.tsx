"use client";

import Link from "next/link";
import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeLogo } from "@/components/ThemeLogo";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Plus, 
  Image as ImageIcon, 
  FolderOpen, 
  DollarSign, 
  Settings 
} from "lucide-react";

export default function CreatorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Menu Button - Attached to Sidebar */}
      <button
        onClick={toggleSidebar}
        className="xl:hidden fixed top-3 z-50 p-2 bg-card border border-border rounded-lg text-card-foreground hover:bg-muted transition-colors transform duration-300 ease-in-out"
        style={{
          left: isSidebarOpen ? "13rem" : "1rem", // 16rem = 256px (w-64), 1rem = 16px
        }}
      >
        {isSidebarOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="xl:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed xl:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border text-card-foreground transform transition-transform duration-300 ease-in-out h-screen ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-screen overflow-hidden">
          {/* Logo Section */}
          <div className="p-6 border-b border-border flex items-center justify-between">
            <Link href={`/${locale}`} className="flex items-center">
              <ThemeLogo width={120} height={32} className="h-8 w-auto" />
            </Link>
            <ThemeToggle />
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6 overflow-y-auto">
            <ul className="list-none p-0 space-y-4">
              <li>
                <Link
                  href={`/${locale}/creator-dashboard`}
                  className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 ${
                    pathname === `/${locale}/creator-dashboard`
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-card-foreground hover:text-primary hover:bg-muted"
                  }`}
                  onClick={closeSidebar}
                >
                  <LayoutDashboard className="h-5 w-5" />
                  <span>{t("navigation.dashboard")}</span>
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/creator-dashboard/create-your-collection`}
                  className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 ${
                    pathname === `/${locale}/creator-dashboard/create-your-collection`
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-card-foreground hover:text-primary hover:bg-muted"
                  }`}
                  onClick={closeSidebar}
                >
                  <Plus className="h-5 w-5" />
                  <span>{t("creator.createNFT")}</span>
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/creator-dashboard/my-nfts`}
                  className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 ${
                    pathname === `/${locale}/creator-dashboard/my-nfts`
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-card-foreground hover:text-primary hover:bg-muted"
                  }`}
                  onClick={closeSidebar}
                >
                  <ImageIcon className="h-5 w-5" />
                  <span>{t("profile.myNFTs")}</span>
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/creator-dashboard/collections`}
                  className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 ${
                    pathname === `/${locale}/creator-dashboard/collections`
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-card-foreground hover:text-primary hover:bg-muted"
                  }`}
                  onClick={closeSidebar}
                >
                  <FolderOpen className="h-5 w-5" />
                  <span>{t("profile.myCollections")}</span>
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/creator-dashboard/sales`}
                  className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 ${
                    pathname === `/${locale}/creator-dashboard/sales`
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-card-foreground hover:text-primary hover:bg-muted"
                  }`}
                  onClick={closeSidebar}
                >
                  <DollarSign className="h-5 w-5" />
                  <span>{t("creator.earnings")}</span>
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/creator-dashboard/settings`}
                  className={`flex items-center space-x-3 py-2 px-3 rounded-lg transition-all duration-200 ${
                    pathname === `/${locale}/creator-dashboard/settings`
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-card-foreground hover:text-primary hover:bg-muted"
                  }`}
                  onClick={closeSidebar}
                >
                  <Settings className="h-5 w-5" />
                  <span>{t("profile.settings")}</span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Mint Button */}
          {/* <div className="p-6 border-t border-border">
            <Link
              href={`/${locale}/creator-dashboard/mint-nft`}
              onClick={closeSidebar}
            >
              <button className="w-full py-3 bg-primary text-primary-foreground border-none rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>{t("creator.mint")}</span>
              </button>
            </Link>
          </div> */}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 w-full lg:ml-0 bg-background">
        {children}
      </main>
    </div>
  );
}
