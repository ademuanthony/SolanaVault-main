import { PublicKey, Connection } from "@solana/web3.js";

/**
 * Types that mirror the on-chain JupiterSwapData and SwapAccountMeta.
 * These should match the Anchor IDL generated for the Rust structs.
 */
export interface SwapAccountMeta {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
}

export interface JupiterSwapData {
  accounts: {
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  data: number[]; // raw instruction data bytes
}

export interface BuildJupiterCpiParams {
  connection: Connection;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: bigint; // in smallest units (e.g. USDC 1e6)
  slippageBps: number;
  /**
   * The authority that Jupiter expects as `userPublicKey`.
   * For CPI, this is typically a PDA you control (e.g. GlobalConfig).
   */
  userPublicKey: PublicKey;
}

export interface BuildJupiterCpiResult {
  swapData: JupiterSwapData;
  /**
   * All accounts required by Jupiter in the correct order.
   * Callers should pass:
   * - explicit accounts (source/destination/token_program) via `.accounts({...})`
   * - the remaining ones via `.remainingAccounts(...)`
   */
  allMetas: SwapAccountMeta[];
}

/**
 * Build JupiterSwapData + ordered AccountMetas for CPI from off-chain.
 *
 * This helper:
 * - Calls Jupiter's v6 quote API
 * - Calls /swap-instructions to get a single swap instruction
 * - Converts that into:
 *   - swapData: to pass into `program.methods.jupiterSwap(...)`
 *   - allMetas: full ordered list of account metas for `remainingAccounts`
 */
export async function buildJupiterCpi(
  params: BuildJupiterCpiParams
): Promise<BuildJupiterCpiResult> {
  const { inputMint, outputMint, amount, slippageBps, userPublicKey } = params;

  const quoteUrl = new URL("https://quote-api.jup.ag/v6/quote");
  quoteUrl.searchParams.set("inputMint", inputMint.toBase58());
  quoteUrl.searchParams.set("outputMint", outputMint.toBase58());
  quoteUrl.searchParams.set("amount", amount.toString());
  quoteUrl.searchParams.set("slippageBps", slippageBps.toString());

  const quoteRes = await fetch(quoteUrl.toString());
  if (!quoteRes.ok) {
    throw new Error(`Jupiter quote failed: ${quoteRes.status} ${quoteRes.statusText}`);
  }
  const quoteResponse = await quoteRes.json();

  const swapRes = await fetch("https://quote-api.jup.ag/v6/swap-instructions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: userPublicKey.toBase58(),
      wrapUnwrapSOL: false,
    }),
  });

  if (!swapRes.ok) {
    throw new Error(
      `Jupiter swap-instructions failed: ${swapRes.status} ${swapRes.statusText}`
    );
  }

  const swapJson = await swapRes.json();

  // We only need the main swap instruction for CPI.
  const swapIx = swapJson.swapInstruction;
  if (!swapIx) {
    throw new Error("Jupiter response missing swapInstruction");
  }

  const allMetas: SwapAccountMeta[] = swapIx.accounts.map((acc: any) => ({
    pubkey: new PublicKey(acc.pubkey),
    isSigner: acc.isSigner,
    isWritable: acc.isWritable,
  }));

  const dataBytes = Array.from(
    Buffer.from(swapIx.data, "base64") // Jupiter encodes instruction data as base64
  );

  const swapData: JupiterSwapData = {
    accounts: allMetas,
    data: dataBytes,
  };

  return { swapData, allMetas };
}

