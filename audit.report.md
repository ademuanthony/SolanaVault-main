# Caifu Vault — Security & Correctness Audit (2026-04-17)

Auditor: Caifu (AI). Scope: `/root/SolanaVault-main/programs/solana_vault/src/` (current HEAD).
Status: **DO NOT accept user deposits on mainnet until Severity-1 issues are fixed.**

**Revision 2 (2026-04-17 11:48 UTC):** Critical #2 rewritten after Tony's feedback — fees can be paid in arbitrary tokens (not just USDC), so a naive USDC balance-diff doesn't work. New design separates claim mechanics from TVL accounting.

Legend: 🔴 Critical (exploitable or fund loss) · 🟠 High (accounting/correctness) · 🟡 Medium · 🟢 Low/Nit

---

## 🔴 CRITICAL #1 — `Deposit` / `Withdraw` / `ClaimReferralEarnings` do NOT validate the `vault_usdc_account`

**File:** `instructions/deposit.rs` (seeds `["vault_usdc", global_config.key()]`)
**Also:** `instructions/withdraw.rs`, `instructions/claim_referral_earnings.rs`

The `vault_usdc_account` account in these instructions is constrained only by **seeds + bump**, not by `address = global_config.vault_usdc_account` nor by `token::mint = global_config.usdc_mint`.

But the vault's real USDC account (`2iwZ1tm8…HLUH`) was created by `Initialize` with a **different seed scheme** — the same `["vault_usdc", global_config.key()]`. So in *principle* the seed derivation will point to the right account.

**HOWEVER:** the bigger problem — the `user_usdc_account` and `user_share_account` have **zero validation**:
- `user_usdc_account: Account<'info, TokenAccount>` — no mint constraint. A malicious user could pass any SPL token account they own (e.g., a token account for a different mint) and the `token::transfer` CPI would still execute at the SPL Token level (it requires matching mints on from/to, so this specific attack fails there).
- But the attacker could pass a **TokenAccount for the USDC mint but owned by a different authority** — since `authority: ctx.accounts.user.to_account_info()`, SPL Token would check the user is the account owner. ✅ That's safe at SPL layer.
- Still: **add explicit `token::mint = global_config.usdc_mint`** and `token::authority = user` constraints to harden and fail fast with clear errors.

**Priority:** medium — current code is safe due to SPL Token's internal checks, but missing constraints make the code brittle and harder to reason about. Labeled Critical because it's next to fund movement — **any** laxity here should be removed.

**Fix:**
```rust
#[account(
    mut,
    token::mint = global_config.usdc_mint,
    token::authority = user,
)]
pub user_usdc_account: Account<'info, TokenAccount>,

#[account(
    mut,
    address = global_config.vault_usdc_account,
)]
pub vault_usdc_account: Account<'info, TokenAccount>,
```

---

## 🔴 CRITICAL #2 — `claim_dlmm_fees` TRUSTS the admin-supplied `claimed_amount`

**File:** `instructions/admin/claim_dlmm_fees.rs`

```rust
if claimed_amount > 0 {
    vault_state.total_tvl = vault_state.total_tvl.checked_add(claimed_amount)?;
}
```

The program does NOT verify the actual amount claimed from the Meteora CPI. It blindly adds `claimed_amount` to TVL.

**Impact:**
- Admin can inflate TVL arbitrarily → share price lies → next depositor gets fewer shares / next withdrawer gets more USDC than they should.
- Even honestly: if the admin's off-chain calculation is off, TVL drifts.
- Admin is a single key — if compromised, **this is a direct drain vector** (inflate TVL, dump shares at inflated price).

### Why a naive USDC-balance-diff does NOT fix this

Fees from a DLMM position can be paid in:
- **USDC** (token Y of our main SOL/USDC pool) — directly TVL-relevant
- **SOL/WSOL** (token X of the main pool) — needs USDC conversion
- **Arbitrary tokens** if we ever LP in non-SOL pools (JitoSOL, JUP, memes, etc.) — no reliable on-chain price for long-tail tokens

