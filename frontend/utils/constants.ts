import { PublicKey } from '@solana/web3.js';

// TODO: Replace with the actual Admin Wallet Address
// This is the address that will have access to the /admin routes
export const ADMIN_WALLET_ADDRESS = new PublicKey(
    process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || 'H1A4qyRwZQhXL2ohUEw1Rsx1Kgp3WEcKCduMdZNe95xu'
); 
