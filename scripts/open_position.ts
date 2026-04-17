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
  AddressLookupTableProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction, NATIVE_MINT } from "@solana/spl-token";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import BN from "bn.js";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// CONFIGURATION — Edit these values before running
// ============================================================

const PROGRAM_ID = new PublicKey("3TV5FTYziezR5xrp9SAeR6zLU4brnTLQuegjixpBrV1t");
const DLMM_PROGRAM_ID = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");

// Pool and position parameters
const POOL_ADDRESS = new PublicKey("5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6");
const MIN_BIN_ID = -6380;
const MAX_BIN_ID = -6312;
const AMOUNT_X: number = 0;        // SOL amount (human units, e.g. 0.5 = 0.5 SOL)
const AMOUNT_Y: number = 0.5;     // USDC amount (human units, e.g. 10 = $10)
const STRATEGY = StrategyType.Spot; // Spot, Curve, or BidAsk

// ============================================================
// RPC URL
// ============================================================
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || "https://solana-mainnet.core.chainstack.com/4ed69be823c47a9517d79bd7c873acf6";

// ============================================================

async function main() {
  // Load admin keypair from env (supports hex string, base58, or JSON byte array)
  const pk = process.env.CAIFU_ADMIN_WALLET_PK;
  if (!pk) throw new Error("CAIFU_ADMIN_WALLET_PK env variable is required");
  let secretKey: Uint8Array;
  if (pk.startsWith("[")) {
    // JSON byte array: [1,2,3,...]
    secretKey = Uint8Array.from(JSON.parse(pk));
  } else if (/^[0-9a-fA-F]+$/.test(pk)) {
    // Hex string
    secretKey = Uint8Array.from(Buffer.from(pk, "hex"));
  } else {
    // Base58
    const bs58 = require("bs58");
    secretKey = bs58.decode(pk);
  }
  const adminKeypair = Keypair.fromSecretKey(secretKey);
  console.log("Admin wallet:", adminKeypair.publicKey.toBase58());

  // Setup connection and provider
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load IDL and program
  const idlPath = path.join(__dirname, "..", "target", "idl", "solana_vault.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider) as any;

  // Derive PDAs
  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    PROGRAM_ID
  );
  const [vaultStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state")],
    PROGRAM_ID
  );

  console.log("\n--- PDAs ---");
  console.log("Global Config:", globalConfigPda.toBase58());
  console.log("Vault State:", vaultStatePda.toBase58());

  // Find next available position index
  const vaultState = await program.account.vaultState.fetch(vaultStatePda);
  let index = vaultState.positionsCount;
  let dlmmPositionPda: PublicKey;

  while (true) {
    [dlmmPositionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dlmm_position"), Buffer.from([index])],
      PROGRAM_ID
    );
    const info = await connection.getAccountInfo(dlmmPositionPda);
    if (!info) break;
    console.log(`Index ${index} in use, trying next...`);
    index++;
    if (index > 255) throw new Error("No free position slots");
  }

  console.log(`\nUsing position index: ${index}`);
  console.log("DLMM Position PDA:", dlmmPositionPda!.toBase58());

  // Generate position NFT mint keypair
  const positionMintKeypair = Keypair.generate();
  console.log("Position Mint:", positionMintKeypair.publicKey.toBase58());

  // Convert amounts to raw units
  // For SOL/USDC pool: X = SOL (9 decimals), Y = USDC (6 decimals)
  const dlmmPool = await DLMM.create(connection, POOL_ADDRESS);
  const mintXDecimals = dlmmPool.lbPair.tokenXMint.equals(new PublicKey("So11111111111111111111111111111111111111112")) ? 9 : 6;
  const mintYDecimals = dlmmPool.lbPair.tokenYMint.equals(new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")) ? 6 : 9;

  const totalXRaw = BigInt(Math.floor(AMOUNT_X * Math.pow(10, mintXDecimals)));
  const totalYRaw = BigInt(Math.floor(AMOUNT_Y * Math.pow(10, mintYDecimals)));

  console.log(`\n--- Position Parameters ---`);
  console.log(`Pool: ${POOL_ADDRESS.toBase58()}`);
  console.log(`Token X: ${dlmmPool.lbPair.tokenXMint.toBase58()} (${mintXDecimals} decimals)`);
  console.log(`Token Y: ${dlmmPool.lbPair.tokenYMint.toBase58()} (${mintYDecimals} decimals)`);
  console.log(`Bin Range: ${MIN_BIN_ID} to ${MAX_BIN_ID}`);
  console.log(`Amount X: ${AMOUNT_X} (raw: ${totalXRaw})`);
  console.log(`Amount Y: ${AMOUNT_Y} (raw: ${totalYRaw})`);
  console.log(`Strategy: ${StrategyType[STRATEGY]}`);

  // Get active bin for reference
  const activeBin = await dlmmPool.getActiveBin();
  console.log(`Active Bin: ${activeBin.binId} (price: ${activeBin.price})`);

  // Build the Meteora CPI instruction via SDK
  console.log("\nBuilding Meteora CPI instruction...");
  const meteoraTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: positionMintKeypair.publicKey,
    user: globalConfigPda,
    payer: adminKeypair.publicKey,
    totalXAmount: new BN(totalXRaw.toString()),
    totalYAmount: new BN(totalYRaw.toString()),
    strategy: {
      minBinId: MIN_BIN_ID,
      maxBinId: MAX_BIN_ID,
      strategyType: STRATEGY,
    },
  } as any);

  // Extract the DLMM instruction
  const ixs = meteoraTx.instructions ?? (meteoraTx as any).message?.instructions;
  if (!ixs || ixs.length === 0) throw new Error("Meteora SDK returned no instructions");

  const dlmmIxs = ixs.filter((ix: any) => ix.programId.equals(DLMM_PROGRAM_ID));
  if (dlmmIxs.length === 0) throw new Error("No DLMM instruction found");

  console.log(`Total DLMM instructions: ${dlmmIxs.length}`);

  const initIx = dlmmIxs[0] as TransactionInstruction;
  const addLiqIx = dlmmIxs.length > 1 ? (dlmmIxs[1] as TransactionInstruction) : null;

  console.log(`InitializePosition accounts: ${initIx.keys.length}`);
  if (addLiqIx) console.log(`AddLiquidity accounts: ${addLiqIx.keys.length}`);

  // ──────────────────────────────────────────────────────────────
  // Helper: build CPI data from a Meteora instruction.
  // Uses camelCase (isSigner/isWritable) for Anchor JS serialization.
  // Replaces globalConfigPda payer (account[0] of initIx) with admin.
  // ──────────────────────────────────────────────────────────────
  function buildCpiData(meteoraIx: TransactionInstruction, replacePayer: boolean) {
    return {
      accounts: meteoraIx.keys.map((k, i) => {
        if (replacePayer && i === 0 && k.pubkey.equals(globalConfigPda)) {
          return { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true };
        }
        return { pubkey: k.pubkey, isSigner: k.isSigner, isWritable: k.isWritable };
      }),
      data: Buffer.from(meteoraIx.data),
    };
  }

  function buildRemainingAccounts(meteoraIx: TransactionInstruction) {
    const positionMintKey = positionMintKeypair.publicKey.toBase58();
    const adminKey = adminKeypair.publicKey.toBase58();
    return meteoraIx.keys.map((k) => {
      const key = k.pubkey.toBase58();
      let isSigner = false;
      if (key === positionMintKey) isSigner = true;
      if (key === adminKey) isSigner = true;
      return { pubkey: k.pubkey, isSigner, isWritable: k.isWritable };
    });
  }

  // ── Instruction 1: openDlmmPosition (initializePosition CPI + create PDA) ──
  const initCpiData = buildCpiData(initIx, true);

  let modeObj: any;
  if (STRATEGY === StrategyType.Spot) modeObj = { spot: {} };
  else if (STRATEGY === StrategyType.BidAsk) modeObj = { bidAsk: {} };
  else modeObj = { curve: {} };

  const params = {
    positionIndex: index,
    dlmmPool: POOL_ADDRESS,
    positionNft: positionMintKeypair.publicKey,
    binArrayLower: new PublicKey("11111111111111111111111111111111"),
    binArrayUpper: new PublicKey("11111111111111111111111111111111"),
    mode: modeObj,
    binIdLower: MIN_BIN_ID,
    binIdUpper: MAX_BIN_ID,
    tokenXAmount: new BN(totalXRaw.toString()),
    tokenYAmount: new BN(totalYRaw.toString()),
    ratio: 50,
    oneSided: Boolean(AMOUNT_X === 0 || AMOUNT_Y === 0),
  };

  const ix1 = await program.methods
    .openDlmmPosition(params, initCpiData)
    .accounts({
      admin: adminKeypair.publicKey,
      globalConfig: globalConfigPda,
      dlmmPosition: dlmmPositionPda!,
      vaultState: vaultStatePda,
      dlmmProgram: DLMM_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(buildRemainingAccounts(initIx))
    .instruction();

  // ── Instruction 2: claimDlmmFees (addLiquidityByStrategy CPI, claimed_amount=0) ──
  // Built manually because Anchor's encoder buffer is too small for 16 CPI accounts.
  const allInstructions = [ix1];

  if (addLiqIx) {
    console.log("\nBuilding addLiquidity instruction manually...");

    // The Meteora SDK sets user_token_x and user_token_y to globalConfigPda's ATAs.
    // But the vault's USDC is in a custom PDA, not the standard ATA.
    // Replace the ATA references with the actual vault token accounts.
    const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const globalConfigUsdcAta = await getAssociatedTokenAddress(USDC_MINT, globalConfigPda, true);
    const [vaultUsdcAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_usdc"), globalConfigPda.toBuffer()],
      PROGRAM_ID
    );

    // Also handle wrapped SOL ATA — the vault may store SOL differently
    const globalConfigSolAta = await getAssociatedTokenAddress(NATIVE_MINT, globalConfigPda, true);

    const addLiqCpiData = buildCpiData(addLiqIx, false);
    // Swap globalConfigPda's USDC ATA → vault USDC PDA
    for (const acct of addLiqCpiData.accounts) {
      if (acct.pubkey.equals(globalConfigUsdcAta)) {
        console.log(`  Swapping USDC ATA → vault USDC PDA: ${vaultUsdcAccount.toBase58()}`);
        acct.pubkey = vaultUsdcAccount;
      }
    }

    // Manually Borsh-encode the claimDlmmFees instruction data:
    // discriminator(8) + claimed_amount(u64, 8) + cpi_data.accounts(vec) + cpi_data.data(vec)
    // claim_dlmm_fees discriminator from IDL
    const discriminator = Buffer.from([102, 188, 67, 120, 236, 199, 117, 122]);

    const claimedAmountBuf = Buffer.alloc(8); // 0 as u64

    // Encode Vec<DlmmAccountMeta>
    const numAccounts = addLiqCpiData.accounts.length;
    const accountsLenBuf = Buffer.alloc(4);
    accountsLenBuf.writeUInt32LE(numAccounts);
    const accountsBufs = addLiqCpiData.accounts.map((a: any) => {
      const buf = Buffer.alloc(34); // 32 pubkey + 1 is_signer + 1 is_writable
      const pk = a.pubkey.toBuffer ? a.pubkey.toBuffer() : new PublicKey(a.pubkey).toBuffer();
      pk.copy(buf, 0);
      buf[32] = a.isSigner ? 1 : 0;
      buf[33] = a.isWritable ? 1 : 0;
      return buf;
    });

    // Encode Vec<u8> for instruction data
    const dataLenBuf = Buffer.alloc(4);
    dataLenBuf.writeUInt32LE(addLiqCpiData.data.length);

    const ixData = Buffer.concat([
      discriminator,
      claimedAmountBuf,
      accountsLenBuf,
      ...accountsBufs,
      dataLenBuf,
      addLiqCpiData.data,
    ]);

    console.log(`Manual IX data size: ${ixData.length} bytes`);

    // Build account metas for the instruction — apply same swaps as CPI data
    const addLiqRemaining = addLiqIx.keys.map((k) => {
      let pubkey = k.pubkey;
      if (pubkey.equals(globalConfigUsdcAta)) pubkey = vaultUsdcAccount;
      return { pubkey, isSigner: false, isWritable: k.isWritable };
    });

    const ix2 = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: globalConfigPda, isSigner: false, isWritable: true },
        { pubkey: dlmmPositionPda!, isSigner: false, isWritable: true },
        { pubkey: vaultStatePda, isSigner: false, isWritable: true },
        { pubkey: DLMM_PROGRAM_ID, isSigner: false, isWritable: false },
        ...addLiqRemaining,
      ],
      data: ixData,
    });

    allInstructions.push(ix2);
  }

  // ── Transaction 1: Initialize position ──
  console.log(`\nBuilding TX1: Initialize position...`);

  const latestBlockhash1 = await connection.getLatestBlockhash();
  const msg1 = new TransactionMessage({
    payerKey: adminKeypair.publicKey,
    recentBlockhash: latestBlockhash1.blockhash,
    instructions: [ix1],
  }).compileToV0Message();

  const tx1 = new VersionedTransaction(msg1);
  tx1.sign([adminKeypair, positionMintKeypair]);
  if ((meteoraTx as any).signers?.length) tx1.sign((meteoraTx as any).signers);

  console.log(`TX1 size: ${tx1.serialize().length} bytes`);
  console.log("Sending TX1 (initializePosition)...");
  const txId1 = await connection.sendRawTransaction(tx1.serialize(), { skipPreflight: false });
  console.log("TX1 sent:", txId1);

  await connection.confirmTransaction({
    signature: txId1,
    blockhash: latestBlockhash1.blockhash,
    lastValidBlockHeight: latestBlockhash1.lastValidBlockHeight,
  });
  console.log("TX1 confirmed: position initialized!");

  // ── Transaction 2: Add liquidity via ALT (if SDK returned the instruction) ──
  if (allInstructions.length > 1) {
    // Ensure globalConfigPda has ATAs for both tokens (Meteora needs user_token_x and user_token_y)
    const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const createAtaIxs: TransactionInstruction[] = [];

    for (const mint of [NATIVE_MINT, USDC_MINT]) {
      const ata = await getAssociatedTokenAddress(mint, globalConfigPda, true);
      const ataInfo = await connection.getAccountInfo(ata);
      if (!ataInfo) {
        console.log(`Creating ATA for ${mint.toBase58().slice(0, 8)}... → ${ata.toBase58()}`);
        createAtaIxs.push(
          createAssociatedTokenAccountIdempotentInstruction(
            adminKeypair.publicKey, ata, globalConfigPda, mint
          )
        );
      }
    }

    if (createAtaIxs.length > 0) {
      const ataBh = await connection.getLatestBlockhash();
      const ataMsg = new TransactionMessage({
        payerKey: adminKeypair.publicKey,
        recentBlockhash: ataBh.blockhash,
        instructions: createAtaIxs,
      }).compileToV0Message();
      const ataTx = new VersionedTransaction(ataMsg);
      ataTx.sign([adminKeypair]);
      const ataTxId = await connection.sendRawTransaction(ataTx.serialize(), { skipPreflight: false });
      await connection.confirmTransaction({ signature: ataTxId, blockhash: ataBh.blockhash, lastValidBlockHeight: ataBh.lastValidBlockHeight });
      console.log("ATAs created!");
    }

    console.log(`\nCreating Address Lookup Table for TX2...`);

    // Collect all unique accounts from the addLiquidity instruction
    const ix2 = allInstructions[1];
    const allKeys = ix2.keys.map(k => k.pubkey);
    const uniqueKeys = [...new Set(allKeys.map(k => k.toBase58()))].map(k => new PublicKey(k));
    console.log(`Unique accounts: ${uniqueKeys.length}`);

    // Create ALT
    const recentSlot = await connection.getSlot("finalized");
    const [createAltIx, altAddress] = AddressLookupTableProgram.createLookupTable({
      authority: adminKeypair.publicKey,
      payer: adminKeypair.publicKey,
      recentSlot,
    });

    // Extend ALT with all accounts (max 30 per extend)
    const extendIxs: TransactionInstruction[] = [];
    for (let i = 0; i < uniqueKeys.length; i += 30) {
      extendIxs.push(
        AddressLookupTableProgram.extendLookupTable({
          lookupTable: altAddress,
          authority: adminKeypair.publicKey,
          payer: adminKeypair.publicKey,
          addresses: uniqueKeys.slice(i, i + 30),
        })
      );
    }

    // Send ALT creation + extension in one tx
    const altBlockhash = await connection.getLatestBlockhash();
    const altMsg = new TransactionMessage({
      payerKey: adminKeypair.publicKey,
      recentBlockhash: altBlockhash.blockhash,
      instructions: [createAltIx, ...extendIxs],
    }).compileToV0Message();
    const altTx = new VersionedTransaction(altMsg);
    altTx.sign([adminKeypair]);

    const altTxId = await connection.sendRawTransaction(altTx.serialize(), { skipPreflight: false });
    console.log("ALT created:", altAddress.toBase58(), "tx:", altTxId);
    await connection.confirmTransaction({
      signature: altTxId,
      blockhash: altBlockhash.blockhash,
      lastValidBlockHeight: altBlockhash.lastValidBlockHeight,
    });

    // Wait for ALT to be active (needs ~1 slot after creation)
    console.log("Waiting for ALT activation...");
    let altAccount = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      const resp = await connection.getAddressLookupTable(altAddress);
      if (resp.value && resp.value.state.addresses.length > 0) {
        altAccount = resp.value;
        break;
      }
    }
    if (!altAccount) throw new Error("ALT failed to activate");
    console.log(`ALT active with ${altAccount.state.addresses.length} addresses`);

    // Build TX2 with ALT and increased compute budget
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
    const latestBlockhash2 = await connection.getLatestBlockhash();
    const msg2 = new TransactionMessage({
      payerKey: adminKeypair.publicKey,
      recentBlockhash: latestBlockhash2.blockhash,
      instructions: [computeBudgetIx, ix2],
    }).compileToV0Message([altAccount]);

    const tx2 = new VersionedTransaction(msg2);
    tx2.sign([adminKeypair]);

    console.log(`TX2 size: ${tx2.serialize().length} bytes`);
    console.log("Sending TX2 (addLiquidity)...");
    const txId2 = await connection.sendRawTransaction(tx2.serialize(), { skipPreflight: false });
    console.log("TX2 sent:", txId2);

    await connection.confirmTransaction({
      signature: txId2,
      blockhash: latestBlockhash2.blockhash,
      lastValidBlockHeight: latestBlockhash2.lastValidBlockHeight,
    });
    console.log("TX2 confirmed: liquidity added!");

    // Cleanup: deactivate and close ALT to reclaim rent
    console.log("Cleaning up ALT...");
    const deactivateIx = AddressLookupTableProgram.deactivateLookupTable({
      lookupTable: altAddress,
      authority: adminKeypair.publicKey,
    });
    const cleanupBh = await connection.getLatestBlockhash();
    const cleanupMsg = new TransactionMessage({
      payerKey: adminKeypair.publicKey,
      recentBlockhash: cleanupBh.blockhash,
      instructions: [deactivateIx],
    }).compileToV0Message();
    const cleanupTx = new VersionedTransaction(cleanupMsg);
    cleanupTx.sign([adminKeypair]);
    await connection.sendRawTransaction(cleanupTx.serialize(), { skipPreflight: true });
    console.log("ALT deactivated (will be closeable after cooldown)");
  }

  console.log("\nPosition opened successfully!");
  console.log("Transaction:", txId1);
  console.log("Position Index:", index);
  console.log("Position Mint:", positionMintKeypair.publicKey.toBase58());
}

main().catch((err) => {
  console.error("\nFailed to open position:", err.message || err);
  if (err.logs) {
    console.error("\nProgram logs:");
    err.logs.forEach((log: string) => console.error("  ", log));
  }
  process.exit(1);
});
