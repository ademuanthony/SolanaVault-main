# Admin Operations Guide

This guide describes the administrative functions available in the SolanaVault (Zolana) dashboard.

## Accessing the Admin Dashboard

1. Connect your wallet at `/dashboard`.
2. If your wallet address matches the `ADMIN_WALLET_ADDRESS` configured in `frontend/utils/constants.ts`, you will have access to the Admin tab.

> [!IMPORTANT]
> Admin operations require the wallet to have permissions defined in the `GlobalConfig` account on-chain.

## Key Operations

### 1. Vault Initialization
If the vault is not yet initialized, the Admin Dashboard will prompt you to initialize it. You will need to provide:
- **Company Wallet**: Address for receiving 57% of performance fees.
- **Developer Wallets**: Addresses for the three developers.
- **USDC Mint Address**: The mint address of the USDC token on the current network.

### 2. Managing DLMM Positions
The core yield generation happens through Meteora DLMM.
- **Open Position**: Fill in the pool address, select a strategy (Spot, Curve, or Bid-Ask), and define the bin range and amounts.
- **Close Position**: Closes an active liquidity position and returns funds to the vault.
- **Claim Fees**: Collects trading fees earned by the positions back into the vault TVL.

### 3. Jupiter Swaps
Use the swap interface to convert between USDC and other assets within the vault. This is powered by the Jupiter Aggregator.

### 4. Welcome Bonuses
Admins can manually trigger a `welcome_bonus_deposit` for new users.
- Input the user's wallet address.
- The system verifies eligibility and distributes 3.5 USDC as shares to the user (funded by the admin's deposit of 5 USDC).

### 5. Fee Management
Accumulated fees for the Company, Developers, and Marketer can be viewed and withdrawn individually.

## Technical Details

- **Program ID**: `8ssaGrsiVrJqaUzCEhTfVUj6K1ZpXcdwx9xD9gxZWWvC`
- **Network**: Solana Devnet (currently configured)
- **Jupiter Program**: `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`

## Safety Considerations
- Ensure the vault has sufficient USDC liquidity before opening large DLMM positions.
- Double-check pool addresses and bin ranges to avoid permanent loss or suboptimal yield.
