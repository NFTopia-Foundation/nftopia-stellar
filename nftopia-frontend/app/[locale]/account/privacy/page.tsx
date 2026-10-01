"use client";

import { useEffect, useState } from "react";
import { Download, ShieldAlert, XCircle } from "lucide-react";
import { API_CONFIG } from "@/lib/config";
import { fetchWithAuth } from "@/lib/api/fetchWithAuth";

type DeletionStatus = {
  pending: boolean;
  requestedAt?: string;
  finalizesAt?: string;
};

type ExportFormat = "json" | "csv" | "zip";

export default function AccountPrivacyPage() {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [deletion, setDeletion] = useState<DeletionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refreshStatus = async () => {
    try {
      const response = await fetchWithAuth(`${API_CONFIG.baseUrl}/users/account/deletion`);
      setDeletion(await response.json());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load account status.");
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const exportData = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetchWithAuth(
        `${API_CONFIG.baseUrl}/users/export?format=${format}`,
      );
      let downloadResponse = response;
      if (response.status === 202) {
        const { jobId } = (await response.json()) as { jobId: string };
        setMessage("Preparing your export…");
        const deadline = Date.now() + 10 * 60 * 1000;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          const statusResponse = await fetchWithAuth(
            `${API_CONFIG.baseUrl}/users/export/jobs/${encodeURIComponent(jobId)}`,
          );
          if (statusResponse.status !== 202) {
            downloadResponse = statusResponse;
            break;
          }
        }
        if (downloadResponse.status === 202) {
          throw new Error("Export is taking longer than expected. Check again later.");
        }
      }
      const file = await downloadResponse.blob();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      const disposition = downloadResponse.headers.get("Content-Disposition");
      const fileName = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
      anchor.download = fileName || `nftopia-data.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Your data export is ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const requestDeletion = async () => {
    setBusy(true);
    setMessage("");
    try {
      await fetchWithAuth(`${API_CONFIG.baseUrl}/users/account?confirm=true`, {
        method: "DELETE",
      });
      setMessage("We sent a verification link to your verified email address.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request account deletion.");
    } finally {
      setBusy(false);
    }
  };

  const cancelDeletion = async () => {
    setBusy(true);
    setMessage("");
    try {
      await fetchWithAuth(`${API_CONFIG.baseUrl}/users/account/deletion/cancel`, {
        method: "POST",
      });
      setDeletion({ pending: false });
      setMessage("Your account deletion request was cancelled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not cancel deletion.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Account</p>
      <h1 className="mt-2 text-2xl font-semibold">Privacy and data</h1>

      <section className="mt-8 border-y border-white/15 py-6">
        <h2 className="text-lg font-medium">Export your data</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm text-slate-300">
            Format
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as ExportFormat)}
              className="h-11 min-w-36 border border-white/20 bg-slate-900 px-3 text-white"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="zip">ZIP archive</option>
            </select>
          </label>
          <button
            type="button"
            onClick={exportData}
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 border border-cyan-300/50 px-4 text-sm text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download export
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">Up to three exports are available every 24 hours.</p>
      </section>

      <section className="border-b border-white/15 py-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-medium">Delete account</h2>
            {deletion?.pending ? (
              <>
                <p className="mt-2 text-sm text-slate-300">
                  Deletion is scheduled for {deletion.finalizesAt ? new Date(deletion.finalizesAt).toLocaleString() : "30 days after verification"}.
                </p>
                <button
                  type="button"
                  onClick={cancelDeletion}
                  disabled={busy}
                  className="mt-4 inline-flex h-11 items-center gap-2 border border-white/25 px-4 text-sm hover:border-emerald-300 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Cancel deletion
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-300">We’ll email a verification link to your verified email. Your account remains recoverable for 30 days after verification.</p>
                <button
                  type="button"
                  onClick={requestDeletion}
                  disabled={busy}
                  className="mt-4 h-11 border border-red-300/50 px-4 text-sm text-red-200 hover:bg-red-400/10 disabled:opacity-50"
                >
                  Request account deletion
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {message && <p className="mt-4 text-sm text-slate-200" role="status">{message}</p>}
    </main>
  );
}
