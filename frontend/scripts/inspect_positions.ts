
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import * as fs from 'fs';
import * as path from 'path';

// IDL and Program ID
const IDL_PATH = path.join(__dirname, 'target/types/solana_vault.json');
const PROGRAM_ID = new PublicKey('G9hoVfjm6QHGMQZpHpVsUGQmSBD6LQaXk9UbD5BzqtWR');

async function main() {
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const idl = JSON.parse(fs.readFileSync(IDL_PATH, 'utf-8'));
    const coder = new BorshAccountsCoder(idl);

    // Indices to check
    const indicesToCheck = [2, 5];

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
            const decoded = coder.decode("DlmmPosition", info.data);
            console.log("Decoded Successfully:", JSON.stringify(decoded, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
                , 2));
        } catch (e: any) {
            console.error("Decoding FAILED:", e.message);
            console.log("Full Data Hex:", info.data.toString('hex'));
        }
    }
}

main().catch(console.error);
