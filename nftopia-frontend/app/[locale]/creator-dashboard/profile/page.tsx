"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Link2Off,
  Plus,
  Wallet,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useStellarWallet } from "@/components/wallet/hooks/useStellarWallet";
import { WalletModal } from "@/components/wallet/WalletModal";
import { WalletBalance } from "@/components/wallet/WalletBalance";
import { WalletNetworkStatus } from "@/components/wallet/WalletNetworkStatus";
import { getExplorerUrl } from "@/lib/stellar/network";
import {
  LinkedWallet,
  ProfileUser,
  UpdateProfilePayload,
  fetchLinkedWallets,
  fetchProfileByAddress,
  linkWalletWithChallenge,
  updateMyProfile,
} from "@/lib/services/profile";

type ProfileForm = Required<UpdateProfilePayload>;
type FormErrors = Partial<Record<keyof ProfileForm, string>>;

const emptyForm: ProfileForm = {
  username: "",
  bio: "",
  avatarUrl: "",
  bannerUrl: "",
  twitterHandle: "",
  instagramHandle: "",
  website: "",
};

export default function ProfilePage() {
  const { t } = useTranslation();
  const authUser = useAuthStore((state) => state.user);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const getCurrentUser = useAuthStore((state) => state.getCurrentUser);

  const {
    connected,
    address,
    provider,
    network,
    disconnect,
  } = useStellarWallet();

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const profileAddress = authUser?.walletAddress || authUser?.address || address || "";
  const saveWalletAddress = address || authUser?.walletAddress || authUser?.address || "";

  useEffect(() => {
    if (!authUser) {
      const storedUser = getCurrentUser();
      if (storedUser) {
        setAuthUser(storedUser);
      }
    }
  }, [authUser, getCurrentUser, setAuthUser]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!profileAddress) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const [nextProfile, nextWallets] = await Promise.all([
          fetchProfileByAddress(profileAddress),
          fetchLinkedWallets(),
        ]);

        if (!active) return;

        setProfile(nextProfile);
        setForm(toProfileForm(nextProfile));
        setWallets(nextWallets);
      } catch (error) {
        if (active) {
          setMessage({
            type: "error",
            text: error instanceof Error ? error.message : "Failed to load profile.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [profileAddress]);

  const isAlreadyLinked = useMemo(
    () => !!address && wallets.some((wallet) => wallet.walletAddress === address),
    [address, wallets]
  );

  const handleChange = (field: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const errors = validateProfile(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (!saveWalletAddress) {
      setMessage({ type: "error", text: "Connect or authenticate a Stellar wallet before saving." });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMyProfile(saveWalletAddress, form);
      setProfile(updated);
      setForm(toProfileForm(updated));
      setAuthUser({
        ...(authUser || {}),
        ...updated,
        walletAddress: updated.walletAddress || updated.address || saveWalletAddress,
      } as NonNullable<typeof authUser>);
      setMessage({ type: "success", text: "Profile saved successfully." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLinkWallet = async () => {
    if (!address || !provider) {
      setMessage({ type: "error", text: "Connect your wallet before linking it." });
      return;
    }

    setLinking(true);
    setMessage(null);

    try {
      await linkWalletWithChallenge(address, provider);
      setWallets(await fetchLinkedWallets());
      setMessage({
        type: "success",
        text: `Wallet ${shortAddress(address)} linked successfully.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to link wallet.",
      });
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-foreground">
            {t("profile.title") || "Profile"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("profile.subtitle") || "Manage your account and linked wallets"}
          </p>
        </header>

        {message && <StatusMessage type={message.type} text={message.text} />}

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-5 text-lg font-semibold text-card-foreground">Creator Profile</h2>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          ) : !profileAddress ? (
            <p className="text-sm text-muted-foreground">Sign in to edit your profile.</p>
          ) : (
            <form className="space-y-4" onSubmit={handleSaveProfile}>
              <TextField label="Username" value={form.username} error={formErrors.username} onChange={(value) => handleChange("username", value)} maxLength={50} />
              <TextArea label="Bio" value={form.bio} error={formErrors.bio} onChange={(value) => handleChange("bio", value)} />
              <TextField label="Avatar URL" value={form.avatarUrl} error={formErrors.avatarUrl} onChange={(value) => handleChange("avatarUrl", value)} />
              <TextField label="Banner URL" value={form.bannerUrl} error={formErrors.bannerUrl} onChange={(value) => handleChange("bannerUrl", value)} />
              <TextField label="Twitter Handle" value={form.twitterHandle} error={formErrors.twitterHandle} onChange={(value) => handleChange("twitterHandle", value)} placeholder="@handle" maxLength={16} />
              <TextField label="Instagram Handle" value={form.instagramHandle} error={formErrors.instagramHandle} onChange={(value) => handleChange("instagramHandle", value)} placeholder="@handle" maxLength={31} />
              <TextField label="Website" value={form.website} error={formErrors.website} onChange={(value) => handleChange("website", value)} />

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-gradient-to-r from-[#4e3bff] to-[#9747ff] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-card-foreground">
                {t("profile.linkedWallets") || "Linked Stellar Wallets"}
              </h2>
            </div>
            <button
              onClick={() => setWalletModalOpen(true)}
              className="flex items-center gap-1.5 text-sm text-purple-400 transition-colors hover:text-purple-300"
            >
              <Plus className="h-4 w-4" />
              {t("profile.addWallet") || "Add Wallet"}
            </button>
          </div>

          {wallets.length > 0 ? (
            <div className="mb-5 space-y-3">
              {wallets.map((wallet) => (
                <LinkedWalletRow key={wallet.walletAddress} wallet={wallet} />
              ))}
            </div>
          ) : (
            <p className="mb-5 text-sm text-muted-foreground">
              {loading ? "Loading wallets..." : "No wallets linked yet."}
            </p>
          )}

          {connected && address && (
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {t("profile.connectedWallet") || "Connected Wallet"}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-gray-400">{address}</p>
                </div>
                <WalletNetworkStatus network={network} />
              </div>

              <WalletBalance address={address} network={network} className="mb-4" />

              <div className="flex flex-wrap gap-2">
                {!isAlreadyLinked && (
                  <button
                    onClick={handleLinkWallet}
                    disabled={linking}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#4e3bff] to-[#9747ff] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Link2 className="h-4 w-4" />
                    {linking ? "Linking..." : t("profile.linkWallet") || "Link to Account"}
                  </button>
                )}
                <button
                  onClick={disconnect}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <Link2Off className="h-4 w-4" />
                  {t("connectWallet.disconnect") || "Disconnect"}
                </button>
              </div>

              {isAlreadyLinked && (
                <p className="mt-2 flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  This wallet is already linked to your account.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <WalletModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}

function toProfileForm(profile: ProfileUser): ProfileForm {
  return {
    username: profile.username || "",
    bio: profile.bio || "",
    avatarUrl: profile.avatarUrl || "",
    bannerUrl: profile.bannerUrl || "",
    twitterHandle: profile.twitterHandle || "",
    instagramHandle: profile.instagramHandle || "",
    website: profile.website || "",
  };
}

function validateProfile(form: ProfileForm): FormErrors {
  const errors: FormErrors = {};
  const handlePattern = /^@?[A-Za-z0-9_]{1,15}$/;
  const instagramPattern = /^@?[A-Za-z0-9_.]{1,30}$/;

  if (form.username.trim().length > 50) errors.username = "Username must be 50 characters or less.";
  if (form.avatarUrl && (!isValidUrl(form.avatarUrl) || form.avatarUrl.length > 500)) errors.avatarUrl = "Enter a valid avatar URL under 500 characters.";
  if (form.bannerUrl && (!isValidUrl(form.bannerUrl) || form.bannerUrl.length > 500)) errors.bannerUrl = "Enter a valid banner URL under 500 characters.";
  if (form.website && (!isValidUrl(form.website) || form.website.length > 500)) errors.website = "Enter a valid website URL under 500 characters.";
  if (form.twitterHandle && !handlePattern.test(form.twitterHandle)) errors.twitterHandle = "Use a valid Twitter handle, up to 15 characters.";
  if (form.instagramHandle && !instagramPattern.test(form.instagramHandle)) errors.instagramHandle = "Use a valid Instagram handle, up to 30 characters.";

  return errors;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function StatusMessage({ type, text }: { type: "success" | "error"; text: string }) {
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;
  const classes =
    type === "success"
      ? "border-green-500/30 bg-green-900/30 text-green-300"
      : "border-red-500/30 bg-red-900/30 text-red-300";

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function TextField({
  label,
  value,
  error,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-card-foreground">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-purple-400"
      />
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

function TextArea({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-card-foreground">{label}</span>
      <textarea
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-purple-400"
      />
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

function LinkedWalletRow({ wallet }: { wallet: LinkedWallet }) {
  const linkedAt = wallet.createdAt || wallet.lastUsedAt;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20">
          <Wallet className="h-4 w-4 text-purple-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-mono text-sm text-foreground">{shortAddress(wallet.walletAddress)}</p>
            {wallet.isPrimary && (
              <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                Primary
              </span>
            )}
          </div>
          <p className="text-xs capitalize text-muted-foreground">
            {wallet.walletProvider}
            {linkedAt ? ` · Linked ${new Date(linkedAt).toLocaleDateString()}` : ""}
          </p>
        </div>
      </div>
      <a
        href={getExplorerUrl("testnet", undefined, wallet.walletAddress)}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-2 text-purple-400 transition-colors hover:text-purple-300"
        aria-label="View wallet in explorer"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}
