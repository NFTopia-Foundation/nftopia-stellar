"use client";

import { useState } from "react";
import { ChevronDown, User, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/stores/auth-store";
import { useToast } from "@/lib/stores";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

export function UserDropdown() {
  const { user, logout, isAuthenticated } = useAuth();
  const { showSuccess, showError } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  const { t, locale } = useTranslation();

  const handleLogout = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to log out? This will disconnect your wallet and clear your session.'
    );
    
    if (!confirmed) return;

    try {
      setLogoutLoading(true);
      
      // Clear localStorage
      localStorage.removeItem('auth-user');
      
      // Call logout API
      await logout();
      
      showSuccess('Successfully logged out');
      setDropdownOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
      showError('Logout failed. Please try again.');
    } finally {
      setLogoutLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-white">
            {user.username || 'User'}
          </div>
          <div className="text-xs text-white/60">
            {formatAddress(user.walletAddress)}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {dropdownOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-[#181359] border border-purple-500/20 rounded-lg shadow-xl z-50">
            <div className="p-4 border-b border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {user.username || 'User'}
                  </div>
                  <div className="text-xs text-white/60">
                    {formatAddress(user.walletAddress)}
                  </div>
                </div>
              </div>
            </div>

            <div className="py-2">
              <Link
                href="/creator-dashboard"
                className="flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-purple-600/20 transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                <User className="w-4 h-4" />
                Dashboard
              </Link>
              
              <Link
                href="/creator-dashboard/settings"
                className="flex items-center gap-3 px-4 py-2 text-sm text-white hover:bg-purple-600/20 transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                <Settings className="w-4 h-4" />
                Settings
              </Link>

              <div className="border-t border-purple-500/20 mt-2 pt-2">
                <button 
                  className="flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors w-full text-left disabled:opacity-50"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                >
                  {logoutLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                      Logging out...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Logout
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 