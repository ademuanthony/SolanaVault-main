import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import DLMM from "@meteora-ag/dlmm";
import BN from "bn.js";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("3TV5FTYziezR5xrp9SAeR6zLU4brnTLQuegjixpBrV1t");
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_PRICE_URL = "https://lite-api.jup.ag/price/v3";

const RPC_URL = process.env.ANCHOR_PROVIDER_URL || "https://solana-mainnet.core.chainstack.com/4ed69be823c47a9517d79bd7c873acf6";
const DRY_RUN = process.argv.includes("--dry-run") || process.argv.includes("-n");
const MAX_DECREASE_BPS = 2000; // must match update_tvl.rs

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

async function fetchJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  const url = `${JUP_PRICE_URL}?ids=${mints.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jupiter price fetch ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as Record<string, { usdPrice?: number }>;
  const out: Record<string, number> = {};
  for (const [mint, data] of Object.entries(body)) {
    if (typeof data?.usdPrice === "number") out[mint] = data.usdPrice;
  }
  return out;
}

async function main() {
  const admin = loadAdmin();
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "target", "idl", "solana_vault.json"), "utf-8"));
  const program = new Program(idl, provider) as any;

  const [globalConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
  const [vaultStatePda] = PublicKey.findProgramAddressSync([Buffer.from("vault_state")], PROGRAM_ID);

  console.log(`Admin:           ${admin.publicKey.toBase58()}`);
  console.log(`globalConfigPda: ${globalConfigPda.toBase58()}`);
  console.log(`Mode:            ${DRY_RUN ? "DRY RUN (no tx will be sent)" : "LIVE"}\n`);

  // 1. Enumerate every token account owned by globalConfigPda (includes vaultUsdcPda
  //    since its authority = globalConfig, plus every standard ATA that Meteora/
  //    Jupiter flows have ever created).
  const tokenResp = await connection.getParsedTokenAccountsByOwner(globalConfigPda, { programId: TOKEN_PROGRAM_ID });
  interface TokenBal { account: PublicKey; mint: string; raw: bigint; decimals: number; ui: number }
  const balances: TokenBal[] = [];
  for (const e of tokenResp.value) {
    const info = e.account.data.parsed.info;
    const raw = BigInt(info.tokenAmount.amount);
    if (raw === 0n) continue;
    balances.push({
      account: e.pubkey,
      mint: info.mint,
      raw,
      decimals: info.tokenAmount.decimals,
      ui: Number(info.tokenAmount.uiAmountString),
    });
  }

  // 2. Price every non-USDC mint via Jupiter
  const nonUsdcMints = [...new Set(balances.filter((b) => b.mint !== USDC_MINT).map((b) => b.mint))];
  const prices = await fetchJupiterPrices(nonUsdcMints);

  console.log(`Vault token balances (${balances.length}):`);
  let vaultTokenValueRaw = 0;
  for (const b of balances) {
    const mintShort = b.mint.slice(0, 8) + "…";
    if (b.mint === USDC_MINT) {
      vaultTokenValueRaw += Number(b.raw);
      console.log(`  ${mintShort}  ${b.ui.toFixed(6)} USDC              → ${b.ui.toFixed(6)} USDC`);
    } else {
      const p = prices[b.mint];
      if (p == null) {
        console.log(`  ${mintShort}  ${b.ui}  ⚠ no Jupiter price — skipped`);
        continue;
      }
      const usd = b.ui * p;
      const raw = Math.floor(usd * 1e6);
      vaultTokenValueRaw += raw;
      console.log(`  ${mintShort}  ${b.ui}  @ $${p.toFixed(4)}  → ${usd.toFixed(6)} USDC`);
    }
  }

  // 3. Scan DlmmPosition PDAs and value live ones
  const vaultState = await program.account.vaultState.fetch(vaultStatePda);
  const scanCount = Math.max(Number(vaultState.positionsCount) + 5, 16);
  const pdas: PublicKey[] = [];
  for (let i = 0; i < scanCount; i++) {
    const [pda] = PublicKey.findProgramAddressSync([Buffer.from("dlmm_position"), Buffer.from([i])], PROGRAM_ID);
    pdas.push(pda);
  }
  const infos = await connection.getMultipleAccountsInfo(pdas);

  interface Live { index: number; pda: PublicKey; pool: PublicKey; nft: PublicKey }
  const live: Live[] = [];
  for (let i = 0; i < infos.length; i++) {
    if (!infos[i]) continue;
    try {
      const acct = program.coder.accounts.decode("DlmmPosition", infos[i]!.data);
      live.push({ index: i, pda: pdas[i], pool: acct.dlmmPool, nft: acct.positionNft });
    } catch { /* different account discriminator */ }
  }
  console.log(`\nActive tracking PDAs: ${live.length}`);

  let positionsValueRaw = 0;
  for (const p of live) {
    const label = `  [${p.index}] nft=${p.nft.toBase58().slice(0, 8)}…`;
    try {
      const pool = await DLMM.create(connection, p.pool);
      const posData = await pool.getPosition(p.nft);
      if (!posData?.positionData) { console.log(`${label}  no data`); continue; }

      const mintX = pool.lbPair.tokenXMint.toBase58();
      const mintY = pool.lbPair.tokenYMint.toBase58();

      // Fetch mint decimals via Jupiter price payload (it returns decimals) or fallback.
      // We already have USDC decimals = 6; fetch any missing ones.
      const neededMints = [mintX, mintY].filter((m) => m !== USDC_MINT && prices[m] === undefined);
      if (neededMints.length > 0) {
        const more = await fetchJupiterPrices(neededMints);
        Object.assign(prices, more);
      }
      const xDec = mintX === USDC_MINT ? 6 : (await connection.getParsedAccountInfo(new PublicKey(mintX))).value?.data as any;
      const yDec = mintY === USDC_MINT ? 6 : (await connection.getParsedAccountInfo(new PublicKey(mintY))).value?.data as any;
      const xDecN = typeof xDec === "number" ? xDec : xDec?.parsed?.info?.decimals ?? 9;
      const yDecN = typeof yDec === "number" ? yDec : yDec?.parsed?.info?.decimals ?? 6;

      const posX = Number(posData.positionData.totalXAmount?.toString() || "0") / 10 ** xDecN;
      const posY = Number(posData.positionData.totalYAmount?.toString() || "0") / 10 ** yDecN;
      const feeX = Number(posData.positionData.feeX?.toString() || "0") / 10 ** xDecN;
      const feeY = Number(posData.positionData.feeY?.toString() || "0") / 10 ** yDecN;

      // Value each side via Jupiter; USDC side is 1:1.
      const pX = mintX === USDC_MINT ? 1 : (prices[mintX] ?? 0);
      const pY = mintY === USDC_MINT ? 1 : (prices[mintY] ?? 0);
      if (mintX !== USDC_MINT && prices[mintX] == null) console.log(`${label}  ⚠ no price for tokenX ${mintX.slice(0,8)}…`);
      if (mintY !== USDC_MINT && prices[mintY] == null) console.log(`${label}  ⚠ no price for tokenY ${mintY.slice(0,8)}…`);

      const valueUsdc = (posX + feeX) * pX + (posY + feeY) * pY;
      const valueRaw = Math.floor(valueUsdc * 1e6);
      positionsValueRaw += valueRaw;

      console.log(`${label}  liq: ${posX.toFixed(6)}X + ${posY.toFixed(6)}Y   fees: ${feeX.toFixed(6)}X + ${feeY.toFixed(6)}Y   ≈ ${valueUsdc.toFixed(6)} USDC`);
    } catch (e: any) {
      console.log(`${label}  ERROR: ${e.message}`);
    }
  }

  const newTvl = vaultTokenValueRaw + positionsValueRaw;
  const currentTvl = Number(vaultState.totalTvl);
  const delta = newTvl - currentTvl;

  console.log(`\n---- Summary ----`);
  console.log(`Vault tokens:     ${(vaultTokenValueRaw / 1e6).toFixed(6)} USDC`);
  console.log(`Positions value:  ${(positionsValueRaw / 1e6).toFixed(6)} USDC`);
  console.log(`Computed TVL:     ${(newTvl / 1e6).toFixed(6)} USDC  (${newTvl} raw)`);
  console.log(`On-chain TVL:     ${(currentTvl / 1e6).toFixed(6)} USDC  (${currentTvl} raw)`);
  console.log(`Delta:            ${delta >= 0 ? "+" : ""}${(delta / 1e6).toFixed(6)} USDC`);

  if (delta < 0) {
    const maxDecrease = Math.floor((currentTvl * MAX_DECREASE_BPS) / 10_000);
    const actualDecrease = -delta;
    if (actualDecrease > maxDecrease) {
      console.error(`\nERROR: decrease ${actualDecrease} exceeds per-call cap ${maxDecrease} (20% of current TVL).`);
      console.error(`       Run update_tvl multiple times, each lowering by <=20%, to converge on the target.`);
      process.exit(2);
    }
  }

  if (DRY_RUN) {
    console.log(`\n(dry run — no transaction sent)`);
    return;
  }

  if (delta === 0) {
    console.log(`\nNo change — on-chain TVL already matches. Skipping update_tvl.`);
    return;
  }

  const sig = await program.methods
    .updateTvl(new BN(newTvl))
    .accounts({
      admin: admin.publicKey,
      globalConfig: globalConfigPda,
      vaultState: vaultStatePda,
    })
    .rpc();

  console.log(`\nupdate_tvl sent: ${sig}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
