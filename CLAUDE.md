# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SolanaVault (Zolana) is a Solana yield aggregator where users deposit USDC and earn yield through automated Meteora DLMM strategies. It combines an Anchor smart contract, a Next.js frontend, and a TypeScript SDK.

**Program ID**: `G9hoVfjm6QHGMQZpHpVsUGQmSBD6LQaXk9UbD5BzqtWR` (Devnet)

## Commands

### Smart Contract
```bash
yarn install                    # Install all dependencies (root + frontend)
yarn run build                  # anchor build + copy IDL to frontend
anchor build                    # Compile Rust program to BPF, generate IDL
anchor test                     # Run integration tests (starts local validator)
anchor deploy                   # Deploy to devnet
```

### Frontend
```bash
cd frontend && npm run dev      # Start dev server (localhost:3000)
cd frontend && npm run build    # Production build
cd frontend && npm run lint     # ESLint
cd frontend && npm run sync-idl # Copy IDL from anchor build to frontend
```

### Tests
```bash
anchor test                     # Full test suite with local validator
yarn run ts-mocha -p ./tsconfig.json -t 1000000 "tests/**/*.ts"  # Manual test run
```

## Architecture

### Three Layers

**1. Smart Contract** (`programs/solana_vault/src/`)
- `lib.rs` — Program entry point, declares all instructions
- `state.rs` — On-chain account structs: `GlobalConfig`, `VaultState`, `UserAccount`, `DlmmPosition`
- `constants.rs` — Fee tiers, distribution percentages, welcome bonus amounts
- `errors.rs` — Custom error codes
- `instructions/` — One file per instruction, organized into subdirectories:
  - Root: `initialize`, `register`, `deposit`, `withdraw`, `claim_referral_earnings`
  - `admin/` — Position management (open/close/claim DLMM), Jupiter swaps, config updates, user management
  - `dev/` — Dev wallet/fee management
  - `marketer/` — Marketer wallet/fee management

**2. Frontend** (`frontend/`)
- Next.js App Router with pages: landing (`/`), dashboard, admin, referral, leaderboard
- `hooks/useVault.ts` — Central hook (~55KB) that handles all vault interactions: PDA derivation, on-chain state fetching, transaction building for deposits/withdrawals/admin operations
- `hooks/useIsAdmin.ts` — Admin role check against `ADMIN_WALLET_ADDRESS`
- `components/admin/` — Tab-based admin panel (positions, swaps, config, fees, bonuses)
- `sdk/` — Symlinked/copied from root `/sdk/`

**3. SDK** (`sdk/`)
- `vault.ts` — `SolanaVaultClient` class wrapping Anchor `Program<SolanaVault>`
- `jupiter.ts` — Builds CPI calls to Jupiter aggregator for token swaps
- `meteora_dlmm.ts` — Builds CPI calls to Meteora for DLMM position management

### Key On-Chain Accounts (PDAs)
- **GlobalConfig** (seed: `"global_config"`) — Singleton: admin, wallets, fee config, token mints
- **VaultState** (seed: `"vault_state"`) — Total TVL and total shares (share price = TVL * 1e9 / total_shares)
- **UserAccount** (seed: `"user_account" + wallet`) — Per-user shares, entry price, referral earnings, flagged status
- **DlmmPosition** (seed: `"dlmm_position" + position_index`) — Tracks each Meteora DLMM liquidity position

### Yield Flow
1. Users deposit USDC → receive vault shares based on current share price
2. Admin opens Meteora DLMM positions using vault USDC (CPI)
3. Trading fees accrue in DLMM positions
4. Admin claims fees back into vault → increases TVL → share price rises
5. On withdrawal: performance fee is charged on gains, distributed to company/devs/marketer/referral pool

### Fee System
- Tiered performance fees on withdrawal gains: 70% (<$100), 60% ($100-499), 50% ($500+)
- Fee distribution: company 57%, dev1 15%, dev2 10%, dev3 5%, marketer 3%, referral pool 10%
- 5-level referral system: L1 40%, L2 25%, L3 15%, L4 12%, L5 8% of referral pool
- USDC uses 6 decimals; share prices scaled by 1e9

## Toolchain
- **Anchor** 0.32.1, **Solana CLI** 3.1.2, **Rust** 1.92.0
- **Yarn** 4.12.0, **Node** 18+
- **Next.js** 16, **React** 19, **Tailwind CSS** 4

## Environment Variables (Frontend)
- `NEXT_PUBLIC_SOLANA_RPC_URL` — Solana RPC endpoint
- `NEXT_PUBLIC_PROGRAM_ID` — Program address
- `NEXT_PUBLIC_ADMIN_WALLET_ADDRESS` — Admin wallet for frontend guard
