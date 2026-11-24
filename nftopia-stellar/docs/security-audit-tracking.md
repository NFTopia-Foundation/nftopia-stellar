# Third-Party Security Audit — Tracking & Remediation (#687)

This tracks engaging a third-party Soroban-specialized auditor for the
contracts that hold funds or control asset ownership, and defines how a
finding moves from reported to resolved. It also states the hard gate on
mainnet deployment.

## Mainnet-readiness gate

> **No contract in this workspace is deployed to Stellar mainnet until:**
> 1. The initial audit pass (scope below) is complete, and
> 2. Every **critical** and **high** severity finding from that pass is
>    remediated and re-tested (see [Remediation process](#remediation-process)).
>
> Medium/low findings do not block mainnet, but must be triaged and have a
> tracked resolution plan (fix now, fix post-launch, or explicitly accepted
> risk with a documented reason) before launch.

This gate applies regardless of how confident the team is in the code —
`execute_trade`, `release_escrow`, and the fee/royalty paths have already
had real correctness bugs found and fixed by internal review (see git
history on `marketplace_settlement`); an independent pass is exactly what
catches what internal review structurally can't.

## Scope of the initial audit pass

In priority order — contracts that move funds or transfer ownership first:

1. **`marketplace_settlement`** — escrow, atomic swaps, trades, auctions,
   bundle sales, fee/royalty distribution, dispute resolution, withdrawal
   anomaly detection. This is the contract that actually moves XLM/tokens
   and NFT ownership between parties; it is the highest-priority target.
2. **`nft_contract`** — minting, burning, transfer, approval, royalty
   configuration, access control (minter/burner/metadata-updater roles).
3. Out of initial scope, revisit once the above is remediated:
   `transaction_contract`, `collection_factory`.

For each in-scope contract, the audit should at minimum cover:

- Reentrancy and cross-contract call safety (every `env.invoke_contract`
  call site).
- Authorization: every state-changing entrypoint's `require_auth()`
  actually authorizes the right party, not just *some* party.
- Integer overflow/underflow on fee, royalty, and balance arithmetic.
- Rounding and precision in fee/royalty splits (can a party receive more
  or less than the on-paper split through rounding?).
- Pause/blocklist/rate-limit bypass paths.
- Storage exhaustion / unbounded-growth vectors (e.g. unbounded bid
  history, unbounded escrow holdings per transaction).
- Front-running and MEV exposure on auctions and trades.
- Upgrade/admin-key risk: what a compromised admin key can and can't do.

## Engaging an auditor

- [ ] Shortlist 2-3 firms with **published Soroban or Stellar-specific**
      audit experience (a generic EVM/Solidity audit background is not a
      substitute — Soroban's storage model, auth model, and resource
      metering produce bug classes a Solidity-only auditor won't be
      looking for).
- [ ] Share scope (above) and the current `main` commit hash being audited
      — pin it; don't audit a moving target.
- [ ] Confirm the firm's standard deliverable includes: a written report
      with severity-rated findings, reproduction steps or a PoC per
      finding, and a free re-test pass on fixes (most reputable firms
      include one re-test round in their base engagement).
- [ ] Get a fixed-scope quote and timeline in writing before starting.
- [ ] Sign the engagement; set the pinned commit as the record of what was
      actually reviewed.

## Remediation process

**Severity triage** (apply the auditor's own rating if given; this is the
fallback definition when it isn't):

| Severity | Definition | Mainnet gate |
| --- | --- | --- |
| Critical | Direct loss or theft of funds/NFTs, or a way to bypass authorization entirely | Blocks mainnet |
| High | Funds/NFTs at risk under a plausible but non-trivial attack, or a DoS of a core flow | Blocks mainnet |
| Medium | Incorrect behavior with limited blast radius (e.g. a wrong fee split, a griefing vector with no direct loss) | Tracked, does not block |
| Low | Code quality, gas/resource inefficiency, defense-in-depth suggestions | Tracked, does not block |

**Fix-and-retest workflow**, per finding:

1. Open a tracking issue per finding, tagged with its severity and the
   auditor's finding ID, linking the report.
2. Implement the fix with a regression test that fails on the
   pre-fix code and passes after (same convention as the rest of this
   workspace's test suite — see e.g. `atomic_swap.rs`'s and
   `settlement_core.rs`'s existing test coverage).
3. Request the auditor's re-test pass (or, if outside the included
   re-test window, an independent internal review) confirming the fix
   actually closes the finding and doesn't reopen a different one.
4. Close the tracking issue only once re-tested and merged to `main`.
5. Update this document's [Status](#status) table.

## Status

| Item | Status |
| --- | --- |
| Auditor shortlisted | Not started |
| Auditor engaged | Not started |
| Audit commit pinned | Not started |
| Report received | Not started |
| Critical findings remediated | N/A |
| High findings remediated | N/A |
| Medium/low findings triaged | N/A |
| Mainnet-readiness gate cleared | **No — blocked on the above** |

Update this table as the engagement progresses. Do not remove the gate row
until it is genuinely true.