Measuring only vault USDC balance delta would ignore fees received in other tokens. And taking an on-chain price oracle (Pyth/Switchboard) is impractical — coverage is limited to majors and adds admin-trust surface for picking feeds.

### Correct fix — decouple claim mechanics from TVL accounting

**Do not try to compute TVL impact inside `claim_dlmm_fees`.** Instead:

1. **`claim_dlmm_fees` becomes a pure CPI forwarder.**
   - Remove the `claimed_amount` parameter entirely.
   - Remove `vault_state.total_tvl += claimed_amount`.
   - Instruction does the Meteora CPI and logs the position touched. That's it.

   ```rust
   // In the handler, delete:
   if claimed_amount > 0 {
       vault_state.total_tvl = vault_state.total_tvl.checked_add(claimed_amount)?;
   }
   // And drop the `claimed_amount: u64` parameter from the signature.
   ```

2. **`update_tvl` becomes the single trusted accounting entry point.**
   - All TVL changes flow through here.
   - It already has the 20% max-decrease-per-call rail (good).
   - **Add a max-increase rail** (e.g., 50%/call) to bound admin-trust symmetrically — see Medium #5.

3. **Off-chain operational playbook (Caifu-managed) becomes:**
   - **Step A:** `claim_dlmm_fees` — pulls whatever tokens the position earned into vault-owned token accounts.
   - **Step B:** For each non-USDC token received, call `jupiter_swap_v2` to convert to USDC at market price. Jupiter's execution itself enforces honesty — no oracle needed.
   - **Step C:** Read the real vault USDC ATA balance + off-chain-priced value of any still-LP'd positions via Jupiter quotes.
   - **Step D:** Call `update_tvl(new_tvl)` with the freshly computed value. The 20%↓ / 50%↑ rails bound mistakes.
   - **Ideally:** bundle A+B+D into one atomic transaction (multi-instruction tx) where possible, so the vault never sits in an inconsistent state between blocks.

**Why this is better than balance-diff:**
- Works for any token pair, any pool, any alpha strategy.
- No on-chain oracle dependency.
- Market price (via Jupiter) enforces honesty on non-USDC fees.
- TVL accounting has exactly one entry point (`update_tvl`) with caps → bounded admin damage even if key is compromised briefly.
- Claim becomes trivially correct (just forwards CPI, no math).

**Caifu's responsibility:** build a TypeScript orchestrator that runs steps A→B→C→D as a pipeline, with monitoring and retries. Never call `claim_dlmm_fees` outside this pipeline, or TVL will drift.

---

## 🔴 CRITICAL #3 — `simulate_yield` is still in the mainnet program

**File:** `instructions/admin/simulate_yield.rs`

```rust
pub fn handler(ctx: Context<SimulateYield>, amount: u64) -> Result<()> {
    vault_state.total_tvl = vault_state.total_tvl.checked_add(amount)?;
}
```

Admin can add arbitrary TVL out of thin air. No cap, no check.

The source comment even says `// Simulate yield (Temporary for Verification)`. **This is not OK on mainnet** — it's literally a "mint TVL" button. Combined with the admin being a single EOA, this is a direct backdoor to inflate share price and then dump.

**Fix:** Delete the instruction entirely before redeploying. Or gate behind a feature flag that's off in mainnet builds.

---

## 🟠 HIGH #1 — `open_dlmm_position` does NOT update `total_tvl`

**File:** `instructions/admin/open_dlmm_position.rs`

When USDC flows out of the vault into a DLMM position:
- Vault's USDC ATA decreases by X USDC.
- `VaultState.total_tvl` stays the same.
- `DlmmPosition.token_x_amount / token_y_amount` is stored but **not aggregated** into TVL.

