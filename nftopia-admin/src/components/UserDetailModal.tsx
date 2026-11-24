import { useState } from 'react'
import { explorerUrl } from '../utils/explorerUrl'

export interface UserWalletItem {
  id?: string
  walletAddress: string
  walletProvider: string
  isPrimary?: boolean
  createdAt?: string
  lastUsedAt?: string
  /** Native XLM balance (#695); null when the account is unfunded or Horizon was unreachable. */
  balance?: string | null
}

export interface UserAuditItem {
  id: string
  action: string
  adminId: string
  createdAt: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export interface UserDetailData {
  user: {
    id: string
    username?: string
    email?: string
    bio?: string
    avatarUrl?: string
    bannerUrl?: string
    twitterHandle?: string
    instagramHandle?: string
    website?: string
    role: string
    isBanned: boolean
    isEmailVerified?: boolean
    twoFactorEnabled?: boolean
    walletAddress?: string
    walletProvider?: string
    walletConnectedAt?: string
    createdAt: string
    lastLoginAt?: string
  }
  wallets: UserWalletItem[]
  activitySummary: {
    collectionsCount: number
    nftsOwned: number
    nftsCreated: number
  }
  auditTrail: UserAuditItem[]
}

export interface UserDetailModalProps {
  open: boolean
  userId: string | null
  loading?: boolean
  error?: string | null
  detail: UserDetailData | null
  onClose: () => void
  onBanClick: (user: UserDetailData['user']) => void
  onUnbanClick: (user: UserDetailData['user']) => void
  unbanning?: boolean
}

/** Formats a raw Horizon balance string for display (#695); null/undefined means unknown. */
function formatXlmBalance(balance: string | null | undefined): string {
  if (balance == null) return 'Balance unavailable'
  const parsed = Number(balance)
  return Number.isFinite(parsed) ? `${parsed.toFixed(4)} XLM` : 'Balance unavailable'
}

/**
 * Modal displaying complete user profile information, Stellar wallet linkages,
 * activity statistics, and chronological moderation audit trail.
 */
export function UserDetailModal({
  open,
  userId,
  ...props
}: UserDetailModalProps) {
  if (!open || !userId) {
    return null
  }

  return <UserDetailModalContent key={userId} userId={userId} {...props} />
}

function UserDetailModalContent({
  userId,
  loading = false,
  error = null,
  detail,
  onClose,
  onBanClick,
  onUnbanClick,
  unbanning = false,
}: Omit<UserDetailModalProps, 'open'>) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'wallets' | 'activity' | 'moderation'>('profile')

