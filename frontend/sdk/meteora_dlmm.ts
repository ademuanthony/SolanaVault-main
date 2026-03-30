import { PublicKey, Keypair, TransactionInstruction } from "@solana/web3.js";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";
import BN from "bn.js";

/**
 * Types that mirror the on-chain DlmmCpiData and DlmmAccountMeta.
 */
export interface DlmmAccountMeta {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
}

export interface DlmmCpiData {
  accounts: DlmmAccountMeta[];
  data: Buffer;
  signers?: Keypair[];
}

/**
 * Convert a web3.js TransactionInstruction into the on-chain CPI payload.
 */
export function toDlmmCpiData(ix: {
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[];
  data: Buffer | Uint8Array;
}): DlmmCpiData {
  return {
    accounts: ix.keys.map((k) => ({
      pubkey: k.pubkey,
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: Buffer.from(ix.data),
    signers: [],
  };
}

/**
 * Build a Meteora DLMM "open position + add liquidity by strategy" instruction.
 *
 * This returns only the CPI payload; you are responsible for:
 * - Passing `dlmmProgram` account as `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
 * - Passing ALL required accounts (from the returned instruction keys) into your Anchor call,
 *   using `.remainingAccounts(...)` in the same order.
 */
export async function buildOpenPositionCpi(params: {
  connection: Parameters<typeof DLMM.create>[0];
  pool: PublicKey;
  /** PDA or wallet that will own the position and provide liquidity */
  payer: PublicKey;
  user: PublicKey;
  positionPubkey: PublicKey;
  totalXAmount: bigint;
  totalYAmount: bigint;
  minBinId: number;
  maxBinId: number;
  strategyType: StrategyType;
}): Promise<DlmmCpiData> {
  const pool = await DLMM.create(params.connection, params.pool);

  // Convert bigint to BN as required by Meteora SDK
  const totalXAmountBN = new BN(params.totalXAmount.toString());
  const totalYAmountBN = new BN(params.totalYAmount.toString());

  // Meteora SDK returns a Transaction (or TransactionMessage) with instructions; we need the core ix.
  const tx = await pool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: params.positionPubkey,
    user: params.user,
    payer: params.payer,
    totalXAmount: totalXAmountBN,
    totalYAmount: totalYAmountBN,
    strategy: {
      minBinId: params.minBinId,
      maxBinId: params.maxBinId,
      strategyType: params.strategyType,
    },
  } as any);

  // SDK versions differ; handle common shapes.
  const ixs =
    tx.instructions ?? (tx as any).message?.instructions ?? (tx as any).compileMessage?.().instructions;

  const cpiData = getDlmmInstruction(ixs);

  // Attach any signers returned by the SDK (e.g. for new accounts)
  if ((tx as any).signers && (tx as any).signers.length > 0) {
    cpiData.signers = (tx as any).signers;
  }

  return cpiData;
}

/**
 * Build a Meteora DLMM "close position" instruction CPI payload.
 */
export async function buildClosePositionCpi(params: {
  connection: Parameters<typeof DLMM.create>[0];
  pool: PublicKey;
  user: PublicKey;
  positionPubkey: PublicKey;
  payer: PublicKey;
}): Promise<DlmmCpiData> {
  const pool = await DLMM.create(params.connection, params.pool);

  console.log("Fetching positions for owner:", params.user.toBase58());
  const { userPositions } = await pool.getPositionsByUserAndLbPair(params.user);
  console.log("Found user positions mapping for pool:", userPositions.length);

  // The params.positionPubkey IS the Position Account Address (stored as positionNft in vault state).
  const expectedPositionPubkey = params.positionPubkey;
  console.log("Using Position Address:", expectedPositionPubkey.toBase58());

  // Check if the account exists checks
  const positionAccountInfo = await params.connection.getAccountInfo(expectedPositionPubkey);
  if (!positionAccountInfo) {
    console.error("CRITICAL: Position Account does not exist on-chain:", expectedPositionPubkey.toBase58());
    throw new Error("Position Account not found");
  } else {
    console.log("Confirmed Position Account exists on-chain. Owner Program:", positionAccountInfo.owner.toBase58());
  }

  // Attempt to fetch and parse data directly using Anchor
  let positionData;
  try {
    positionData = await pool.program.account.position.fetch(expectedPositionPubkey);
    console.log("Fetched Position Info directly from chain.");
    // Check owner just for debugging
    if (positionData.owner && positionData.owner.toBase58() !== params.user.toBase58()) {
      console.warn(`WARNING: Position owner mismatch! On-chain: ${positionData.owner.toBase58()}, Expected: ${params.user.toBase58()}`);
    }
  } catch (e) {
    console.error("Failed to fetch/parse position data via Anchor:", e);
  }

  let positionToClose = userPositions.find(p => p.publicKey.equals(expectedPositionPubkey));

  if (!positionToClose && positionData) {
    console.log("Constructing LbPosition object manually from fetched data...");
    positionToClose = {
      publicKey: expectedPositionPubkey,
      positionData: positionData as any,
      version: 1 // Default to V2 (which is 1 in internal enum usually, but let's check)
    };
  }

  if (!positionToClose) {
    throw new Error(`Position not found/constructible for address ${params.positionPubkey.toBase58()}`);
  }

  const tx = await pool.closePosition({
    owner: params.user,
    position: positionToClose,
    payer: params.payer,
  } as any);

  // SDK versions differ; handle common shapes.
  const ixs =
    tx.instructions ??
    (tx as any).message?.instructions ??
    (tx as any).compileMessage?.().instructions;

  return getDlmmInstruction(ixs);
}

/**
 * Build a Meteora DLMM "claim swap fee" instruction CPI payload.
 *
 * Note: Depending on pool configuration, the SDK may return multiple instructions.
 * If so, you may need to forward them one-by-one (we currently return the first).
 */
export async function buildClaimSwapFeeCpi(params: {
  connection: Parameters<typeof DLMM.create>[0];
  pool: PublicKey;
  user: PublicKey;
  positionPubkey: PublicKey;
}): Promise<DlmmCpiData> {
  const pool = await DLMM.create(params.connection, params.pool);

  console.log("Fetching positions for owner (Claim):", params.user.toBase58());
  const { userPositions } = await pool.getPositionsByUserAndLbPair(params.user);

  // The params.positionPubkey IS the Position Account Address.
  const expectedPositionPubkey = params.positionPubkey;

  let positionToClaim = userPositions.find(p => p.publicKey.equals(expectedPositionPubkey));

  if (!positionToClaim) {
    console.log("Position not in user list, attempting manual fetch for claim...");
    // Try PositionV2 first (modern)
    let positionData;
    let version = 1; // V2
    try {
      positionData = await pool.program.account.positionV2.fetch(expectedPositionPubkey);
      console.log("Found PositionV2 for claim.");
    } catch (e) {
      try {
        positionData = await pool.program.account.position.fetch(expectedPositionPubkey);
        console.log("Found Position (V1) for claim.");
        version = 0;
      } catch (e2) {
        throw new Error(`Position Account not found for claiming fees: ${expectedPositionPubkey.toBase58()}`);
      }
    }

    positionToClaim = {
      publicKey: expectedPositionPubkey,
      positionData: positionData as any,
      version
    };
  }

  let txs: any;
  try {
    txs = await pool.claimSwapFee({
      owner: params.user,
      position: positionToClaim,
    } as any);
  } catch (e: any) {
    if (e.message && e.message.includes("No fee to claim")) {
      console.log("SDK reported no fees to claim. Returning no-op.");
      return {
        data: Buffer.alloc(0),
        accounts: [],
        // @ts-ignore - custom flag for useVault
        isNoOp: true,
      };
    }
    throw e;
  }

  // If it's an array, take the first one (usually simplified for CPI purposes)
  if (Array.isArray(txs)) {
    txs = txs[0];
  }

  const ixs =
    txs.instructions ??
    (txs as any).message?.instructions ??
    (txs as any).compileMessage?.().instructions;

  return getDlmmInstruction(ixs);
}

/**
 * Helper to extract the DLMM instruction from a list of instructions
 */
function getDlmmInstruction(ixs: any[]): DlmmCpiData {
  if (!ixs || ixs.length === 0) {
    throw new Error("Meteora SDK returned no instructions");
  }

  // Filter for the instruction that targets the DLMM program
  const dlmmProgramId = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
  const dlmmInstructions = ixs.filter((ix: any) => ix.programId.equals(dlmmProgramId));

  if (dlmmInstructions.length === 0) {
    console.error("Meteora SDK instructions:", ixs);
    throw new Error("No DLMM Program instruction found in SDK output");
  }

  if (dlmmInstructions.length > 1) {
    console.warn("Multiple DLMM instructions found. Using the first one.", dlmmInstructions);
  }

  // Use the first DLMM instruction
  return toDlmmCpiData(dlmmInstructions[0]);
}
