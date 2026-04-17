import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Connection,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  AddressLookupTableProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import DLMM from "@meteora-ag/dlmm";
import BN from "bn.js";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// CONFIG
// ============================================================
const PROGRAM_ID = new PublicKey("G9hoVfjm6QHGMQZpHpVsUGQmSBD6LQaXk9UbD5BzqtWR");
const DLMM_PROGRAM_ID = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const ORPHAN_POSITIONS: { nft: string; pool: string }[] = [
  { nft: "3meKm6qoekpWEnmKNBrvqCwpv3rPbRqVmdQbUMVhghEG", pool: "BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y" },
  { nft: "GjLTKtNPMhWxf8SZpfFhYWhBvWrNFycsZxM3phv3v2BQ", pool: "BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y" },
];

const RPC_URL = process.env.ANCHOR_PROVIDER_URL || "https://solana-mainnet.core.chainstack.com/4ed69be823c47a9517d79bd7c873acf6";

// claim_dlmm_fees discriminator
const CLAIM_FEES_DISCRIMINATOR = Buffer.from([102, 188, 67, 120, 236, 199, 117, 122]);

// ============================================================
// HELPERS
// ============================================================

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
  const raw = JSON.parse(fs.readFileSync(fallback, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

interface Swap {
  from: PublicKey;
  to: PublicKey;
  /** only swap when the account meta has isSigner=false */
  nonSignerOnly: boolean;
}

function applySwaps(keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[], swaps: Swap[]) {
  return keys.map((k) => {
    let pubkey = k.pubkey;
    for (const s of swaps) {
      if (!pubkey.equals(s.from)) continue;
      if (s.nonSignerOnly && k.isSigner) continue;
      pubkey = s.to;
      break;
    }
    return { pubkey, isSigner: k.isSigner, isWritable: k.isWritable };
  });
}

function encodeClaimFeesData(
  cpiAccounts: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  cpiData: Buffer,
): Buffer {
  // claim_dlmm_fees signature after audit fix: (cpi_data: DlmmCpiData) — no claimed_amount.
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(cpiAccounts.length);
  const accountBufs = cpiAccounts.map((a) => {
    const buf = Buffer.alloc(34);
    a.pubkey.toBuffer().copy(buf, 0);
    buf[32] = a.isSigner ? 1 : 0;
    buf[33] = a.isWritable ? 1 : 0;
    return buf;
  });
  const dataLen = Buffer.alloc(4);
  dataLen.writeUInt32LE(cpiData.length);
  return Buffer.concat([CLAIM_FEES_DISCRIMINATOR, lenBuf, ...accountBufs, dataLen, cpiData]);
}

async function getOrCreateAlt(
  connection: Connection,
  payer: Keypair,
  keys: PublicKey[],
): Promise<{ altAccount: any; altAddress: PublicKey }> {
  const slot = await connection.getSlot("finalized");
  const [createIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot,
  });
  const dedup = Array.from(new Set(keys.map((k) => k.toBase58()))).map((s) => new PublicKey(s));
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: altAddress,
    addresses: dedup,
  });

  const bh = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: bh.blockhash,
    instructions: [createIx, extendIx],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([payer]);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
  console.log(`  ALT created ${altAddress.toBase58()}`);

  // wait for ALT to be addressable on the current slot
  let altAccount: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const r = await connection.getAddressLookupTable(altAddress);
    if (r.value) {
      altAccount = r.value;
      break;
    }
  }
  if (!altAccount) throw new Error("ALT not resolved after wait");
  return { altAccount, altAddress };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const admin = loadAdmin();
  console.log(`Admin: ${admin.publicKey.toBase58()}`);

  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "target", "idl", "solana_vault.json"), "utf-8"));
  const program = new Program(idl, provider) as any;

  const [globalConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
  const [vaultStatePda] = PublicKey.findProgramAddressSync([Buffer.from("vault_state")], PROGRAM_ID);
  const [vaultUsdcAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc"), globalConfigPda.toBuffer()],
    PROGRAM_ID,
  );
  const globalConfigUsdcAta = await getAssociatedTokenAddress(USDC_MINT, globalConfigPda, true);

  console.log(`globalConfigPda:     ${globalConfigPda.toBase58()}`);
  console.log(`vaultUsdcPda:        ${vaultUsdcAccount.toBase58()}`);
  console.log(`globalConfigUsdcAta: ${globalConfigUsdcAta.toBase58()}`);

  // Find a free tracking PDA index
  const vaultState = await program.account.vaultState.fetch(vaultStatePda);
  let scratchIndex: number = vaultState.positionsCount;
  let scratchPda!: PublicKey;
  while (true) {
    [scratchPda] = PublicKey.findProgramAddressSync([Buffer.from("dlmm_position"), Buffer.from([scratchIndex])], PROGRAM_ID);
    if (!(await connection.getAccountInfo(scratchPda))) break;
    scratchIndex++;
    if (scratchIndex > 255) throw new Error("No free tracking PDA slot");
  }
  console.log(`\nUsing scratch tracking PDA: index=${scratchIndex}, pda=${scratchPda.toBase58()}`);

  // Account swaps applied to all Meteora CPI data:
  //   - globalConfigUsdcAta → vaultUsdcPda (bring USDC back into vault)
  //   - globalConfigPda     → admin         (rent receiver for closePosition; non-signer slots only)
  const swaps: Swap[] = [
    { from: globalConfigUsdcAta, to: vaultUsdcAccount, nonSignerOnly: false },
    { from: globalConfigPda, to: admin.publicKey, nonSignerOnly: true },
  ];

  let scratchCreated = false;

  for (const orphan of ORPHAN_POSITIONS) {
    const nftPk = new PublicKey(orphan.nft);
    const poolPk = new PublicKey(orphan.pool);
    console.log(`\n======================================================`);
    console.log(`Recovering orphan ${orphan.nft}`);
    console.log(`Pool: ${orphan.pool}`);

    const dlmmPool = await DLMM.create(connection, poolPk);

    // Ensure both pool token ATAs exist for globalConfigPda (idempotent).
    const poolMints = [dlmmPool.lbPair.tokenXMint, dlmmPool.lbPair.tokenYMint];
    const ataPrepIxs: TransactionInstruction[] = [];
    for (const mint of poolMints) {
      const ata = await getAssociatedTokenAddress(mint, globalConfigPda, true);
      if (!(await connection.getAccountInfo(ata))) {
        console.log(`  Creating missing ATA for mint ${mint.toBase58().slice(0, 8)}... at ${ata.toBase58()}`);
        ataPrepIxs.push(createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, ata, globalConfigPda, mint));
      }
    }
    if (ataPrepIxs.length > 0) {
      const bh = await connection.getLatestBlockhash();
      const msg = new TransactionMessage({ payerKey: admin.publicKey, recentBlockhash: bh.blockhash, instructions: ataPrepIxs }).compileToV0Message();
      const tx = new VersionedTransaction(msg);
      tx.sign([admin]);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
      console.log(`  ATAs ensured: ${sig}`);
    }
    let posData: any;
    try {
      posData = await dlmmPool.getPosition(nftPk);
    } catch (e: any) {
      console.warn(`  SKIP: cannot fetch position (${e.message})`);
      continue;
    }
    const binData = posData?.positionData?.positionBinData || [];
    const hasLiquidity = binData.some((b: any) => b.positionXAmount !== "0" || b.positionYAmount !== "0");
    const lower = posData.positionData.lowerBinId;
    const upper = posData.positionData.upperBinId;
    console.log(`  Bin range: [${lower}, ${upper}]  hasLiquidity=${hasLiquidity}`);

    let meteoraTxs: any;
    if (hasLiquidity) {
      meteoraTxs = await dlmmPool.removeLiquidity({
        user: globalConfigPda,
        position: nftPk,
        fromBinId: lower,
        toBinId: upper,
        bps: new BN(10000),
        shouldClaimAndClose: true,
      } as any);
    } else {
      // closePosition only
      meteoraTxs = await dlmmPool.closePosition({
        owner: globalConfigPda,
        position: { publicKey: nftPk, positionData: posData.positionData, version: 1 },
      } as any);
    }

    const txArray = Array.isArray(meteoraTxs) ? meteoraTxs : [meteoraTxs];
    const dlmmIxs: TransactionInstruction[] = [];
    for (const rtx of txArray) {
      const ixs = (rtx as any).instructions ?? (rtx as any).message?.instructions ?? [];
      for (const ix of ixs) {
        if (ix.programId && ix.programId.equals(DLMM_PROGRAM_ID)) dlmmIxs.push(ix);
      }
    }
    console.log(`  Extracted ${dlmmIxs.length} DLMM ix(s) from Meteora SDK`);

    for (let i = 0; i < dlmmIxs.length; i++) {
      const meteoraIx = dlmmIxs[i];
      const rawKeys = meteoraIx.keys.map((k: any) => ({ pubkey: k.pubkey, isSigner: k.isSigner, isWritable: k.isWritable }));
      const swappedKeys = applySwaps(rawKeys, swaps);
      const cpiData = Buffer.from(meteoraIx.data);

      if (!scratchCreated) {
        console.log(`  [ix ${i + 1}/${dlmmIxs.length}] via openDlmmPosition (creates scratch PDA)`);
        await forwardViaOpenPosition({
          connection, admin, program, globalConfigPda, vaultStatePda, scratchPda, scratchIndex,
          poolPk, nftPk, swappedKeys, cpiData, lower, upper,
        });
        scratchCreated = true;
      } else {
        console.log(`  [ix ${i + 1}/${dlmmIxs.length}] via claimDlmmFees`);
        await forwardViaClaimFees({
          connection, admin, globalConfigPda, scratchPda, swappedKeys, cpiData,
        });
      }
    }
  }

  // Close scratch tracking PDA
  if (scratchCreated) {
    console.log(`\nClosing scratch tracking PDA ${scratchPda.toBase58()}...`);
    const sig = await program.methods
      .closeDlmmPositionAccount()
      .accounts({
        admin: admin.publicKey,
        globalConfig: globalConfigPda,
        dlmmPosition: scratchPda,
      })
      .rpc();
    console.log(`  Closed: ${sig}`);
  }

  console.log(`\nDone.`);
}

