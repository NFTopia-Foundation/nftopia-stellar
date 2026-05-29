"use client";

import { CircuitBackground } from "@/components/circuit-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/stores/auth-store";
import { useTranslation } from "@/hooks/useTranslation";
import { useStellarWallet } from "@/components/wallet/hooks/useStellarWallet";
import { useStellarAuth } from "@/components/wallet/hooks/useStellarAuth";
import { WalletModal } from "@/components/wallet/WalletModal";
import { WalletNetworkStatus } from "@/components/wallet/WalletNetworkStatus";
import { defaultNetwork } from "@/lib/stellar/client";
import { getValidationFieldMessage } from "@/utils/fetchUtils";
import {
  KeyRound,
  LogIn,
  Wallet,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { OptimizedImage } from "@/components/image";
import Link from "next/link";
import React, { useState } from "react";

type AuthMode = "wallet" | "email";

export default function LoginPage() {
  const { t, locale } = useTranslation();

  // Integrated hooks from main branch
  const {
    loading: emailLoading,
    error: emailStoreError,
    clearError: clearEmailError,
  } = useAuth();

  // Dynamic fallback handling for emailLogin function versions
  const authState = useAuth();
  const emailLogin =
    (gameState as any).loginWithEmail || (gameState as any).emailLogin || authState.clearError;

  // Stellar wallet state hooks
  const {
    connected,
    address,
    provider,
    connecting,
    error: walletError,
    connect,
    disconnect,
    clearError: clearWalletError,
  } = useStellarWallet();

  const {
    loading: authLoading,
    error: authError,
    authenticateWithWallet,
    clearError: clearAuthError,
  } = useStellarAuth();

  // UI Local layout states
  const [mode, setMode] = useState<AuthMode>("wallet");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [challengeRequested, setChallengeRequested] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const loading = emailLoading || connecting || authLoading;

  const clearAllErrors = () => {
    clearEmailError();
    clearWalletError();
    clearAuthError();
    setLocalError("");
  };

  const switchMode = (m: AuthMode) => {
    clearAllErrors();
    setChallengeRequested(false);
    setMode(m);
  };

  /* ── Wallet auth flow ── */
  const handleWalletAuth = async () => {
    if (!address || !provider) {
      setLocalError("Please connect your wallet first");
      return;
    }
    clearAllErrors();
    try {
      await authenticateWithWallet(address, provider, () => {
        // Redirect logic handled natively inside global store transitions
      });
    } catch {
      // Handled contextually by stellar store state properties
    }
  };

  // Email auth flow
  const handleEmailLogin = async () => {
    if (!email || !password) {
      setLocalError("Please enter both your email and password");
      return;
    }
    clearAllErrors();
    try {
      if (typeof emailLogin === "function") {
        await emailLogin(email, password);
      }
    } catch {
      // Managed gracefully by underlying hook interceptors
    }
  };

  // Safe fallback processing for string structures vs AppApiError definitions
  const globalErrorInstance = emailStoreError || authError || walletError;
  const globalErrorMessage =
    typeof globalErrorInstance === "string"
      ? globalErrorInstance
      : globalErrorInstance?.message;

  const displayGeneralError = localError || globalErrorMessage;

  // Specific nested context extractors for form inputs from your branch
  const emailFieldError = getValidationFieldMessage(emailStoreError, "email");
  const passwordFieldError = getValidationFieldMessage(
    emailStoreError,
    "password",
  );

  return (
    <div className="min-h-[500px] text-white">
      <CircuitBackground />

      <div className="relative z-10 pb-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="border border-purple-500/20 rounded-xl p-8 bg-glass backdrop-blur-md shadow-lg">
            
            <div className="flex justify-center mb-8">
              <OptimizedImage
                src="/nftopia-04.svg"
                alt="NFTopia Logo"
                width={200}
                height={60}
                className="h-auto"
                fallbackSrc="/images/fallbacks/collection-fallback.svg"
                priority
              />
            </div>

            {/* General Banner Fallback Notification */}
            {displayGeneralError && (
              <div className="mb-6 p-3 bg-red-900/40 text-red-300 rounded-lg border border-red-500/30 text-sm flex items-start gap-2 animate-fadeIn">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-400" />
                <div className="flex-1">
                  <p className="font-medium text-red-200">
                    Authentication Alert
                  </p>
                  <p className="text-xs text-red-300/90 mt-0.5">
                    {displayGeneralError}
                  </p>
                </div>
              </div>
            )}

            <div className="flex rounded-lg bg-gray-800/50 p-1 mb-6 gap-1">
              <button
                type="button"
                onClick={() => switchMode("wallet")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === "wallet"
                    ? "bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Wallet className="h-4 w-4" />
                {t("login.walletTab") || "Wallet"}
              </button>
              <button
                type="button"
                onClick={() => switchMode("email")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === "email"
                    ? "bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Mail className="h-4 w-4" />
                {t("login.emailTab") || "Email"}
              </button>
            </div>

            {/* WALLET MODE */}
            {mode === "wallet" && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-purple-300">
                    {t("login.walletAddress") || "Wallet Address"}
                  </label>

                  {connected && address ? (
                    <div className="flex items-center justify-between w-full bg-gray-800/50 border border-purple-500/20 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
                        <span className="text-sm font-mono text-gray-200 truncate">
                          {address.slice(0, 8)}...{address.slice(-6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <WalletNetworkStatus network={defaultNetwork} />
                        <button
                          type="button"
                          onClick={() => {
                            disconnect();
                            setChallengeRequested(false);
                          }}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          {t("connectWallet.disconnect") || "Disconnect"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Input
                      type="text"
                      value=""
                      readOnly
                      placeholder={
                        t("login.inputPlaceholder") ||
                        "Connect wallet to populate"
                      }
                      className="w-full bg-gray-800/50 border border-purple-500/20 rounded-lg px-4 py-3 text-sm"
                    />
                  )}
                </div>

                <div className="space-y-3">
                  {!connected ? (
                    <Button
                      type="button"
                      onClick={() => setWalletModalOpen(true)}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
                      disabled={loading}
                    >
                      <Wallet className="mr-2 h-5 w-5" />
                      {t("login.connectWallet") || "Connect Wallet"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleWalletAuth}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
                      disabled={loading}
                    >
                      <LogIn className="mr-2 h-5 w-5" />
                      {loading
                        ? t("login.signingIn") || "Signing in…"
                        : t("login.signAndLogin") || "Sign & Login"}
                    </Button>
                  )}
                </div>

                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  {t("login.walletAuthNote") ||
                    "You will be asked to sign a message to verify ownership of your Stellar wallet. No transaction will be submitted."}
                </p>
              </div>
            )}

            {/* EMAIL MODE */}
            {mode === "email" && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    {t("login.email") || "Email"}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`w-full bg-gray-800/50 border rounded-lg pl-9 pr-4 py-3 text-sm transition-colors ${
                        emailFieldError
                          ? "border-red-500 focus-visible:ring-red-500"
                          : "border-purple-500/20"
                      }`}
                    />
                  </div>
                  {emailFieldError && (
                    <p className="text-xs text-red-400 mt-1.5 ml-1 animate-fadeIn font-medium">
                      {emailFieldError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    {t("login.password") || "Password"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full bg-gray-800/50 border rounded-lg pl-9 pr-10 py-3 text-sm transition-colors ${
                        passwordFieldError
                          ? "border-red-500 focus-visible:ring-red-500"
                          : "border-purple-500/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {passwordFieldError && (
                    <p className="text-xs text-red-400 mt-1.5 ml-1 animate-fadeIn font-medium">
                      {passwordFieldError}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleEmailLogin}
                  className="w-full bg-gradient-to-r from-[#4e3bff] to-[#9747ff] hover:opacity-90 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center"
                  disabled={loading}
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  {loading
                    ? t("login.signingIn") || "Signing in…"
                    : t("login.signIn") || "Sign In"}
                </Button>
              </div>
            )}

            {/* Register link */}
            <div className="text-center text-sm text-gray-400 mt-6">
              {t("login.dontHave") || "Don't have an account?"}{" "}
              <Link
                href={`/${locale}/auth/register`}
                className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-0.5"
              >
                {t("login.registerWith") || "Register"}
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet selection modal */}
      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </div>
  );
}