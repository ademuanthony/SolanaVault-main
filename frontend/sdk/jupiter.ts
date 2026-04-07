import { PublicKey, Connection, AddressLookupTableAccount } from "@solana/web3.js";

/**
 * Types that mirror the on-chain JupiterSwapData and SwapAccountMeta.
 * These should match the Anchor IDL generated for the Rust structs.
 */
export interface SwapAccountMeta {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
}

/** Matches on-chain Borsh layout — use camelCase for Anchor JS client serialization */
export interface JupiterSwapData {
  accounts: {
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  data: Buffer;
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

export interface ParsedInstruction {
  programId: PublicKey;
  accounts: SwapAccountMeta[];
  data: Buffer;
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
  /** Address lookup tables for building versioned transactions */
  addressLookupTableAccounts: AddressLookupTableAccount[];
  /** Setup instructions (e.g. ATA creation) that must run before the swap */
  setupInstructions: ParsedInstruction[];
  /** Optional cleanup instruction (e.g. close wSOL account) */
  cleanupInstruction: ParsedInstruction | null;
}

/**
 * Build JupiterSwapData + ordered AccountMetas for CPI from off-chain.
 *
 * This helper:
 * - Calls Jupiter's v1 quote API
 * - Calls /swap-instructions to get a single swap instruction
 * - Fetches address lookup tables for versioned transaction compression
 * - Converts that into:
 *   - swapData: to pass into `program.methods.jupiterSwap(...)`
 *   - allMetas: full ordered list of account metas for `remainingAccounts`
 *   - addressLookupTableAccounts: for building v0 VersionedTransactions
 */
export async function buildJupiterCpi(
  params: BuildJupiterCpiParams
): Promise<BuildJupiterCpiResult> {
  const { connection, inputMint, outputMint, amount, slippageBps, userPublicKey } = params;

  const quoteUrl = new URL("https://api.jup.ag/swap/v1/quote");
  quoteUrl.searchParams.set("inputMint", inputMint.toBase58());
  quoteUrl.searchParams.set("outputMint", outputMint.toBase58());
  quoteUrl.searchParams.set("amount", amount.toString());
  quoteUrl.searchParams.set("slippageBps", slippageBps.toString());
  // Force direct routes to keep account count low enough for CPI (avoids tx size limit)
  quoteUrl.searchParams.set("onlyDirectRoutes", "true");

  const apiKey = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_JUPITER_API_KEY
    ? process.env.NEXT_PUBLIC_JUPITER_API_KEY
    : undefined;

  const authHeaders: Record<string, string> = apiKey
    ? { "x-api-key": apiKey }
    : {};

  const quoteRes = await fetch(quoteUrl.toString(), { headers: authHeaders });
  if (!quoteRes.ok) {
    const body = await quoteRes.text();
    throw new Error(`Jupiter quote failed: ${quoteRes.status} ${body}`);
  }
  const quoteResponse = await quoteRes.json();

  const swapRes = await fetch("https://api.jup.ag/swap/v1/swap-instructions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: userPublicKey.toBase58(),
      wrapUnwrapSOL: false,
      useSharedAccounts: true, // Use SharedAccountsRoute — required for CPI
    }),
  });

  if (!swapRes.ok) {
    const body = await swapRes.text();
    throw new Error(`Jupiter swap-instructions failed: ${swapRes.status} ${body}`);
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

  const dataBuffer = Buffer.from(swapIx.data, "base64"); // Jupiter encodes instruction data as base64

  // Use camelCase keys — Anchor JS client converts IDL snake_case to camelCase
  const swapData: JupiterSwapData = {
    accounts: allMetas.map(m => ({
      pubkey: m.pubkey,
      isSigner: m.isSigner,
      isWritable: m.isWritable,
    })),
    data: dataBuffer,
  };

  // Parse setup instructions
  const setupInstructions: ParsedInstruction[] = (swapJson.setupInstructions || []).map((ix: any) => ({
    programId: new PublicKey(ix.programId),
    accounts: ix.accounts.map((acc: any) => ({
      pubkey: new PublicKey(acc.pubkey),
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  }));

  // Parse cleanup instruction
  const rawCleanup = swapJson.cleanupInstruction;
  const cleanupInstruction: ParsedInstruction | null = rawCleanup
    ? {
        programId: new PublicKey(rawCleanup.programId),
        accounts: rawCleanup.accounts.map((acc: any) => ({
          pubkey: new PublicKey(acc.pubkey),
          isSigner: acc.isSigner,
          isWritable: acc.isWritable,
        })),
        data: Buffer.from(rawCleanup.data, "base64"),
      }
    : null;

  // Fetch address lookup tables for versioned transaction compression
  const altAddresses: string[] = swapJson.addressLookupTableAddresses || [];
  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];

  if (altAddresses.length > 0) {
    const altResults = await Promise.all(
      altAddresses.map(addr => connection.getAddressLookupTable(new PublicKey(addr)))
    );
    for (const result of altResults) {
      if (result.value) {
        addressLookupTableAccounts.push(result.value);
      }
    }
  }

  return { swapData, allMetas, addressLookupTableAccounts, setupInstructions, cleanupInstruction };
}