// ============================================================
// Forward via openDlmmPosition (creates tracking PDA)
// ============================================================
async function forwardViaOpenPosition(args: {
  connection: Connection;
  admin: Keypair;
  program: any;
  globalConfigPda: PublicKey;
  vaultStatePda: PublicKey;
  scratchPda: PublicKey;
  scratchIndex: number;
  poolPk: PublicKey;
  nftPk: PublicKey;
  swappedKeys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  cpiData: Buffer;
  lower: number;
  upper: number;
}) {
  const { connection, admin, program, globalConfigPda, vaultStatePda, scratchPda, scratchIndex, poolPk, nftPk, swappedKeys, cpiData, lower, upper } = args;

  const cpiAccountsForIdl = swappedKeys.map((k) => ({ pubkey: k.pubkey, isSigner: k.isSigner, isWritable: k.isWritable }));
  const initCpiData = { accounts: cpiAccountsForIdl, data: cpiData };

  const params = {
    positionIndex: scratchIndex,
    dlmmPool: poolPk,
    positionNft: nftPk,
    binArrayLower: new PublicKey("11111111111111111111111111111111"),
    binArrayUpper: new PublicKey("11111111111111111111111111111111"),
    mode: { spot: {} },
    binIdLower: lower,
    binIdUpper: upper,
    tokenXAmount: new BN(0),
    tokenYAmount: new BN(0),
    ratio: 50,
    oneSided: true,
  };

  // remainingAccounts: preserve signer flag ONLY for admin (PDA signer is done via invoke_signed)
  const remaining = swappedKeys.map((k) => ({
    pubkey: k.pubkey,
    isSigner: k.pubkey.equals(admin.publicKey),
    isWritable: k.isWritable,
  }));

  const [vaultUsdcPdaForOpen] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc"), globalConfigPda.toBuffer()],
    PROGRAM_ID,
  );

  const ix = await program.methods
    .openDlmmPosition(params, initCpiData)
    .accounts({
      admin: admin.publicKey,
      globalConfig: globalConfigPda,
      dlmmPosition: scratchPda,
      vaultState: vaultStatePda,
      vaultUsdcAccount: vaultUsdcPdaForOpen,
      dlmmProgram: DLMM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remaining)
    .instruction();

  await sendWithAlt(connection, admin, [ix]);
}

