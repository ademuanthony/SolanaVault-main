const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

async function checkConfig() {
    const PROGRAM_ID = 'B3SnRh6Snmk7PvvRHu2o3wDQRpFf1DBMaR9zQpjL4LPx';
    const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://solana-mainnet.core.chainstack.com/4ed69be823c47a9517d79bd7c873acf6';

    const connection = new anchor.web3.Connection(RPC_URL, 'processed');
    const [globalConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_config')],
        new PublicKey(PROGRAM_ID)
    );

    console.log('Fetching Global Config:', globalConfigPda.toBase58());

    // Minimal IDL for fetching
    const idlPath = path.join(__dirname, '../target/idl/solana_vault.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

    // Create a dummy wallet for read-only access
    const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    const program = new anchor.Program(idl, provider);

    try {
        const config = await program.account.globalConfig.fetch(globalConfigPda);
        console.log('Current On-Chain Admin:', config.admin.toBase58());
        console.log('Company Wallet:', config.companyWallet.toBase58());
    } catch (err) {
        console.error('Error fetching config:', err);
    }
}

checkConfig();
