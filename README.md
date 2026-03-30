# Solana Yield Vault (Zolana)

A high-performance Solana yield aggregator that allows users to deposit USDC and earn yield via automated Meteora DLMM strategies.

## Features

- **Automated Yield**: Earn yield from Meteora DLMM (Dynamic Liquidity Market Maker) pools.
- **Tiered Performance Fees**: Fair fee structure based on your active deposit value.
- **5-Level Referral System**: Earn passive income by inviting friends.
- **Welcome Bonus**: Qualifying new users receive a 3.5 USDC welcome deposit.
- **Secure Architecture**: Built with Anchor/Rust on Solana.

## Tech Stack

- **Smart Contract**: Anchor Framework (Rust)
- **Frontend**: Next.js (React), TypeScript, Tailwind CSS
- **Integrations**: 
  - [Meteora DLMM](https://meteora.ag/) for yield generation.
  - [Jupiter Aggregator](https://jup.ag/) for on-chain swaps.
- **Deployment**: Vercel (Frontend), Solana Devnet (Program)

## Project Structure

- `/programs`: Solana Anchor smart contract source code.
- `/frontend`: Next.js web application.
- `/sdk`: TypeScript SDK for interacting with the program.
- `/tests`: Integration tests for the smart contract.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Solana Tool Suite](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor Framework](https://www.anchor-lang.com/docs/installation)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd SolanaVault
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

### Local Development

1. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Smart Contract**:
   ```bash
   anchor build
   anchor test
   ```

## Deployment

The frontend is designed to be deployed on **Vercel**. See the [Frontend README](./frontend/README.md) for environment variable requirements.

## License

MIT
