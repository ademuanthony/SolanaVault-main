import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaVault } from "../target/types/solana_vault";
import { PublicKey } from "@solana/web3.js";

async function cleanup() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.SolanaVault as Program<SolanaVault>;
    const admin = provider.wallet.publicKey;

    console.log("🧹 Starting cleanup...");
    console.log("Admin:", admin.toBase58());

    try {
        // Find all PDAs
        const [globalConfig] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_config")],
            program.programId
        );
        const [vaultState] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault_state")],
            program.programId
        );

        // Fetch all user accounts
        console.log("\n📋 Fetching all user accounts...");
        const userAccounts = await program.account.userAccount.all();
        console.log(`Found ${userAccounts.length} user accounts`);

        // Fetch all DLMM positions
        console.log("\n📋 Fetching all DLMM positions...");
        const dlmmPositions = await program.account.dlmmPosition.all();
        console.log(`Found ${dlmmPositions.length} DLMM positions`);

        // Close all user accounts
        for (const userAccount of userAccounts) {
            try {
                console.log(`\n🗑️  Closing user account: ${userAccount.publicKey.toBase58()}`);

                // We need to implement a close_user_account instruction
                // For now, we'll note that this requires an admin instruction
                console.log("⚠️  Note: Requires close_user_account instruction in program");
            } catch (err) {
                console.error(`Failed to close user account: ${err.message}`);
            }
        }

        // Close all DLMM positions
        for (const position of dlmmPositions) {
            try {
                console.log(`\n🗑️  Closing DLMM position: ${position.publicKey.toBase58()}`);
                console.log("⚠️  Note: Requires close_dlmm_position_account instruction in program");
            } catch (err) {
                console.error(`Failed to close position: ${err.message}`);
            }
        }

        // Close global config and vault state
        console.log("\n🗑️  Attempting to close GlobalConfig and VaultState...");
        console.log("⚠️  Note: These require close instructions in the program");

        console.log("\n✅ Cleanup analysis complete!");
        console.log("\n📝 MANUAL CLEANUP REQUIRED:");
        console.log("Since the program doesn't have close instructions, you need to:");
        console.log("1. Use 'solana program close' to close the program and reclaim SOL");
        console.log("2. Redeploy with 'anchor deploy'");
        console.log("3. Or manually close accounts using Solana CLI");

        console.log("\n🔧 Quick reset command:");
        console.log(`solana program close ${program.programId.toBase58()} --bypass-warning`);

    } catch (err) {
        console.error("Cleanup failed:", err);
    }
}

cleanup()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
