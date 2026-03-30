const { PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey('3LxDSszXUnttqYcz4oJErHs2CP7vwxyXya84dHXKN2wv');

const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_config')],
    PROGRAM_ID
);
const [vaultStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_state')],
    PROGRAM_ID
);
const [vaultUsdcPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_usdc'), globalConfigPda.toBuffer()],
    PROGRAM_ID
);

console.log('GlobalConfig:', globalConfigPda.toBase58());
console.log('VaultState:', vaultStatePda.toBase58());
console.log('VaultUsdc:', vaultUsdcPda.toBase58());
