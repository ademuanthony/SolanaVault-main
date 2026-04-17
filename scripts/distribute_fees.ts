/**
 * Permissionless fee-sweep runner (keeper script).
 *
 * Reads the five accrued fee buckets from GlobalConfig, skips the call when
 * the total is below the configured `min_distribution_amount` rail (or below
 * an override passed via `--min`), and otherwise sends
 * `distribute_accrued_fees`.
 *
 * ANY wallet can run this — the on-chain instruction is permissionless and
 * the destination ATAs are pinned by `token::authority = config.<wallet>`.
 * By default the script uses the admin keypair loader from sibling scripts,
 * but it's fine to point `CAIFU_ADMIN_WALLET_PK` at any funded keypair.
 *
 * Missing destination ATAs are created idempotently first (only when the
 * bucket they'd receive is non-zero — no point paying rent for dead ones).
 *
 * Usage:
 *   yarn ts-node --transpile-only scripts/distribute_fees.ts
 *   yarn ts-node --transpile-only scripts/distribute_fees.ts --dry-run
 *   yarn ts-node --transpile-only scripts/distribute_fees.ts --min 10   # override 10 USDC
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

function loadPayer(): Keypair {
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
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const minIdx = args.indexOf("--min");
  const minOverrideUsdc = minIdx >= 0 && args[minIdx + 1] ? Number(args[minIdx + 1]) : null;

  const payer = loadPayer();
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payer), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "target", "idl", "solana_vault.json"), "utf-8"));
  const program = new Program(idl, provider) as any;

  const [globalConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
  const [vaultUsdcPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc"), globalConfigPda.toBuffer()],
    PROGRAM_ID,
  );

  const cfg = await program.account.globalConfig.fetch(globalConfigPda);
  const usdcMint: PublicKey = cfg.usdcMint;

  const c = BigInt(cfg.companyFees.toString());
  const d1 = BigInt(cfg.dev1Fees.toString());
  const d2 = BigInt(cfg.dev2Fees.toString());
  const d3 = BigInt(cfg.dev3Fees.toString());
  const m1 = BigInt(cfg.marketer1Fees.toString());
  const total = c + d1 + d2 + d3 + m1;

  const configuredMin = BigInt(cfg.minDistributionAmount.toString());
  const overrideMin = minOverrideUsdc !== null ? BigInt(Math.round(minOverrideUsdc * 1e6)) : null;
  const effectiveMin = overrideMin ?? configuredMin;

  console.log(`Payer:            ${payer.publicKey.toBase58()}`);
  console.log(`Bucket totals (USDC):`);
  console.log(`  company   = ${Number(c) / 1e6}`);
  console.log(`  dev1      = ${Number(d1) / 1e6}`);
  console.log(`  dev2      = ${Number(d2) / 1e6}`);
  console.log(`  dev3      = ${Number(d3) / 1e6}`);
  console.log(`  marketer1 = ${Number(m1) / 1e6}`);
  console.log(`  TOTAL     = ${Number(total) / 1e6}`);
  console.log(`Min required:     ${Number(effectiveMin) / 1e6} USDC${overrideMin !== null ? " (override)" : ""}`);

  if (total === BigInt(0)) {
    console.log("\nNothing to distribute. Exiting.");
    return;
  }
  if (effectiveMin > BigInt(0) && total < effectiveMin) {
    console.log(`\nTotal ${Number(total) / 1e6} USDC below min ${Number(effectiveMin) / 1e6} — skipping.`);
    return;
  }

  // Destination ATAs
  const companyUsdc = await getAssociatedTokenAddress(usdcMint, cfg.companyWallet);
  const dev1Usdc = await getAssociatedTokenAddress(usdcMint, cfg.dev1Wallet);
  const dev2Usdc = await getAssociatedTokenAddress(usdcMint, cfg.dev2Wallet);
  const dev3Usdc = await getAssociatedTokenAddress(usdcMint, cfg.dev3Wallet);
  const marketer1Usdc = await getAssociatedTokenAddress(usdcMint, cfg.marketer1Wallet);

  // Pre-create missing ATAs — only for non-zero buckets.
  const prereqs: { amount: bigint; ata: PublicKey; owner: PublicKey; label: string }[] = [
    { amount: c, ata: companyUsdc, owner: cfg.companyWallet, label: "company" },
    { amount: d1, ata: dev1Usdc, owner: cfg.dev1Wallet, label: "dev1" },
    { amount: d2, ata: dev2Usdc, owner: cfg.dev2Wallet, label: "dev2" },
    { amount: d3, ata: dev3Usdc, owner: cfg.dev3Wallet, label: "dev3" },
    { amount: m1, ata: marketer1Usdc, owner: cfg.marketer1Wallet, label: "marketer1" },
  ];
  const ataInfos = await connection.getMultipleAccountsInfo(prereqs.map((p) => p.ata));
  const ataIxs: TransactionInstruction[] = [];
  ataInfos.forEach((info, i) => {
    const p = prereqs[i];
    if (!info && p.amount > BigInt(0)) {
      console.log(`  Creating missing ATA (${p.label}) ${p.ata.toBase58()}`);
      ataIxs.push(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, p.ata, p.owner, usdcMint));
    }
  });

  if (dryRun) {
    console.log("\n--dry-run: would create", ataIxs.length, "ATA(s), then send distribute_accrued_fees.");
    return;
  }

  if (ataIxs.length > 0) {
    const bh = await connection.getLatestBlockhash();
    const msg = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: bh.blockhash, instructions: ataIxs }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([payer]);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
    console.log(`  ATA prep tx: ${sig}`);
  }

  const sig = await program.methods
    .distributeAccruedFees()
    .accounts({
      payer: payer.publicKey,
      globalConfig: globalConfigPda,
      vaultUsdcAccount: vaultUsdcPda,
      companyUsdcAccount: companyUsdc,
      dev1UsdcAccount: dev1Usdc,
      dev2UsdcAccount: dev2Usdc,
      dev3UsdcAccount: dev3Usdc,
      marketer1UsdcAccount: marketer1Usdc,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  console.log(`\nFees swept: ${sig}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