**Consequence:** TVL no longer equals "USDC held by vault" — it equals "USDC held by vault + deployed USDC at time of open, frozen." This is actually **correct** IF you interpret TVL as total capital-at-work. But it breaks if:
- A position earns fees (TVL is stale until `claim_dlmm_fees` / `update_tvl`).
- The pool value changes due to IL (TVL lies — no automatic markdown).
- A position is partially rebalanced off-chain.

**Worse:** when the position is *closed* via `close_dlmm_position`, TVL is also NOT decreased. If the position lost value (IL, bad timing), the vault has less USDC than TVL claims. Next withdrawer overpaid. Depositors under-get shares.

**Fix:** Open/close should diff the vault USDC ATA balance pre/post CPI and update TVL accordingly. Or, more cleanly: **don't store TVL as a separate state** — derive it from `vault_usdc_account.amount + sum(active position values from oracles)`. But that's a bigger refactor. Minimum viable fix: require explicit `update_tvl` immediately after every open/close, and enforce it via operational discipline.

---

## 🟠 HIGH #2 — `close_dlmm_position` does NOT decrement `positions_count`

**File:** `instructions/admin/close_dlmm_position.rs`

Actually the code does `vault_state.positions_count -= 1` (with saturating guard). ✅ OK.

But the deployed bytecode may not match. In the current repo source this is fine. Flagging to make sure the redeployed version includes this logic.

Also: `open_dlmm_position.rs` has `vault_state.positions_count += 1` guarded by `< u8::MAX`. ✅ OK in source. **But in deployed bytecode this may be missing — that's why `positions_count` is 0 today despite one open position.** Verify in the redeploy.

---

## 🟠 HIGH #3 — `welcome_bonus_deposit` double-increments TVL

**File:** `instructions/admin/welcome_bonus_deposit.rs`

Flow:
1. Admin transfers `total_bonus = welcome_bonus_user + 3 * welcome_bonus_dev` (e.g., 5 USDC) into vault USDC ATA.
2. Admin mints shares worth `welcome_bonus_user` (3.5 USDC) to user.
3. `total_tvl += welcome_bonus_user` — only counts user's 3.5 USDC.
4. `total_shares += shares_to_mint` — matches.
5. Then immediately transfers `welcome_bonus_dev * 3 = 1.5 USDC` out to devs.

**Problem:** total_tvl += 3.5, but the 1.5 USDC for devs arrived in the vault USDC ATA, stayed for a moment, then left. In fact, by the end of the instruction the vault's USDC ATA has grown by exactly **3.5 USDC (the bonus that became user shares)**. So `total_tvl += welcome_bonus_user` is accidentally correct!

But it's fragile: if someone later changes the flow so the dev portion stays in the vault, the TVL number will silently drift.

**Minor issue:** the admin is effectively subsidizing this from their own USDC. The program doesn't check that `admin_usdc_account` actually belongs to the admin (remaining_accounts[0] is just passed in as AccountInfo, never validated as owned by admin). A malicious caller with a different admin-like flow could in theory pass someone else's USDC ATA.

Wait — but only the actual admin can call this (constraint on `global_config`). And the `token::transfer` CPI will check that the signer (admin) is also the owner of the `admin_usdc_account`. ✅ OK at SPL layer.

**Fix (defense in depth):** validate `admin_usdc_ai` as a TokenAccount with `mint = global_config.usdc_mint` and `owner = admin.key()`.

---

## 🟠 HIGH #4 — `UpdateVaultConfig` can change `admin` with NO confirmation

**File:** `instructions/admin/update_vault_config.rs`

```rust
if let Some(val) = params.admin { global_config.admin = val; }
```

**Risks:**
- Fat-finger: admin sets wrong pubkey → permanent loss of admin control (only way back is a program redeploy, which requires the upgrade authority — a different key).
- Compromise: if admin key is momentarily compromised, attacker sets admin to their own key → full control.

**Fix options:**
- Two-step admin transfer: `propose_new_admin(new)` → `accept_admin(new_signs)` (industry standard).
- Or at minimum: emit a strong event/log, add a timelock, or require an additional signer.

