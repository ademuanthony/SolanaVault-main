# How DLMM Works — A Deeper Look

*This document expands on the yield mechanism described in [pitch.md](pitch.md).*

---

## What Is a DLMM?

DLMM stands for **Dynamic Liquidity Market Maker**. It is a type of decentralized exchange (DEX) protocol — specifically, a concentrated liquidity AMM built by **Meteora** on Solana.

In simple terms: a DLMM is a system that lets people trade tokens with each other without a traditional order book or middleman. Instead of matching buyers and sellers directly, trades execute against **liquidity pools** — pools of tokens deposited by liquidity providers (LPs). Caifu acts as an LP on behalf of its users.

---

## The Basics: How Any AMM Works

To understand DLMM, start with how a basic AMM works:

1. **Two tokens sit in a pool** — for example, USDC and SOL.
2. **A trader wants to swap** USDC for SOL. They send USDC into the pool and receive SOL out of it.
3. **The pool charges a small fee** on every trade (e.g., 0.1%–1%). This fee is paid to the liquidity providers who deposited the tokens.
4. **Liquidity providers earn** a share of every trading fee proportional to how much liquidity they contributed.

The core idea: LPs deposit tokens, traders use those tokens, and LPs earn fees for providing that service.

---

## What Makes DLMM Different: Price Bins

Traditional AMMs (like Uniswap v2 or Raydium constant-product pools) spread liquidity across the **entire price range** from zero to infinity. This is simple but inefficient — most of that liquidity sits at prices far from the current market price and never gets used.

Meteora's DLMM introduces **price bins**:

### How Bins Work

- The entire price range is divided into discrete **bins**, each representing a narrow price interval.
- Each bin holds liquidity for **one specific price point** (or a very narrow range around it).
- When a trade happens, it consumes liquidity from the **active bin** — the bin that contains the current market price.
- As the price moves, the active bin shifts, and the next bin's liquidity is used.

**Think of it like a shelf of jars.** Each jar holds tokens at a specific price. When someone buys, they take from the jar at the current price. When that jar empties, the next jar becomes active.

### Why Bins Matter

- **Capital efficiency:** LPs concentrate their tokens exactly where trading happens, so every dollar of liquidity works harder and earns more fees.
- **Precise positioning:** LPs choose which bins to place liquidity in, giving them control over their price exposure.
- **Zero slippage within a bin:** Trades that fit within a single bin execute at a fixed price — no price curve, no slippage.

---

## How Caifu Uses DLMM

Here is the step-by-step flow of how user deposits become yield:

### 1. Deposit

A user deposits USDC into the Caifu vault. They receive vault shares representing their proportional ownership.

### 2. Position Opening

The Caifu admin opens a **DLMM position** on Meteora. This involves:

- Selecting a **trading pair** (e.g., SOL/USDC).
- Choosing which **price bins** to place liquidity in — typically bins around the current market price where most trading activity occurs.
- Depositing vault USDC (and potentially the paired token) into those bins via a CPI (cross-program invocation) call to the Meteora DLMM program.

### 3. Fee Accrual

Every time a trader swaps through the pool and their trade touches a bin where Caifu has liquidity:

- A **trading fee** is charged (set by the pool — commonly 0.1% to 1% per trade).
- Caifu's share of that fee is proportional to how much of the bin's liquidity Caifu provided.
- Fees accumulate on-chain inside the DLMM position and can be claimed at any time.

**Key insight:** The more trading volume flows through the bins where Caifu has liquidity, the more fees accumulate. High-volume pairs and well-positioned bins generate more yield.

### 4. Fee Claiming

The admin periodically claims accrued fees from the DLMM position back into the vault. This increases the vault's total USDC holdings (TVL), which in turn increases the share price.

### 5. Position Management

Markets move. The admin actively manages positions by:

- **Closing** positions in bins that are no longer near the active price (no longer earning fees).
- **Opening** new positions in bins around the new market price.
- **Rebalancing** the token mix — if the pool paid out fees in SOL, the admin swaps SOL back to USDC via Jupiter (Solana's leading swap aggregator) so the vault remains USDC-denominated.

### 6. Withdrawal

When a user withdraws, their shares are redeemed at the current (higher) share price. The difference between their entry price and the current price is their profit. A performance fee is taken on the profit only.

---

## Risks and How Caifu Manages Them

### Impermanent Loss (IL)

When an LP provides liquidity to a trading pair and the price moves significantly, the LP can end up with less value than if they had simply held the tokens. This is called impermanent loss.

**How Caifu mitigates this:**
- Positions are concentrated in narrow bins close to market price, so they earn maximum fees to offset any IL.
- Active management moves positions to follow the market rather than leaving them static.
- The vault is USDC-denominated — non-USDC tokens received as fees are swapped back to USDC promptly, limiting directional exposure.

### Low Trading Volume

If a pool has little trading activity, fee generation is low.

**How Caifu mitigates this:**
- The admin selects high-volume pairs where trading activity is consistent.
- Positions can be moved between pools as market conditions change.

### Smart Contract Risk

All DeFi protocols carry the risk of bugs in smart contracts.

**How Caifu mitigates this:**
- Meteora is one of the most established protocols on Solana with significant TVL and audit history.
- Caifu's own smart contract handles accounting on-chain, providing full transparency.

---

## DLMM vs. Traditional Finance Analogy

| Concept | DLMM Equivalent | Traditional Finance Equivalent |
|---|---|---|
| Liquidity provider | Depositing tokens into price bins | Market maker quoting bid/ask prices |
| Trading fee | Fee per swap through a bin | Bid-ask spread earned by market maker |
| Price bin | Discrete price point with liquidity | Limit order at a specific price |
| Active bin | The bin at current market price | The current best bid/ask |
| Position management | Moving liquidity to new bins | Market maker adjusting quotes |

In essence, Caifu turns its users into **automated market makers** — earning the spread on every trade — without requiring them to understand any of the mechanics.

---

## Summary

1. Users deposit USDC into Caifu.
2. Caifu deploys that USDC into Meteora DLMM price bins where trading is active.
3. Every trade through those bins generates a fee for Caifu.
4. Fees are claimed back into the vault, increasing the share price.
5. Users withdraw at a higher share price and keep their profit (minus a performance fee).

The DLMM model ensures capital is used efficiently, fees are maximized, and the entire process is transparent and on-chain.
