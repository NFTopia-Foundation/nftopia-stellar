"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type CallbackStatus = "processing" | "success" | "error";

/**
 * Wallet auth callback page.
 *
 * This page handles the redirect-back after wallet auth flows that use
 * an external redirect (e.g. WalletConnect deep-link, or any OAuth-style
 * wallet provider that posts back to a callback URL).
 *
 * For Freighter and Albedo the entire flow is inline, so this page mainly
 * handles edge cases and acts as a loading screen while the auth store
 * finalises the session.
 *
 * Query params expected:
 *   ?token=<jwt>          – JWT returned directly by backend after verification
 *   ?error=<message>      – Error description if auth failed
 */
export default function WalletAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useTranslation();

  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [message, setMessage] = useState("Completing wallet authentication…");

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(decodeURIComponent(error));
      return;
    }

    if (token) {
      // Persist the token from the redirect
      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", token);
      }

      setStatus("success");
      setMessage("Wallet authenticated successfully! Redirecting…");

      setTimeout(() => {
        router.replace(`/${locale}/creator-dashboard`);
      }, 1500);
      return;
    }

    // No token and no error — unexpected state
    setStatus("error");
    setMessage("Authentication could not be completed. Please try again.");
  }, [searchParams, router, locale]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="max-w-sm w-full text-center">
        <div className="border border-purple-500/20 rounded-2xl p-10 bg-gray-900/80 backdrop-blur-md shadow-2xl">

          {status === "processing" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
                  </div>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Authenticating</h2>
              <p className="text-sm text-gray-400">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Success!</h2>
              <p className="text-sm text-gray-400">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-400" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Authentication Failed</h2>
              <p className="text-sm text-red-300 mb-6">{message}</p>
              <button
                onClick={() => router.push(`/${locale}/auth/login`)}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}