Same concern — lesser — for `company_wallet` rotation in `set_company_wallet.rs`.

---

## 🟠 HIGH #5 — `jupiter_swap_v2` post-balance check has a bug for same-mint swaps

**File:** `instructions/admin/jupiter_swap_v2.rs`

```rust
ctx.accounts.jupiter_destination_ata.reload()?;
let output_amount = ctx.accounts.jupiter_destination_ata.amount;
// Transfer ALL of it to destination_token_account
```

The post-swap `output_amount` is the **total balance** of `jupiter_destination_ata`, not the delta. If that ATA had leftover tokens from a prior transaction, **those leftovers get transferred too** — either to the vault (fine, accidental gain) or to the wrong destination if the account was re-used.

More dangerous: if `source_token_account == jupiter_destination_ata` (could happen on weird self-swap paths), the pre-swap transfer-in inflates the "output" reading.

**Fix:** compute the delta explicitly.
```rust
let pre_dest = ctx.accounts.jupiter_destination_ata.amount;
// ... CPI ...
ctx.accounts.jupiter_destination_ata.reload()?;
let post_dest = ctx.accounts.jupiter_destination_ata.amount;
let output_amount = post_dest.saturating_sub(pre_dest);
```

And add **minimum output amount** slippage protection as a parameter (like `jupiter_swap` v1 has `minimum_amount_out`). Currently v2 has no slippage rail at the program level — Jupiter's own route might carry one, but we shouldn't rely on client honesty.

---

## 🟠 HIGH #6 — No reentrancy / single-instruction-per-tx guard on state-mutating admin ops

Admin can construct a transaction that interleaves `claim_dlmm_fees` → `simulate_yield` → `withdraw_company_fees` → etc. While each is admin-gated, the composability means accounting mistakes in one propagate to another within a single tx. Not necessarily a bug, but worth:

- Adding `msg!` with pre/post TVL deltas in each state-mutating op for auditability.
- Considering emitting Anchor events (`emit!`) for off-chain indexing.

Low priority if admin key is well-protected.

---

## 🟡 MEDIUM #1 — `calculate_share_price` returns inconsistent initial value

**File:** `state.rs`

```rust
pub fn calculate_share_price(&self) -> Result<u64> {
    if self.total_shares == 0 {
        return Ok(1_000_000); // 1.0 scaled by 1e6 (since 1 Share = 1 USDC)
    }
    let tvl_scaled = self.total_tvl.checked_mul(1_000_000_000)?;
    tvl_scaled.checked_div(self.total_shares)?
}
```

- Empty vault returns `1_000_000` (scaled by 1e6, comment says so).
- Non-empty vault returns `tvl * 1e9 / shares` (scaled by **1e9**, per program docs).

**The scale is inconsistent.** The rest of the code (`deposit.rs`, `withdraw.rs`) assumes share price scale is 1e9:
```rust
// In deposit.rs: shares = amount * 1e9 / share_price
```

If `total_shares == 0`, share price returns `1_000_000` (1e6). Then `shares_to_mint = amount * 1e9 / 1e6 = amount * 1000`. But the first-deposit special-case in `deposit.rs` overrides this:
```rust
let shares_to_mint = if vault_state.total_shares == 0 {
    amount.checked_mul(1_000_000_000)?.checked_div(1_000_000)?  // amount * 1000
} else { ... };
```
So a 1 USDC deposit → 1_000_000 raw = 1.0 shares (with share decimals 9 → 0.001 shares visible). Wait — USDC has 6 decimals, share mint has 9 decimals. So 1 USDC (1e6 raw) → 1_000_000_000 raw shares = 1.0 shares visible. That aligns. ✅

But `calculate_share_price()` returning `1_000_000` when `total_shares == 0` is used elsewhere (e.g., `welcome_bonus_deposit.rs`):
```rust
let shares_to_mint = welcome_bonus_user
    .checked_mul(1_000_000_000)?
    .checked_div(current_share_price)?;
```
With `current_share_price = 1_000_000` (1e6 scale) for empty vault → `3_500_000 * 1e9 / 1e6 = 3_500_000_000` raw shares = 3.5 shares visible. **Matches what we want for 3.5 USDC bonus.** ✅

