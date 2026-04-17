/**
 * Admin script: register a user account on-chain.
 *
 * Usage:
 *   yarn ts-node --transpile-only scripts/admin_register.ts <userWallet> [referrerWallet]
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("3TV5FTYziezR5xrp9SAeR6zLU4brnTLQuegjixpBrV1t");
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || "https://solana-mainnet.core.chainstack.com/4ed69be823c47a9517d79bd7c873acf6";

function loadAdmin(): Keypair {
  const pk = process.env.CAIFU_ADMIN_WALLET_PK;
  if (pk) {
    let secret: Uint8Array;
    if (pk.startsWith("[")) secret = Uint8Array.from(JSON.parse(pk));
    else if (/^[0-9a-fA-F]+$/.test(pk)) secret = Uint8Array.from(Buffer.from(pk, "hex"));
    else secret = require("bs58").decode(pk);
    return Keypair.fromSecretKey(secret);
  }
  const fallback = process.env.ANCHOR_WALLET || path.join(process.env.HOME || "", ".config/solana/met-pltl-deploy-keypair.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(fallback, "utf-8"))));
}

async function main() {
  const [userArg, referrerArg] = process.argv.slice(2);
  if (!userArg) {
    console.error("Usage: admin_register.ts <userWallet> [referrerWallet]");
    process.exit(1);
  }
  const userWallet = new PublicKey(userArg);
  const referrer = referrerArg ? new PublicKey(referrerArg) : null;

  const admin = loadAdmin();
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "target", "idl", "solana_vault.json"), "utf-8"));
  const program = new Program(idl, provider) as any;

  const [globalConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
  const [userAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_account"), userWallet.toBuffer()],
    PROGRAM_ID,
  );

  console.log(`Admin:        ${admin.publicKey.toBase58()}`);
  console.log(`User wallet:  ${userWallet.toBase58()}`);
  console.log(`Referrer:     ${referrer ? referrer.toBase58() : "(none)"}`);
  console.log(`User PDA:     ${userAccountPda.toBase58()}`);

  const existing = await connection.getAccountInfo(userAccountPda);
  if (existing) {
    console.error(`\nERROR: user account already exists at ${userAccountPda.toBase58()}. Nothing to do.`);
    process.exit(2);
  }

  const sig = await program.methods
    .adminRegisterUser(userWallet, referrer)
    .accounts({
      admin: admin.publicKey,
      globalConfig: globalConfigPda,
      userAccount: userAccountPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`\nRegistered: ${sig}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
