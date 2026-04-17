/**
 * Admin script: withdraw accumulated company fees from the vault.
 *
 * Transfers `amount` USDC from the vault USDC PDA to the company USDC ATA
 * (owned by globalConfig.companyWallet) and decrements global_config.company_fees.
 *
 * The on-chain handler enforces `global_config.admin == admin.key()`, so only
 * the admin wallet can sign this instruction.
 *
 * The destination ATA (companyWallet's USDC ATA) is created idempotently first
 * since the handler does not init it.
 *
 * Usage:
 *   yarn ts-node --transpile-only scripts/withdraw_company_fees.ts <amountUsdc>
 *   yarn ts-node --transpile-only scripts/withdraw_company_fees.ts --all
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey, Keypair, Connection, TransactionInstruction, TransactionMessage, VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
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
  const [arg] = process.argv.slice(2);
  if (!arg) {
    console.error("Usage: withdraw_company_fees.ts <amountUsdc | --all>");
    process.exit(1);
  }

  const admin = loadAdmin();
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "target", "idl", "solana_vault.json"), "utf-8"));
  const program = new Program(idl, provider) as any;

  const [globalConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
  const [vaultUsdcPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc"), globalConfigPda.toBuffer()],
    PROGRAM_ID,
  );

  const globalConfig = await program.account.globalConfig.fetch(globalConfigPda);

  if (!globalConfig.admin.equals(admin.publicKey)) {
    console.error(`ERROR: signer ${admin.publicKey.toBase58()} is not the admin.`);
    console.error(`       Expected admin: ${globalConfig.admin.toBase58()}`);
    process.exit(2);
  }

  const available = BigInt(globalConfig.companyFees.toString());
  let amountLamports: bigint;
  if (arg === "--all") {
    amountLamports = available;
  } else {
    const usdc = Number(arg);
    if (isNaN(usdc) || usdc <= 0) {
      console.error(`Invalid amount: ${arg}`);
      process.exit(1);
    }
    amountLamports = BigInt(Math.round(usdc * 1e6));
  }

  if (amountLamports <= BigInt(0)) {
    console.error("Nothing to withdraw (company_fees is zero).");
    process.exit(0);
  }
  if (amountLamports > available) {
    console.error(`ERROR: requested ${Number(amountLamports) / 1e6} USDC but only ${Number(available) / 1e6} USDC accrued.`);
    process.exit(2);
  }

  const usdcMint: PublicKey = globalConfig.usdcMint;
  const companyWallet: PublicKey = globalConfig.companyWallet;
  const companyUsdc = await getAssociatedTokenAddress(usdcMint, companyWallet);

  console.log(`Admin:           ${admin.publicKey.toBase58()}`);
  console.log(`Company wallet:  ${companyWallet.toBase58()}`);
  console.log(`Company USDC:    ${companyUsdc.toBase58()}`);
  console.log(`Accrued fees:    ${Number(available) / 1e6} USDC`);
  console.log(`Withdrawing:     ${Number(amountLamports) / 1e6} USDC\n`);

  const ataInfo = await connection.getAccountInfo(companyUsdc);
  if (!ataInfo) {
    console.log(`  Creating missing company USDC ATA ${companyUsdc.toBase58()}`);
    const ix = createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, companyUsdc, companyWallet, usdcMint);
    const bh = await connection.getLatestBlockhash();
    const msg = new TransactionMessage({ payerKey: admin.publicKey, recentBlockhash: bh.blockhash, instructions: [ix] }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([admin]);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
    console.log(`  ATA prep tx: ${sig}`);
  }

  const sig = await program.methods
    .withdrawCompanyFees(new anchor.BN(amountLamports.toString()))
    .accounts({
      admin: admin.publicKey,
      globalConfig: globalConfigPda,
      companyUsdcAccount: companyUsdc,
      vaultUsdcAccount: vaultUsdcPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log(`\nCompany fees withdrawn: ${sig}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