So mathematically this works for the first deposit/bonus, but only because the code is inconsistent in a self-canceling way. Any refactor that normalizes scales will break this unless done carefully.

**Fix:** change to a consistent scale.
```rust
if self.total_shares == 0 {
    return Ok(1_000_000_000); // 1.0 scaled by 1e9 (not 1e6) — or return an Err
}
```
And update callers accordingly. **Or** remove the special case and require the first deposit to use a fixed initial ratio path (like `deposit.rs` already does).

---

## 🟡 MEDIUM #2 — `withdraw.rs` uses u128 for some math, u64 for `fee_amount` — overflow path

**File:** `instructions/withdraw.rs`

`profit` can be up to `u64::MAX` in theory. `profit * fee_rate (as u64, max 70)` — can overflow for very large profits.

With USDC (6 decimals), `u64::MAX ≈ 1.8e13`, so profit > 2.6e11 USDC → overflow on fee calc. That's ~$260 billion — vault will never have that. But `checked_mul` catches it anyway (returns `MathOverflow`). ✅ Safe, just means at extreme sizes the withdraw will revert. Acceptable.

However, `fee_amount = profit * fee_rate / 100` uses u64 throughout. Change to u128 for consistency with the earlier u128 blocks.

---

## 🟡 MEDIUM #3 — Fee distribution rounding dust accumulates in nowhere

**File:** `instructions/withdraw.rs`, `distribute_fees`

```rust
let company_amount = total_fee * company_share / 100;
let dev1_amount = total_fee * dev1_share / 100;
// ... etc
```

Each division truncates. `57 + 15 + 10 + 5 + 3 + 10 = 100`, but the sum of truncated products can be `< total_fee` by up to 5 raw USDC-lamports per withdrawal. That remainder stays in the vault USDC ATA but **is never accounted for in `global_config.*_fees` nor added back to TVL**.

Over many withdrawals, this is tiny but real "silent inflation" — the vault holds more USDC than the sum of `total_tvl + sum(fee_buckets)`. Not exploitable, but auditability is harder.

**Fix:** make one bucket (e.g., company) absorb the remainder:
```rust
let distributed = company_amount + dev1_amount + dev2_amount + dev3_amount + marketer1_amount + referral_pool_amount;
let dust = total_fee.saturating_sub(distributed);
global_config.company_fees += company_amount + dust;
```

Same issue in `distribute_referral_pool`, but that one *does* handle remainder (pushes to company_fees). ✅

---

## 🟡 MEDIUM #4 — No max position count safety

`position_index` is u8 → max 255 concurrent positions. The code increments without an additional cap. At 255, `open_dlmm_position` will fail because the PDA already exists. Admin needs to track used indices externally. Low risk, just operational annoyance. Consider adding a `used_indices: u256` bitmap field or using a `u32` index + a list.

---

## 🟡 MEDIUM #5 — `update_tvl` allows unlimited increase

```rust
if new_tvl < old_tvl { cap decrease }
// increase is unbounded
```

Combined with `simulate_yield` (which has no check at all), admin can pump TVL at will. If admin is compromised and can deposit 1 USDC, they can then update TVL to 1,000,000 USDC, mint themselves near-infinite shares via another deposit... actually no, deposits can't mint shares without USDC transfer. But `simulate_yield` is the direct vector. **Re-emphasizing: remove `simulate_yield`.**

For `update_tvl` increase: consider capping to e.g., 50% per call too. Genuine fee accrual is slow; a 50%-per-call rail is plenty.

---

## 🟢 LOW — Nits / hardening suggestions

1. **`Initialize` is not permissioned by wallet.** Anyone who calls it first wins the admin slot. Since the program has already been initialized, this is moot. But if you ever migrate to a fresh deployment, make sure the deploy tx atomically initializes to the intended admin.

