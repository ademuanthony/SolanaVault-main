
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import DLMM from "@meteora-ag/dlmm";

const RPC = "http://127.0.0.1:8899"; // Or your devnet URL
const DLMM_PROGRAM_ID = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
const TARGET_MINT = process.argv[2]; // Pass mint as arg

async function main() {
    if (!TARGET_MINT) {
        console.error("Please provide the Position Mint address as an argument.");
        process.exit(1);
    }

    const connection = new Connection(RPC);
    const mint = new PublicKey(TARGET_MINT);

    console.log(`Searching for DLMM Position Account related to Mint: ${mint.toBase58()}`);
    console.log(`DLMM Program: ${DLMM_PROGRAM_ID.toBase58()}`);

    // Fetch all accounts owned by DLMM Progam
    const accounts = await connection.getProgramAccounts(DLMM_PROGRAM_ID, {
        filters: [
            {
                dataSize: 184 // Approximate size? OR filter by something we know.
                // PositionV2 is typical.
            }
        ]
    });

    // Actually, just fetch ALL and filter in memory if size is unknown.
    // DLMM Position accounts are usually ~100-200 bytes + bin data.

    console.log(`Found ${accounts.length} accounts owned by DLMM Program. Scanning data...`);

    let found = false;
    for (const { pubkey, account } of accounts) {
        // Simple buffer search for the mint address bytes
        const mintBytes = mint.toBuffer();
        if (account.data.includes(mintBytes)) {
            console.log(`\nMATCH FOUND!`);
            console.log(`Account Address: ${pubkey.toBase58()}`);
            console.log(`Data Length: ${account.data.length}`);
            console.log(`Owner: ${account.owner.toBase58()}`);

            // Try to decode or guess what it is
            // Offset of mint might tell us the type
            const index = account.data.indexOf(mintBytes);
            console.log(`Mint found at offset: ${index}`);
            found = true;
        }
    }

    if (!found) {
        console.log("\nNo account found containing the Mint address.");

        // Check if Mint itself exists and who owns it
        const mintInfo = await connection.getAccountInfo(mint);
        if (mintInfo) {
            console.log(`Mint Account exists. Owner: ${mintInfo.owner.toBase58()}`);
        } else {
            console.log(`Mint Account DOES NOT exist.`);
        }
    }
}

main().catch(console.error);
