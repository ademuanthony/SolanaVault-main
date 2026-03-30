md
# Solana Yield Vault - Project Brief

## What I Need Built

A Solana smart contract (Anchor/Rust) that lets users deposit USDC and earns yield via Meteora DLMM. Includes welcome bonus, tiered performance fees, dev revenue share, and 5-level referrals.

## How It Works

1. New user registers → receives welcome bonus (3.5 USDC)
2. User deposits **USDC only** → receives vault shares
3. Admin manages DLMM positions to generate yield
4. User withdraws → tiered fee deducted → distributed to company/devs/referrals

---

## Core Features

### User Functions
- **Register**: Create account with optional referrer
- **Deposit**: Accept USDC, mint vault shares, record entry price
- **Withdraw**: Burn shares, deduct fees, distribute, return USDC
- **Claim Referral Earnings**: Withdraw accumulated referral rewards

### Admin Functions
- **Admin Registration**: Admin should be able to register a wallet by providing the wallet address and the referral address
- **Swap**: USDC ↔ any token (Jupiter)
- **Open Position**: DLMM with Spot/Bid-Ask/Curve, custom range, ratio, one-sided
- **Close Position**: Remove liquidity
- **Claim Fees**: Collect trading fees
- **Welcome Bonus Deposit**: Deposit 5 USDC for qualifying new users
- **Set Company Wallet**: Update company fee wallet
- **Withdraw Company Fees**: Withdraw accumulated company earnings

### Dev Functions (each dev controls only their own wallet)
- **Set Dev Wallet**: Dev can update their own wallet address only
- **Withdraw Dev Fees**: Withdraw accumulated dev earnings

---

## Welcome Bonus System

When a new user joins, admin calls `welcome_bonus_deposit` with **5 USDC** which is distributed as:

| Recipient | Amount |
|-----------|--------|
| New User Account (deposited as shares) | 3.5 USDC |
| Dev 1 Wallet | 0.5 USDC |
| Dev 2 Wallet | 0.5 USDC |
| Dev 3 Wallet | 0.5 USDC |
| **Total Input** | **5.0 USDC** |

**Rules:**
- Admin deposits 5 USDC total
- User receives 3.5 USDC as vault shares
- 1.5 USDC goes directly to the 3 dev wallets (0.5 each)
- Dev wallets are set during initialization
- Each dev can only change their own wallet address

---

## Tiered Performance Fee

Fee rate depends on user's **active deposit value**:

| Active Deposit | Fee on Profit |
|----------------|---------------|
| < $100 | 70% |
| $100 - $499 | 60% |
| ≥ $500 | 50% |

**Example:**
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
| **Total** | **100%** |

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

---

# Frontend Requirements

## Tech Stack

- Next.js / React
- TypeScript
- Tailwind CSS
- Wallet Adapter (@solana/wallet-adapter)
- Anchor client integration

---

## Pages & Features

### 1. Landing Page
- Hero section explaining the vault
- Current APY / total value locked (TVL) stats
- How it works (simple 3-step graphic)
- CTA to connect wallet and start

### 2. User Dashboard

**Connect Wallet Flow:**
- Support Phantom, Solflare, Backpack
- If new user → prompt to enter referral code (optional)
- Auto-create user account on first deposit

**Portfolio Section:**
- Current deposit value (USDC)
- Current shares owned
- Entry share price vs current share price
- Unrealized profit/loss
- Fee tier indicator (shows current tier: 70%/60%/50%)

**Actions:**
| Action | UI |
|--------|-----|
| Deposit | Input USDC amount → preview shares to receive → confirm |
| Withdraw | Input shares or "Max" → preview USDC to receive (after fees) → confirm |

**Fee Breakdown on Withdraw Preview:**

Withdrawing: 100 shares
Current value: $150
Your deposit: $100
Profit: $50
Fee (60%): -$30
You receive: $120


### 3. Referral Page

**My Referral Link:**
- Display unique referral link/code
- Copy button
- Share buttons (Twitter, Telegram, WhatsApp)

**Referral Stats:**
- Total referrals (direct + downstream)
- Referral tree visualization (5 levels)
- Total earnings (lifetime)
- Unclaimed earnings
- Claim button

**Referral Table:**
| Wallet | Level | Their Deposits | Your Earnings |
|--------|-------|----------------|---------------|
| 7xK2...3mF | 1 | $500 | $12.50 |
| 9aB1...2nQ | 2 | $200 | $3.20 |

### 4. Leaderboard (Optional)
- Top depositors
- Top referrers
- Weekly/monthly/all-time filters

### 5. Transaction History
- All user transactions (deposits, withdrawals, referral claims)
- Date, type, amount, tx signature (link to Solscan)

---

## Admin Dashboard (Separate Interface)

### Authentication
- Wallet-based auth (only admin wallet can access)

### Overview Stats
- Total TVL
- Total users
- Total positions value
- Pending fees to collect
- Company/Dev accumulated fees

### Position Management

**View Positions:**
| Pool | Strategy | Range | Token X | Token Y | Value | Fees Earned |
|------|----------|-------|---------|---------|-------|-------------|
| SOL/USDC | Curve | 80-120 | 50 SOL | 2000 USDC | $8,500 | $125 |

**Open Position Form:**
- Select DLMM pool (dropdown or paste address)
- Select strategy: Spot / Bid-Ask / Curve
- Set bin range (min price, max price)
- Set amounts: Token X / Token Y
- Ratio slider (0-100% for one-sided)
- Preview button → show position details
- Confirm & sign

**Close Position:**
- Select position → close → funds return to vault

**Rebalance:**
- Adjust existing position range/amounts

### Swap Interface
- From token / To token selector
- Amount input
- Jupiter route preview
- Execute swap

### Welcome Bonus Management
- Input user wallet address
- Check if eligible (new user, not yet received bonus)
- Execute welcome bonus deposit (5 USDC)
- Bulk upload CSV for multiple users (optional)

### Fee Management
- View accumulated fees per recipient (Company, Dev1, Dev2, Dev3)
- Withdraw buttons for each
- Fee configuration (if changeable):
  - Tier thresholds
  - Distribution percentages
  - Referral level rates

### User Management
- Search user by wallet
- View user details: deposits, shares, referrer, referrals, earnings
- Flag/unflag accounts (if needed)

---

## UI Components Needed

| Component | Description |
|-----------|-------------|
| WalletButton | Connect/disconnect wallet |
| DepositModal | Amount input, preview, confirm |
| WithdrawModal | Shares input, fee breakdown, confirm |
| StatCard | Display single stat (TVL, APY, etc.) |
| ReferralTree | Visual tree of 5 levels |
| PositionCard | Show DLMM position details |
| TxHistoryTable | Paginated transaction list |
| FeeBreakdown | Visual breakdown of fee distribution |
| TierIndicator | Show user's current fee tier |

---

## Notifications & Feedback

- Toast notifications for tx success/failure
- Loading states during transactions
- Error handling with clear messages
- Confirmation modals for important actions

---

## Mobile Responsive

- All pages must work on mobile
- Bottom navigation on mobile
- Touch-friendly buttons and inputs

---

## Deliverables

1. User-facing app (Next.js)
2. Admin dashboard (can be separate app or protected routes)
3. Mobile responsive
4. Deployed to Vercel or similar

---