  const copyAddress = (address: string) => {
    void navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const user = detail?.user

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-detail-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-cyan-500/20 text-cyan-300 font-semibold text-lg">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username || 'User'}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                (user?.username?.[0] || user?.email?.[0] || 'U').toUpperCase()
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="user-detail-title" className="text-xl font-bold text-white">
                  {user?.username || user?.email || 'User Account'}
                </h2>
                {user?.isBanned ? (
                  <span className="rounded-md border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
                    Banned
                  </span>
                ) : (
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                    Active
                  </span>
                )}
                {user?.role && (
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-300 uppercase">
                    {user.role}
                  </span>
                )}
              </div>
              <p className="mt-0.5 font-mono text-xs text-slate-400">ID: {userId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              user.isBanned ? (
                <button
                  type="button"
                  onClick={() => onUnbanClick(user)}
                  disabled={unbanning}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {unbanning ? 'Unbanning…' : 'Unban Account'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onBanClick(user)}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
                >
                  Ban Account
                </button>
              )
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close user details modal"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-6 text-xs font-medium text-slate-400">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`border-b-2 py-3 px-3 transition ${
              activeTab === 'profile'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wallets')}
            className={`border-b-2 py-3 px-3 transition ${
              activeTab === 'wallets'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Stellar Wallet ({detail?.wallets?.length || (user?.walletAddress ? 1 : 0)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`border-b-2 py-3 px-3 transition ${
              activeTab === 'activity'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Activity Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('moderation')}
            className={`border-b-2 py-3 px-3 transition ${
              activeTab === 'moderation'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Moderation History ({detail?.auditTrail?.length || 0})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin text-cyan-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Loading account profile and activity…</span>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
              {error}
            </div>
          ) : !user ? (
            <p className="py-12 text-center text-sm text-slate-400">User account not found.</p>
          ) : (
            <>
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email Address</p>
                    <p className="mt-1 text-sm font-medium text-slate-200">{user.email || '—'}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          user.isEmailVerified
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {user.isEmailVerified ? 'Email Verified' : 'Unverified Email'}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          user.twoFactorEnabled
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {user.twoFactorEnabled ? '2FA Enabled' : '2FA Disabled'}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Username</p>
                    <p className="mt-1 text-sm font-medium text-slate-200">{user.username || '—'}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      Joined: {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Last Login:{' '}
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                    </p>
                  </div>

                  {user.bio && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Biography</p>
                      <p className="mt-1 text-sm text-slate-300 leading-relaxed">{user.bio}</p>
                    </div>
                  )}

                  {(user.website || user.twitterHandle || user.instagramHandle) && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Social Links</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-cyan-400">
                        {user.website && (
                          <a href={user.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            Website: {user.website}
                          </a>
                        )}
                        {user.twitterHandle && <span>Twitter: @{user.twitterHandle}</span>}
                        {user.instagramHandle && <span>Instagram: @{user.instagramHandle}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Wallets Tab */}
              {activeTab === 'wallets' && (
                <div className="flex flex-col gap-4">
                  {user.walletAddress && (
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                          Primary Stellar Wallet
                        </span>
                        <span className="text-xs text-cyan-300 font-medium">{user.walletProvider || 'Stellar Wallet'}</span>
                      </div>
                      <p className="mt-2 font-mono text-xs text-slate-200 break-all">{user.walletAddress}</p>
                      <p className="mt-1 text-sm font-semibold text-cyan-200">
                        {formatXlmBalance(
                          detail?.wallets.find((w) => w.walletAddress === user.walletAddress)
                            ?.balance,
                        )}
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => copyAddress(user.walletAddress!)}
                          className="rounded-md border border-cyan-500/40 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20"
                        >
                          {copied ? 'Copied!' : 'Copy Address'}
                        </button>
                        <a
                          href={explorerUrl(user.walletAddress, 'account')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <span>View on Stellar.expert</span>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  )}

                  {detail?.wallets && detail.wallets.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Linked Wallets ({detail.wallets.length})
                      </p>
                      {detail.wallets.map((w, idx) => (
                        <div
                          key={w.id || idx}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-slate-800/40 p-3 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-200">{w.walletProvider}</span>
                            {w.isPrimary && (
                              <span className="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
                                Primary
                              </span>
                            )}
                            <p className="mt-0.5 font-mono text-slate-400 break-all">{w.walletAddress}</p>
                            <p className="mt-0.5 font-medium text-cyan-300">{formatXlmBalance(w.balance)}</p>
                          </div>
                          <a
                            href={explorerUrl(w.walletAddress, 'account')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline"
                          >
                            Explorer ↗
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : !user.walletAddress ? (
                    <p className="text-xs text-slate-400">No Stellar wallet connected yet.</p>
                  ) : null}
                </div>
              )}

              {/* Activity Summary Tab */}
              {activeTab === 'activity' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                    <p className="text-xs font-semibold text-slate-400">Collections Created</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {detail?.activitySummary?.collectionsCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                    <p className="text-xs font-semibold text-slate-400">NFTs Owned</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {detail?.activitySummary?.nftsOwned ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                    <p className="text-xs font-semibold text-slate-400">NFTs Minted</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {detail?.activitySummary?.nftsCreated ?? 0}
                    </p>
                  </div>
                </div>
              )}

              {/* Moderation History Tab */}
              {activeTab === 'moderation' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Audit Trail & Actions
                    </p>
                    <span className="text-xs text-slate-500">
                      Total events: {detail?.auditTrail?.length || 0}
                    </span>
                  </div>

                  {!detail?.auditTrail || detail.auditTrail.length === 0 ? (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
                      No moderation actions recorded for this user account.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-800/40">
                      <table className="min-w-full text-left text-xs">
                        <thead className="border-b border-white/10 bg-white/5 uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-3 py-2.5">Action</th>
                            <th className="px-3 py-2.5">Date & Time</th>
                            <th className="px-3 py-2.5">Admin ID</th>
                            <th className="px-3 py-2.5">Reason / Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {detail.auditTrail.map((log) => {
                            const isBan = log.action === 'BAN_USER'
                            const reason =
                              typeof log.afterState?.reason === 'string'
                                ? log.afterState.reason
                                : '—'

                            return (
                              <tr key={log.id} className="hover:bg-white/[0.02]">
                                <td className="px-3 py-2.5">
                                  <span
                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                      isBan
                                        ? 'bg-red-500/20 text-red-300'
                                        : 'bg-emerald-500/20 text-emerald-300'
                                    }`}
                                  >
                                    {log.action}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-slate-300">
                                  {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-slate-400">
                                  {log.adminId ? `${log.adminId.slice(0, 8)}…` : 'System'}
                                </td>
                                <td className="px-3 py-2.5 text-slate-200">
                                  <p className="max-w-xs truncate" title={reason}>
                                    {reason}
                                  </p>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
