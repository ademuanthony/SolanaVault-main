
const { Connection, PublicKey } = require("@solana/web3.js");
const { BorshAccountsCoder } = require("@coral-xyz/anchor");
const fs = require('fs');
const path = require('path');

// IDL and Program ID
const IDL_PATH = path.join(__dirname, 'target/types/solana_vault.json');
const PROGRAM_ID = new PublicKey('B3SnRh6Snmk7PvvRHu2o3wDQRpFf1DBMaR9zQpjL4LPx');

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const idl = JSON.parse(fs.readFileSync(IDL_PATH, 'utf-8'));

    console.log("Initializing BorshAccountsCoder...");
    const coder = new BorshAccountsCoder(idl);
    console.log("Coder keys:", Object.keys(coder));
    if (coder.accounts) {
        console.log("coder.accounts keys:", Object.keys(coder.accounts));
    } else {
        console.log("coder.accounts is UNDEFINED");
    }

    // Indices to check
    const indicesToCheck = [5];

    console.log(`Checking indices: ${indicesToCheck.join(', ')}`);
    console.log(`Program ID: ${PROGRAM_ID.toBase58()}`);

    for (const index of indicesToCheck) {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('dlmm_position'), Buffer.from([index])],
            PROGRAM_ID
        );

        console.log(`\n--- Index ${index} ---`);
        console.log(`PDA: ${pda.toBase58()}`);

        const info = await connection.getAccountInfo(pda);
        if (!info) {
            console.log("Account NOT found on-chain.");
            continue;
        }

        console.log(`Account FOUND. Owner: ${info.owner.toBase58()} (Expected: ${PROGRAM_ID.toBase58()})`);
        console.log(`Data Length: ${info.data.length} bytes`);
        console.log(`Data (First 8 bytes - Discriminator): ${info.data.subarray(0, 8).toString('hex')}`);

        try {
            let decoded;
            if (coder.decode) {
                console.log("Attempting coder.decode...");
                decoded = coder.decode("DlmmPosition", info.data);
            } else if (coder.accounts && coder.accounts.decode) {
                console.log("Attempting coder.accounts.decode...");
                decoded = coder.accounts.decode("DlmmPosition", info.data);
            } else {
                throw new Error("No decode method found on coder");
            }

            console.log("Decoded Successfully:", JSON.stringify(decoded, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
                , 2));
        } catch (e) {
            console.error("Decoding FAILED:", e.message);
            // console.log("Full Data Hex:", info.data.toString('hex'));
        }
    }
}

main().catch(console.error);
