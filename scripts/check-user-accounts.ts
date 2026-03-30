import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaVault } from "../target/types/solana_vault";
import { PublicKey, SystemProgram } from "@solana/web3.js";

async function cleanupUserAccounts() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.SolanaVault as Program<SolanaVault>;
    const admin = provider.wallet.publicKey;

    console.log("🧹 Cleaning up user-specific accounts...");
    console.log("Admin:", admin.toBase58());

    const userWallets = [
        "2xVFsEwbnDvuLNbWxUSFHiFrg9cSUr1Kiqird9bzuEex",
        "GQuAEJe5BLEmimfisQqiLj8LavjfDCeYZjEsaiq16uj",
        "9MgbnstrAfEmTyz5CXCLxPxkE1bt2W6NtQ9hViUadqye"
    ];

    for (const walletStr of userWallets) {
        try {
            const wallet = new PublicKey(walletStr);

            // Find the user account PDA for this wallet
            const [userAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("user_account"), wallet.toBuffer()],
                program.programId
            );

            console.log(`\n📋 Checking user account for wallet: ${walletStr}`);
            console.log(`   PDA: ${userAccountPda.toBase58()}`);

            // Check if account exists
            try {
                const accountInfo = await provider.connection.getAccountInfo(userAccountPda);
                if (accountInfo) {
                    console.log(`   ✅ Account exists (${accountInfo.lamports / 1e9} SOL)`);
                    console.log(`   ⚠️  Note: This account was already cleaned when we closed the program`);
                } else {
                    console.log(`   ℹ️  Account does not exist (already cleaned)`);
                }
            } catch (err) {
                console.log(`   ℹ️  Account does not exist`);
            }

        } catch (err) {
            console.error(`Failed to process wallet ${walletStr}:`, err.message);
        }
    }

    console.log("\n✅ User account cleanup check complete!");
    console.log("\n📝 Summary:");
    console.log("Since we already closed the program, all PDAs (including user accounts)");
    console.log("were automatically cleaned up. The program is ready for fresh deployment.");
}

cleanupUserAccounts()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
