import { PublicKey } from "@solana/web3.js";
import DLMM, { StrategyType } from "@meteora-ag/dlmm";

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
  data: number[];
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
    data: Array.from(ix.data),
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
  user: PublicKey;
  positionPubkey: PublicKey;
  totalXAmount: bigint;
  totalYAmount: bigint;
  minBinId: number;
  maxBinId: number;
  strategyType: StrategyType;
}): Promise<DlmmCpiData> {
  const pool = await DLMM.create(params.connection, params.pool);

  // Meteora SDK returns a Transaction (or TransactionMessage) with instructions; we need the core ix.
  const tx = await pool.initializePositionAndAddLiquidityByStrategy({
    positionPubKey: params.positionPubkey,
    user: params.user,
    totalXAmount: params.totalXAmount,
    totalYAmount: params.totalYAmount,
    strategy: {
      minBinId: params.minBinId,
      maxBinId: params.maxBinId,
      strategyType: params.strategyType,
    },
  } as any);

  // SDK versions differ; handle common shapes.
  const ixs =
    // @ts-expect-error
    tx.instructions ?? (tx as any).message?.instructions ?? (tx as any).compileMessage?.().instructions;

  if (!ixs || ixs.length === 0) {
    throw new Error("Meteora SDK returned no instructions");
  }

  // Use the first instruction as the CPI payload (typically the initialize+add liquidity instruction).
  return toDlmmCpiData(ixs[0]);
}

/**
 * Build a Meteora DLMM "close position" instruction CPI payload.
 */
export async function buildClosePositionCpi(params: {
  connection: Parameters<typeof DLMM.create>[0];
  pool: PublicKey;
  user: PublicKey;
  positionPubkey: PublicKey;
}): Promise<DlmmCpiData> {
  const pool = await DLMM.create(params.connection, params.pool);

  const tx = await pool.closePosition({
    user: params.user,
    positionPubKey: params.positionPubkey,
  } as any);

  // SDK versions differ; handle common shapes.
  const ixs =
    // @ts-expect-error
    tx.instructions ??
    (tx as any).message?.instructions ??
    (tx as any).compileMessage?.().instructions;

  if (!ixs || ixs.length === 0) {
    throw new Error("Meteora SDK returned no instructions");
  }

  return toDlmmCpiData(ixs[0]);
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

  const tx = await pool.claimSwapFee({
    user: params.user,
    positionPubKey: params.positionPubkey,
  } as any);

  const ixs =
    // @ts-expect-error
    tx.instructions ??
    (tx as any).message?.instructions ??
    (tx as any).compileMessage?.().instructions;

  if (!ixs || ixs.length === 0) {
    throw new Error("Meteora SDK returned no instructions");
  }

  return toDlmmCpiData(ixs[0]);
}