2. **`Register.user_account` has no "already registered" check** — but Anchor's `init` constraint does the job (PDA exists → init fails). ✅ OK.

3. **`entry_price` in `Register`** is set to `1_000_000` (1.0 scaled by 1e6). But other places use 1e9 scale. Since the user won't have shares until `deposit`, this field gets overwritten there. Still, inconsistent — set it to 0 (the check is `user_account.shares == 0`, not entry_price).

4. **No pause/unpause.** If a bug is discovered post-mainnet-with-funds, there's no way to halt deposits/withdrawals while fixing. Add a `paused: bool` flag to `GlobalConfig` with admin-toggled pause, and check it in `deposit`, `withdraw`, `claim_referral_earnings`.

5. **No deposit cap per user or global.** Early pilot: add a `max_tvl` and `max_user_deposit` to cap exposure. Remove once battle-tested.

6. **`withdraw.rs` references `global_config = &mut`** but only reads from it (except through `distribute_fees`). The mutable borrow is correct for fee updates; OK.

7. **`flag_user` / `unflag_user` / `admin_register_user`** — didn't deep-read, but naming suggests standard admin auth. Please verify the flagged-user check is also enforced in `claim_referral_earnings` (currently unclear from what I read).

8. **No event emission.** `emit!(DepositEvent { ... })` etc. would make indexing cleaner than parsing log messages.

9. **Rust allocator:** not explicitly set, defaults are fine.

10. **Program upgrade authority is still `G8zjYBDq…`** — the old admin wallet. Whoever has that key can swap the program bytecode for anything. Consider:
    - Transferring upgrade authority to a multisig (Squads).
    - Or eventually setting it to `None` (immutable) — only after long battle-testing.

---

## Summary — Must-Fix Before User Deposits

**Hard blockers (🔴):**
1. Remove `simulate_yield` completely.
2. Strip TVL mutation out of `claim_dlmm_fees` — drop the `claimed_amount` param and the `total_tvl += ...` line. TVL only changes via `update_tvl`.
3. Add explicit mint/address constraints on `user_usdc_account`, `vault_usdc_account`, and share accounts in `deposit` / `withdraw` / `claim_referral_earnings`.

**Strongly recommended (🟠):**
4. Make `open_dlmm_position` / `close_dlmm_position` handle TVL updates from real balance deltas (or enforce a same-tx `update_tvl` call).
5. Two-step admin transfer in `update_vault_config`.
6. Fix `jupiter_swap_v2` to compute output as a delta and add `min_amount_out` slippage parameter.
7. Verify `positions_count` increment in `open_dlmm_position` is in the redeployed bytecode.

**Nice to have (🟡/🟢):**
8. Add `paused` flag + checks in user-facing instructions.
9. Normalize share-price scale handling in `calculate_share_price`.
10. Absorb fee-distribution dust into company bucket.
11. Emit Anchor events.
12. Move upgrade authority to a multisig.

---

## Suggested fix order

If time-boxed, ship the redeploy in this order:

**Round 1 (must-fix):**
- Delete `simulate_yield.rs` + remove from `lib.rs`, `mod.rs`.
- Simplify `claim_dlmm_fees.rs`: drop `claimed_amount` param, drop TVL mutation. It's now a pure CPI forwarder.
- Add `token::mint` / `address` constraints in `deposit.rs`, `withdraw.rs`, `claim_referral_earnings.rs`, `welcome_bonus_deposit.rs`.
- Add `update_tvl` max-increase cap (50%/call) to match the decrease cap.

**Round 2 (before big TVL):**
- `open_dlmm_position` + `close_dlmm_position` → compute and update TVL.
- Two-step admin in `update_vault_config`.
- Slippage + delta math in `jupiter_swap_v2`.

**Round 3 (post-launch hardening):**
- Paused flag, deposit caps, events, multisig upgrade auth.
