# Solana Yield Vault - Project Brief

## What I Need Built

A Solana smart contract (Anchor/Rust) that lets users deposit USDC and earns yield via Meteora DLMM. Includes welcome bonus, tiered performance fees, dev revenue share, and 5-level referrals.

## How It Works

1. New user registers → receives welcome bonus (3.5 USDC)
2. User deposits *USDC only* → receives vault shares
3. Admin manages DLMM positions to generate yield
4. User withdraws → tiered fee deducted → distributed to company/devs/referrals

---

## Core Features

### User Functions
- *Register*: Create account with optional referrer
- *Deposit*: Accept USDC, mint vault shares, record entry price
- *Withdraw*: Burn shares, deduct fees, distribute, return USDC
- *Claim Referral Earnings*: Withdraw accumulated referral rewards

### Admin Functions
- *Swap*: USDC ↔ any token (Jupiter)
- *Open Position*: DLMM with Spot/Bid-Ask/Curve, custom range, ratio, one-sided
- *Close Position*: Remove liquidity
- *Claim Fees*: Collect trading fees
- *Welcome Bonus Deposit*: Deposit 5 USDC for qualifying new users
- *Set Company Wallet*: Update company fee wallet
- *Withdraw Company Fees*: Withdraw accumulated company earnings

### Dev Functions (each dev controls only their own wallet)
- *Set Dev Wallet*: Dev can update their own wallet address only
- *Withdraw Dev Fees*: Withdraw accumulated dev earnings

### Marketer Functions (marketer controls only their own wallet)
- *Set Marketer Wallet*: Marketer can update their own wallet address only
- *Withdraw Marketer Fees*: Withdraw accumulated marketer earnings

---

## Welcome Bonus System

When a new user joins, admin calls welcome_bonus_deposit with *5 USDC* which is distributed as:

| Recipient | Amount |
|-----------|--------|
| New User Account (deposited as shares) | 3.5 USDC |
| Dev 1 Wallet | 0.5 USDC |
| Dev 2 Wallet | 0.5 USDC |
| Dev 3 Wallet | 0.5 USDC |
| *Total Input* | *5.0 USDC* |

*Rules:*
- Admin deposits 5 USDC total
- User receives 3.5 USDC as vault shares
- 1.5 USDC goes directly to the 3 dev wallets (0.5 each)
- Dev wallets are set during initialization
- Each dev can only change their own wallet address

---

## Tiered Performance Fee

Fee rate depends on user's *active deposit value*:

| Active Deposit | Fee on Profit |
|----------------|---------------|
| < $100 | 70% |
| $100 - $499 | 60% |
| ≥ $500 | 50% |

*Example:*
- User has $80 deposited, makes $50 profit → Fee = $50 × 70% = $35
- User has $600 deposited, makes $50 profit → Fee = $50 × 50% = $25

---

## Fee Distribution

When fee is collected on withdrawal, it's split as follows:

| Recipient | Share |
|-----------|-------|
| Company Account | 57% |
| Dev 1 | 15% |
| Dev 2 | 10% |
| Dev 3 | 5% |
| Marketer 1 | 3% |
| Referral Pool (5 levels) | 10% |
| *Total* | *100%* |

### Referral Pool Distribution (10% of fee)

| Level | Share of Referral Pool |
|-------|------------------------|
| Level 1 (direct) | 40% |
| Level 2 | 25% |
| Level 3 | 15% |
| Level 4 | 12% |
| Level 5 | 8% |

---

## Full Withdrawal Example


User: $80 active deposit, $100 profit
Referral chain: B → C → D → E → F (5 levels)

Step 1: Calculate fee
  Fee rate (deposit < $100) = 70%
  Fee = $100 × 70% = $70

Step 2: Distribute fee ($70)
  Company (57%)    = $39.90
  Dev 1 (15%)      = $10.50
  Dev 2 (10%)      = $7.00
  Dev 3 (5%)       = $3.50
  Marketer (3%)    = $2.10
  Referral (10%)   = $7.00

Step 3: Distribute referral pool ($7)
  Level 1 - B (40%) = $2.80
  Level 2 - C (25%) = $1.75
  Level 3 - D (15%) = $1.05
  Level 4 - E (12%) = $0.84
  Level 5 - F (8%)  = $0.56

Step 4: User receives
  Profit - Fee = $100 - $70 = $30
  Total withdrawal = deposit + net profit = $80 + $30 = $110


---

## Account Structures

### Global Config
- admin authority
- company wallet
- dev 1 wallet + authority
- dev 2 wallet + authority
- dev 3 wallet + authority
- marketer 1 wallet + authority
- fee tier thresholds
- fee tier rates
- distribution percentages
- referral level rates

### User Account
- wallet address
- referrer address
- shares owned
- entry share price (weighted avg)
- unclaimed referral earnings
- total referral earnings

### Vault State
- total USDC value
- total shares
- positions data

---

## Tech Stack

- Solana / Anchor Framework
- Meteora DLMM (CPI)
- Jupiter Swap (CPI)
- TypeScript SDK

## Deliverables

1. Anchor program with tests
2. TypeScript SDK
3. Devnet deployment

## Reference

- Meteora DLMM: https://docs.meteora.ag/dlmm/dlmm-overview
- Jupiter: https://station.jup.ag/docs

## Timeline

Open to discussion.