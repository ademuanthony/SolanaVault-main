# Caifu — How It Works

## The Problem

Earning yield in DeFi is complicated. Users need to understand liquidity pools, manage positions, monitor markets, and pay high gas fees — all while risking costly mistakes. Most people simply don't bother.

## Our Solution

Caifu is a **"deposit and earn"** vault. Users deposit USDC (a dollar-pegged stablecoin), and our system puts that money to work automatically. No expertise required.

---

## How Users Earn Money

1. **User deposits USDC** into the vault and receives "shares" — think of these like shares in a mutual fund.

2. **We deploy that USDC** into Meteora DLMM liquidity pools on Solana. These pools power token trading on decentralized exchanges. Every time someone makes a trade through these pools, a small trading fee is generated.

3. **Trading fees accumulate** and flow back into the vault. As the vault's total value grows, each share becomes worth more.

4. **When a user withdraws**, their shares are worth more than when they deposited. The difference is their profit.

**Simple example:** A user deposits $1,000. Over time, trading fees grow the vault by 10%. Their shares are now worth $1,100. They withdraw and pocket $100 in profit (minus a performance fee — see below).

---

## How Caifu Earns Revenue

We only make money **when users make money**. Revenue comes from a **performance fee on profits only** — never on the original deposit.

### Fee Structure

| User Profit | Our Fee |
|---|---|
| Under $100 | 70% of profit |
| $100 – $499 | 60% of profit |
| $500+ | 50% of profit |

**Example:** A user deposits $1,000 and earns $600 in profit. We take 50% of the $600 profit ($300). The user walks away with $1,300 total — a 30% net return. We keep $300.

### Where the Revenue Goes

| Allocation | Share |
|---|---|
| Company | 57% |
| Development team | 30% |
| Marketing | 3% |
| Referral rewards | 10% |

---

## Built-In Growth Engine: Referral System

Caifu has a **5-level referral program** funded directly from performance fees. When a referred user earns profit, a portion of the fee is distributed up the referral chain. This creates organic, incentivized growth without additional marketing spend.

---

## Why This Works

- **For users:** Passive yield on stablecoins with zero effort. No trading knowledge needed.
- **For us:** Aligned incentives — we only earn when users earn. Higher TVL (total value locked) = more capital deployed = more trading fees = more revenue.
- **For investors:** Revenue scales directly with TVL. Every dollar of new deposits is a dollar generating fees.

## Tech at a Glance

- Built on **Solana** — fast, cheap transactions (fractions of a cent per tx)
- Yield sourced from **Meteora DLMM** — a leading Solana liquidity protocol
- Smart contract handles all accounting on-chain — fully transparent and auditable
- Swaps routed through **Jupiter** — Solana's top aggregator for best execution

---

*Caifu turns complex DeFi yield strategies into a simple savings-like experience — and takes a cut only when it delivers results.*
