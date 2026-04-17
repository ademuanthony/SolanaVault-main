/**
 * Step 1 of the two-step admin rotation.
 *
 * Admin rotation is now split across two instructions (audit fix High #4):
 *   1. current admin signs `propose_new_admin(new_admin)` — THIS SCRIPT
 *   2. new admin signs `accept_admin()`                   — scripts/accept_admin.js
 *
 * Running this alone only SETS the pending admin; `global_config.admin` does
 * not change until the new admin proves key control via step 2. Pass `null`
 * (or no value) as NEW_ADMIN_WALLET to cancel an in-flight proposal.
 */
const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function proposeNewAdmin() {
    // ================= CONFIG =================
    const NEW_ADMIN_WALLET = 'H1A4qyRwZQhXL2ohUEw1Rsx1Kgp3WEcKCduMdZNe95xu';
    const PROGRAM_ID = 'G9hoVfjm6QHGMQZpHpVsUGQmSBD6LQaXk9UbD5BzqtWR';
    const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://solana-mainnet.core.chainstack.com/4ed69be823c47a9517d79bd7c873acf6';
    // ==========================================

    let provider;
    try {
        provider = anchor.AnchorProvider.env();
    } catch (e) {
        const connection = new anchor.web3.Connection(RPC_URL, 'confirmed');
        const wallet = process.env.ANCHOR_WALLET
            ? new anchor.Wallet(anchor.web3.Keypair.fromSecretKey(Buffer.from(JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET, 'utf-8')))))
            : anchor.Wallet.local();
        provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    }
    anchor.setProvider(provider);

    console.log('Current Signer:       ', provider.wallet.publicKey.toBase58());
    console.log('Proposing new admin:  ', NEW_ADMIN_WALLET || '(null — cancels proposal)');

    const idl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'target', 'idl', 'solana_vault.json'), 'utf8'));
    const program = new anchor.Program(idl, provider);

    const [globalConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_config')],
        new PublicKey(PROGRAM_ID)
    );
    console.log('Global Config PDA:    ', globalConfigPda.toBase58());

    // Confirm current on-chain admin matches our signer before we try.
    const cfg = await program.account.globalConfig.fetch(globalConfigPda);
    if (!cfg.admin.equals(provider.wallet.publicKey)) {
        console.error('\nERROR: on-chain admin is', cfg.admin.toBase58());
        console.error('       our signer     is', provider.wallet.publicKey.toBase58());
        console.error('       only the current admin can propose a rotation.');
        process.exit(2);
    }

    const newAdminArg = NEW_ADMIN_WALLET ? new PublicKey(NEW_ADMIN_WALLET) : null;

    try {
        const tx = await program.methods
            .proposeNewAdmin(newAdminArg)
            .accounts({
                admin: provider.wallet.publicKey,
                globalConfig: globalConfigPda,
            })
            .rpc();

        console.log('\nProposal submitted:', tx);
        if (newAdminArg) {
            console.log('\nNext step: the proposed admin must run');
            console.log('  node scripts/accept_admin.js');
            console.log('from their wallet (CAIFU_ADMIN_WALLET_PK or ANCHOR_WALLET set to the new key).');
        } else {
            console.log('\nPending admin cleared.');
        }
    } catch (err) {
        console.error('Proposal failed:', err);
        process.exit(1);
    }
}

proposeNewAdmin();
