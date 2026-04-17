const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function updateAdmin() {
    // 1. CONFIGURATION
    const NEW_ADMIN_WALLET = 'H1A4qyRwZQhXL2ohUEw1Rsx1Kgp3WEcKCduMdZNe95xu';
    const PROGRAM_ID = '3TV5FTYziezR5xrp9SAeR6zLU4brnTLQuegjixpBrV1t';
    const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://solana-mainnet.core.chainstack.com/4ed69be823c47a9517d79bd7c873acf6';

    // 2. SETUP PROVIDER
    let provider;
    try {
        provider = anchor.AnchorProvider.env();
    } catch (e) {
        console.log('ANCHOR_PROVIDER_URL not set, defaulting to:', RPC_URL);
        const connection = new anchor.web3.Connection(RPC_URL, 'processed');
        // Setup a basic wallet that can read ANCHOR_WALLET
        const wallet = process.env.ANCHOR_WALLET
            ? new anchor.Wallet(anchor.web3.Keypair.fromSecretKey(Buffer.from(JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET, 'utf-8')))))
            : anchor.Wallet.local();
        provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: 'processed' });
    }
    anchor.setProvider(provider);

    console.log('Current Signer:', provider.wallet.publicKey.toBase58());
    console.log('Target New Admin:', NEW_ADMIN_WALLET);

    // 3. LOAD PROGRAM
    const idlPath = path.join(__dirname, '../target/idl/solana_vault.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    const program = new anchor.Program(idl, provider);

    // 4. DERIVE PDA
    const [globalConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_config')],
        new PublicKey(PROGRAM_ID)
    );

    console.log('Global Config PDA:', globalConfigPda.toBase58());

    // 5. EXECUTE UPDATE
    try {
        const tx = await program.methods
            .updateVaultConfig({
                admin: new PublicKey(NEW_ADMIN_WALLET),
                tier1Threshold: null,
                tier2Threshold: null,
                tier1Fee: null,
                tier2Fee: null,
                tier3Fee: null,
                companyShare: null,
                dev1Share: null,
                dev2Share: null,
                dev3Share: null,
                marketer1Share: null,
                referralPoolShare: null,
                referralL1Share: null,
                referralL2Share: null,
                referralL3Share: null,
                referralL4Share: null,
                referralL5Share: null,
                welcomeBonusUser: null,
                welcomeBonusDev: null,
            })
            .accounts({
                admin: provider.wallet.publicKey,
                globalConfig: globalConfigPda,
            })
            .rpc();

        console.log('Successfully updated admin wallet!');
        console.log('Transaction Signature:', tx);
    } catch (err) {
        console.error('Failed to update admin:', err);
    }
}

updateAdmin();