// ============================================================
// Forward via claimDlmmFees (uses existing tracking PDA)
// ============================================================
async function forwardViaClaimFees(args: {
  connection: Connection;
  admin: Keypair;
  globalConfigPda: PublicKey;
  scratchPda: PublicKey;
  swappedKeys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  cpiData: Buffer;
}) {
  const { connection, admin, globalConfigPda, scratchPda, swappedKeys, cpiData } = args;

  const data = encodeClaimFeesData(swappedKeys, cpiData);
  const remaining = swappedKeys.map((k) => ({
    pubkey: k.pubkey,
    isSigner: k.pubkey.equals(admin.publicKey),
    isWritable: k.isWritable,
  }));

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: globalConfigPda, isSigner: false, isWritable: true },
      { pubkey: scratchPda, isSigner: false, isWritable: true },
      { pubkey: DLMM_PROGRAM_ID, isSigner: false, isWritable: false },
      ...remaining,
    ],
    data,
  });

  await sendWithAlt(connection, admin, [ix]);
}

async function sendWithAlt(connection: Connection, payer: Keypair, ixs: TransactionInstruction[]) {
  const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });
  const allKeys: PublicKey[] = [];
  for (const ix of ixs) for (const k of ix.keys) allKeys.push(k.pubkey);
  for (const ix of ixs) allKeys.push(ix.programId);

  const { altAccount } = await getOrCreateAlt(connection, payer, allKeys);

  const bh = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: bh.blockhash,
    instructions: [computeIx, ...ixs],
  }).compileToV0Message([altAccount]);
  const tx = new VersionedTransaction(msg);
  tx.sign([payer]);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
  console.log(`    tx: ${sig}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
