"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_CONFIG } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CircuitBackground } from "@/components/circuit-background";
import { useTranslation } from "@/hooks/useTranslation";
import { useStellarWallet } from "@/components/wallet/hooks/useStellarWallet";
import { WalletModal } from "@/components/wallet/WalletModal";
import { WalletNetworkStatus } from "@/components/wallet/WalletNetworkStatus";
import { defaultNetwork } from "@/lib/stellar/client";
import {
  Wallet,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

type RegisterMode = "wallet" | "email";

export default function RegisterPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();

  // Stellar wallet
  const {
    connected,
    address,
    provider,
    connecting,
    error: walletError,
    disconnect,
    clearError: clearWalletError,
  } = useStellarWallet();

  // Form state
  const [mode, setMode] = useState<RegisterMode>("wallet");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearAllErrors = () => {
    setError("");
    clearWalletError();
  };

  const switchMode = (m: RegisterMode) => {
    clearAllErrors();
    setMode(m);
  };

  /* ── Wallet registration ── */
  const handleWalletRegister = async () => {
    if (!address) {
      setError("Please connect your Stellar wallet first");
      return;
    }
    clearAllErrors();
    setLoading(true);

    try {
      // Fetch CSRF token
      const csrfRes = await fetch(`${API_CONFIG.baseUrl}/auth/csrf-token`, {
        credentials: "include",
      });
      if (!csrfRes.ok) throw new Error("Failed to fetch CSRF token");
      const { csrfToken } = await csrfRes.json();

      const body: Record<string, string> = { walletAddress: address };
      if (username.trim()) body.username = username.trim();
      if (provider) body.walletProvider = provider;
      body.network = defaultNetwork;

      const response = await fetch(`${API_CONFIG.baseUrl}/users`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Registration failed");
      }

      setSuccess(t("register.success") || "Account created! Redirecting to login…");
      setTimeout(() => router.push(`/${locale}/auth/login`), 2500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Email registration ── */
  const handleEmailRegister = async () => {
    if (!email || !password) {
      setError("Please fill in all required fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    clearAllErrors();
    setLoading(true);

    try {
      const csrfRes = await fetch(`${API_CONFIG.baseUrl}/auth/csrf-token`, {
        credentials: "include",
      });
      if (!csrfRes.ok) throw new Error("Failed to fetch CSRF token");
      const { csrfToken } = await csrfRes.json();

      const body: Record<string, string> = { email, password };
      if (username.trim()) body.username = username.trim();
      // Optionally link wallet if already connected
      if (connected && address) {
        body.walletAddress = address;
        if (provider) body.walletProvider = provider;
      }

      const response = await fetch(`${API_CONFIG.baseUrl}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Registration failed");
      }

      setSuccess(t("register.success") || "Account created! Redirecting to login…");
      setTimeout(() => router.push(`/${locale}/auth/login`), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const displayError = error || walletError;

  return (
    <div className="min-h-[500px] text-white">
      <CircuitBackground />

      <div className="relative z-10 pb-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="border border-purple-500/20 rounded-xl p-8 bg-glass backdrop-blur-md shadow-lg">

            <h2 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
              {t("register.title") || "Create Account"}
            </h2>

            {displayError && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-red-900/50 text-red-300 rounded-lg border border-red-500/30 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {displayError}
              </div>
            )}

            {success && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-green-900/50 text-green-300 rounded-lg border border-green-500/30 text-sm">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                {success}
              </div>
            )}

            {/* Mode tabs */}
            <div className="flex rounded-lg bg-gray-800/50 p-1 mb-6 gap-1">
              <button
                onClick={() => switchMode("wallet")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === "wallet"
                    ? "bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Wallet className="h-4 w-4" />
                {t("register.walletTab") || "Wallet"}
              </button>
              <button
                onClick={() => switchMode("email")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === "email"
                    ? "bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white shadow"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Mail className="h-4 w-4" />
                {t("register.emailTab") || "Email"}
              </button>
            </div>

            {/* Shared: username field */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                {t("register.userName") || "Username"}{" "}
                <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("register.inputPlaceholderTwo") || "Choose a username"}
                  className="w-full bg-gray-800/50 border border-purple-500/20 rounded-lg pl-9 pr-4 py-3 text-sm"
                  maxLength={50}
                />
              </div>
            </div>

            {/* ── WALLET MODE ── */}
            {mode === "wallet" && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    {t("register.walletAddress") || "Stellar Wallet Address"}
                  </label>

                  {connected && address ? (
                    <div className="flex items-center justify-between w-full bg-gray-800/50 border border-green-500/30 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                        <span className="text-sm font-mono text-gray-200 truncate">
                          {address.slice(0, 8)}...{address.slice(-6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <WalletNetworkStatus network={defaultNetwork} />
                        <button
                          onClick={disconnect}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <Input
                      type="text"
                      value=""
                      readOnly
                      className="w-full bg-gray-800/50 border border-purple-500/20 rounded-lg px-4 py-3 text-sm"
                      placeholder={t("register.inputPlaceholderOne") || "Connect wallet to populate"}
                    />
                  )}
                </div>

                <Button
                  onClick={connected ? handleWalletRegister : () => setWalletModalOpen(true)}
                  disabled={loading || connecting}
                  className="w-full py-3 px-4 rounded-lg font-medium transition bg-gradient-to-r from-[#4e3bff] to-[#9747ff] hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  {loading
                    ? t("register.creatingAccount") || "Creating account…"
                    : connecting
                    ? t("register.connecting") || "Connecting…"
                    : connected
                    ? t("register.completeRegistration") || "Complete Registration"
                    : t("register.connectWallet") || "Connect Wallet"}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  {t("register.stellarSecure") ||
                    "Your Stellar public key is used as your account identifier. Your private key never leaves your wallet."}
                </p>
              </div>
            )}

            {/* ── EMAIL MODE ── */}
            {mode === "email" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    {t("register.email") || "Email"}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-gray-800/50 border border-purple-500/20 rounded-lg pl-9 pr-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    {t("register.password") || "Password"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full bg-gray-800/50 border border-purple-500/20 rounded-lg pl-9 pr-10 py-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    {t("register.confirmPassword") || "Confirm Password"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full bg-gray-800/50 border border-purple-500/20 rounded-lg pl-9 pr-4 py-3 text-sm"
                    />
                  </div>
                </div>

                {/* Optional wallet link for email users */}
                {connected && address && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
                    Stellar wallet will be linked to your account.
                  </div>
                )}

                {!connected && (
                  <button
                    onClick={() => setWalletModalOpen(true)}
                    className="w-full text-sm text-purple-400 hover:text-purple-300 flex items-center justify-center gap-1 py-2 transition-colors"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    Also link a Stellar wallet (optional)
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}

                <Button
                  onClick={handleEmailRegister}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg font-medium transition bg-gradient-to-r from-[#4e3bff] to-[#9747ff] hover:opacity-90"
                >
                  {loading
                    ? t("register.creatingAccount") || "Creating account…"
                    : t("register.completeRegistration") || "Complete Registration"}
                </Button>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-gray-400">
              {t("register.alreadyHave") || "Already have an account?"}{" "}
              <a
                href={`/${locale}/auth/login`}
                className="text-purple-400 hover:text-purple-300"
              >
                {t("register.signIn") || "Sign in"}
              </a>
            </div>
          </div>
        </div>
      </div>

      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </div>
  );
}