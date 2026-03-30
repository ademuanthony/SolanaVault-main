import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// CONFIGURATION — Edit these values before running
// ============================================================

const PROGRAM_ID = new PublicKey("CmhBENBj2c2rbAanfUvKGUzPZtffP7Q96hGH4eoAGqZp");

// Devnet USDC mint (Circle's devnet USDC — use your own if you created a custom one)
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Wallet addresses for fee recipients and authorities
// Replace these with your actual wallet addresses
const COMPANY_WALLET    = new PublicKey("GFATKDNNFsVuap99ExqwLQgWNZoBiRGhJYsbzEufRsPW");
const DEV1_WALLET       = new PublicKey("G8zjYBDq1VP1pdkBS5jrXRTpyjBrLKgTfyBbVTfo4jPE");
const DEV1_AUTHORITY    = new PublicKey("G8zjYBDq1VP1pdkBS5jrXRTpyjBrLKgTfyBbVTfo4jPE");
const DEV2_WALLET       = new PublicKey("AGL4pna3NGqFZvt4MTxRaFPn5hvW6avYviLazb2QTY1D");
const DEV2_AUTHORITY    = new PublicKey("AGL4pna3NGqFZvt4MTxRaFPn5hvW6avYviLazb2QTY1D");
const DEV3_WALLET       = new PublicKey("6mnPgfTcRzkiumLQGzph6bqQxBTxzVeU1GHV69614WsP");
const DEV3_AUTHORITY    = new PublicKey("6mnPgfTcRzkiumLQGzph6bqQxBTxzVeU1GHV69614WsP");
const MARKETER1_WALLET  = new PublicKey("GjPkionxEYL8sfwe7MGHH58rCRdcBGqnUXvcnjMfLVfA");
const MARKETER1_AUTHORITY = new PublicKey("GjPkionxEYL8sfwe7MGHH58rCRdcBGqnUXvcnjMfLVfA");

// ============================================================
// RPC URL
// ============================================================
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || "https://solana-mainnet.core.chainstack.com/4ed69be823c47a9517d79bd7c873acf6";

// ============================================================

async function main() {
  // Load admin keypair from default Solana CLI wallet
  const walletPath = process.env.ANCHOR_WALLET
    || path.join(require("os").homedir(), ".config", "solana", "met-pltl-deploy-keypair.json");
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  console.log("Admin wallet:", adminKeypair.publicKey.toBase58());

  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL
  const idlPath = path.join(__dirname, "..", "target", "idl", "solana_vault.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider) as any;

  // Derive PDAs
  const [globalConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    PROGRAM_ID
  );
  const [vaultState] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    PROGRAM_ID
  );
  const [vaultUsdcAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc"), globalConfig.toBuffer()],
    PROGRAM_ID
  );

  // Generate a new keypair for the share mint (program will init it)
  const shareMint = Keypair.generate();

  console.log("\n--- PDAs ---");
  console.log("Global Config:", globalConfig.toBase58());
  console.log("Vault State:", vaultState.toBase58());
  console.log("Vault USDC Account:", vaultUsdcAccount.toBase58());
  console.log("Share Mint:", shareMint.publicKey.toBase58());
  console.log("USDC Mint:", USDC_MINT.toBase58());
  console.log("");

  try {
    const tx = await program.methods
      .initialize({
        companyWallet: COMPANY_WALLET,
        dev1Wallet: DEV1_WALLET,
        dev1Authority: DEV1_AUTHORITY,
        dev2Wallet: DEV2_WALLET,
        dev2Authority: DEV2_AUTHORITY,
        dev3Wallet: DEV3_WALLET,
        dev3Authority: DEV3_AUTHORITY,
        marketer1Wallet: MARKETER1_WALLET,
        marketer1Authority: MARKETER1_AUTHORITY,
      })
      .accounts({
        admin: adminKeypair.publicKey,
        globalConfig,
        vaultState,
        usdcMint: USDC_MINT,
        vaultUsdcAccount,
        shareMint: shareMint.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([adminKeypair, shareMint])
      .rpc();

    console.log("Vault initialized successfully!");
    console.log("Transaction:", tx);
    console.log("\nShare Mint address (save this!):", shareMint.publicKey.toBase58());
  } catch (err: any) {
    console.error("Failed to initialize:", err.message || err);
    if (err.logs) {
      console.error("\nProgram logs:");
      err.logs.forEach((log: string) => console.error("  ", log));
    }
  }
}

main();
