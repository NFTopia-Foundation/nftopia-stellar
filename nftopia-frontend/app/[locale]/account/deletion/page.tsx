"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { API_CONFIG } from "@/lib/config";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";

export default function AccountDeletionVerificationPage() {
  const { locale } = useTranslation();
  const [state, setState] = useState<"verifying" | "complete" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your account deletion request…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      setMessage("The verification link is missing its token. Request a new deletion email from account settings.");
      return;
    }

    fetchWithAuth(`${API_CONFIG.baseUrl}/users/account/deletion/verify`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => response.json())
      .then((result) => {
        setState("complete");
        const deadline = result.deletionFinalizesAt
          ? new Date(result.deletionFinalizesAt).toLocaleString()
          : "in 30 days";
        setMessage(`Your request is verified. Your account is scheduled for deletion ${deadline}. You can cancel it in account settings before then.`);
      })
      .catch((error: unknown) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "This verification link is invalid or expired.");
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col justify-center px-5 py-12 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Account security</p>
      <h1 className="mt-3 text-2xl font-semibold">{state === "complete" ? "Deletion request verified" : state === "error" ? "Verification unavailable" : "Verifying request"}</h1>
      <p className="mt-4 text-sm leading-6 text-slate-300" role={state === "error" ? "alert" : "status"}>
        {message}
      </p>
      <Link
        href={`/${locale}/account/privacy`}
        className="mt-7 inline-flex min-h-11 w-fit items-center border border-white/25 px-4 text-sm text-white hover:border-emerald-300"
      >
        Account privacy settings
      </Link>
    </main>
  );
}
