
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC = "https://api.devnet.solana.com";
const DLMM_PROGRAM_ID = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
const TARGET_MINT = process.argv[2];
const USER_PUBKEY = "3KMyzDtmtw3xxZ4ijMSDp54qiXmr1oMpYNJFxXaXYSzY"; // GlobalConfig
const ADMIN_PUBKEY = "3mCLdsLhyRN3VAqvPteAzk8mJngwdmUbUf8YEGicxT8c"; // Payer

async function main() {
    console.log(`Searching for DLMM Position Accounts...`);
    console.log(`RPC: ${RPC}`);
    console.log(`Program: ${DLMM_PROGRAM_ID.toBase58()}`);

    const connection = new Connection(RPC);
    const mintBytes = TARGET_MINT ? new PublicKey(TARGET_MINT).toBuffer() : null;

    // Helper to fetch and print
    const scanForUser = async (userLabel, userPubkeyStr) => {
        console.log(`\n--- Scanning for user: ${userLabel} (${userPubkeyStr}) ---`);
        try {
            const accounts = await connection.getProgramAccounts(DLMM_PROGRAM_ID, {
                filters: [
                    {
                        memcmp: {
                            offset: 40, // Owner offset based on SDK
                            bytes: userPubkeyStr
                        }
                    }
                ]
            });

            console.log(`Found ${accounts.length} accounts.`);

            for (const { pubkey, account } of accounts) {
                console.log(`Reference Account: ${pubkey.toBase58()} (Size: ${account.data.length})`);

                if (mintBytes && account.data.includes(mintBytes)) {
                    console.log(`  >>> CONTAINS MINT at offset ${account.data.indexOf(mintBytes)} <<<`);
                }
            }
        } catch (e) {
            console.error(`Error scanning for ${userLabel}:`, e.message);
        }
    };

    await scanForUser("GlobalConfig", USER_PUBKEY);
    await scanForUser("Admin", ADMIN_PUBKEY);
}

main().catch(console.error);
