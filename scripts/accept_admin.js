/**
 * Step 2 of the two-step admin rotation.
 *
 * Must be signed by the pending admin (the wallet that was passed into
 * `propose_new_admin`). On success, `global_config.admin` is swapped and
 * `pending_admin` is cleared.
 *
 * Before running: set ANCHOR_WALLET to the new admin's keypair file, or
 * export CAIFU_ADMIN_WALLET_PK with the new admin's secret (JSON array /
 * hex / base58 — same loader pattern as the other scripts).
 */
const anchor = require('@coral-xyz/anchor');
const { PublicKey, Keypair, Connection } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function loadSigner() {
    const pk = process.env.CAIFU_ADMIN_WALLET_PK;
    if (pk) {
        let secret;
        if (pk.startsWith('[')) secret = Uint8Array.from(JSON.parse(pk));
        else if (/^[0-9a-fA-F]+$/.test(pk)) secret = Uint8Array.from(Buffer.from(pk, 'hex'));
        else secret = require('bs58').decode(pk);
        return Keypair.fromSecretKey(secret);
    }
    const walletPath = process.env.ANCHOR_WALLET;
    if (!walletPath) {
        throw new Error('Set ANCHOR_WALLET or CAIFU_ADMIN_WALLET_PK to the new admin keypair.');
    }
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf-8'))));
}

async function acceptAdmin() {
    const PROGRAM_ID = 'G9hoVfjm6QHGMQZpHpVsUGQmSBD6LQaXk9UbD5BzqtWR';
    const RPC_URL = process.env.ANCHOR_PROVIDER_URL || 'https://solana-mainnet.core.chainstack.com/4ed69be823c47a9517d79bd7c873acf6';

    const newAdminKp = loadSigner();
    const connection = new Connection(RPC_URL, 'confirmed');
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(newAdminKp), { commitment: 'confirmed' });
    anchor.setProvider(provider);

    const idl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'target', 'idl', 'solana_vault.json'), 'utf8'));
    const program = new anchor.Program(idl, provider);

    const [globalConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_config')],
        new PublicKey(PROGRAM_ID)
    );

    const cfg = await program.account.globalConfig.fetch(globalConfigPda);
    console.log('Current admin:   ', cfg.admin.toBase58());
    console.log('Pending admin:   ', cfg.pendingAdmin ? cfg.pendingAdmin.toBase58() : '(none)');
    console.log('Our signer:      ', newAdminKp.publicKey.toBase58());

    if (!cfg.pendingAdmin) {
        console.error('\nERROR: no pending admin proposal on-chain. Run scripts/update_admin.js first.');
        process.exit(2);
    }
    if (!cfg.pendingAdmin.equals(newAdminKp.publicKey)) {
        console.error('\nERROR: our signer does not match pending_admin.');
        console.error('       The proposed successor must sign this script.');
        process.exit(2);
    }

    try {
        const tx = await program.methods
            .acceptAdmin()
            .accounts({
                newAdmin: newAdminKp.publicKey,
                globalConfig: globalConfigPda,
            })
            .rpc();
        console.log('\nAdmin rotated:', tx);
    } catch (err) {
        console.error('Accept failed:', err);
        process.exit(1);
    }
}

acceptAdmin();
