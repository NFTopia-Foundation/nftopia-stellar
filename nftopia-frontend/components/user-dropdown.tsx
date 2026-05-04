"use client";

import { useState } from "react";
import { ChevronDown, User, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/stores/auth-store";
import { useToast } from "@/lib/stores";
import Link from "next/link";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";

export function UserDropdown() {
  const { user, logout, isAuthenticated } = useAuth();
  const { showSuccess, showError } = useToast();
  const [logoutLoading, setLogoutLoading] = useState(false);

  if (!isAuthenticated || !user) return null;

  const handleLogout = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to log out? This will disconnect your wallet and clear your session."
    );
    if (!confirmed) return;

    try {
      setLogoutLoading(true);
      localStorage.removeItem("auth-user");
      await logout();
      showSuccess("Successfully logged out");
    } catch (error) {
      console.error("Logout failed:", error);
      showError("Logout failed. Please try again.");
    } finally {
      setLogoutLoading(false);
    }
  };

  const formatAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <Dropdown>
      <DropdownTrigger
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 transition-colors"
        aria-label={`User menu for ${user.username || "User"}`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center" aria-hidden="true">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-white">{user.username || "User"}</div>
          <div className="text-xs text-white/60">{formatAddress(user.walletAddress)}</div>
        </div>
        <ChevronDown className="w-4 h-4 text-white/60" aria-hidden="true" />
      </DropdownTrigger>

      <DropdownMenu className="w-64 bg-[#181359]">
        {/* Header */}
        <div className="p-4 border-b border-purple-500/20" role="presentation">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center" aria-hidden="true">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">{user.username || "User"}</div>
              <div className="text-xs text-white/60">{formatAddress(user.walletAddress)}</div>
            </div>
          </div>
        </div>

        <div className="py-1">
          {/* Link items use role="menuitem" directly */}
          <Link
            href="/creator-dashboard"
            role="menuitem"
            className="flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-purple-600/20 transition-colors focus-visible:outline-none focus-visible:bg-purple-600/20"
          >
            <User className="w-4 h-4" aria-hidden="true" />
            Dashboard
          </Link>

          <Link
            href="/creator-dashboard/settings"
            role="menuitem"
            className="flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-purple-600/20 transition-colors focus-visible:outline-none focus-visible:bg-purple-600/20"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
            Settings
          </Link>

          <DropdownSeparator />

          <DropdownItem
            onClick={handleLogout}
            disabled={logoutLoading}
            className="text-red-400 hover:bg-red-500/20"
          >
            {logoutLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400" aria-hidden="true" />
                <span className="sr-only">Logging out</span>
                Logging out...
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Logout
              </>
            )}
          </DropdownItem>
        </div>
      </DropdownMenu>
    </Dropdown>
  );
}
