/**
 * Admin script: distribute welcome bonus to a registered user.
 *
 * Transfers `welcome_bonus_user + 3 * welcome_bonus_dev` USDC from admin to the
 * vault, mints shares worth `welcome_bonus_user` to the user, then pays each
 * dev wallet `welcome_bonus_dev` from the vault.
 *
 * Any missing destination ATAs (user share ATA, dev USDC ATAs) are created
 * idempotently first — the on-chain handler expects them to exist.
 *
 * Usage:
 *   yarn ts-node --transpile-only scripts/welcome_bonus.ts <userWallet>
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

const PROGRAM_ID = new PublicKey("G9hoVfjm6QHGMQZpHpVsUGQmSBD6LQaXk9UbD5BzqtWR");
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
  const [userArg] = process.argv.slice(2);
  if (!userArg) {
    console.error("Usage: welcome_bonus.ts <userWallet>");
    process.exit(1);
  }
  const userWallet = new PublicKey(userArg);

  const admin = loadAdmin();
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(admin), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "target", "idl", "solana_vault.json"), "utf-8"));
  const program = new Program(idl, provider) as any;

  const [globalConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
  const [vaultStatePda] = PublicKey.findProgramAddressSync([Buffer.from("vault_state")], PROGRAM_ID);
  const [vaultUsdcPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_usdc"), globalConfigPda.toBuffer()],
    PROGRAM_ID,
  );
  const [userAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_account"), userWallet.toBuffer()],
    PROGRAM_ID,
  );

  const globalConfig = await program.account.globalConfig.fetch(globalConfigPda);
  const usdcMint = globalConfig.usdcMint as PublicKey;
  const shareMint = globalConfig.shareMint as PublicKey;
  const bonusUser = BigInt(globalConfig.welcomeBonusUser.toString());
  const bonusDev = BigInt(globalConfig.welcomeBonusDev.toString());
  const totalBonus = bonusUser + bonusDev * 3n;

  console.log(`Admin:            ${admin.publicKey.toBase58()}`);
  console.log(`User:             ${userWallet.toBase58()}`);
  console.log(`Bonus (user):     ${Number(bonusUser) / 1e6} USDC`);
  console.log(`Bonus (per dev):  ${Number(bonusDev) / 1e6} USDC`);
  console.log(`Total debited:    ${Number(totalBonus) / 1e6} USDC from admin\n`);

  const userAcct = await connection.getAccountInfo(userAccountPda);
  if (!userAcct) {
    console.error(`ERROR: user account PDA ${userAccountPda.toBase58()} does not exist. Register the user first (admin_register.ts).`);
    process.exit(2);
  }

  const adminUsdc = await getAssociatedTokenAddress(usdcMint, admin.publicKey);
  const userShare = await getAssociatedTokenAddress(shareMint, userWallet);
  const dev1Usdc = await getAssociatedTokenAddress(usdcMint, globalConfig.dev1Wallet);
  const dev2Usdc = await getAssociatedTokenAddress(usdcMint, globalConfig.dev2Wallet);
  const dev3Usdc = await getAssociatedTokenAddress(usdcMint, globalConfig.dev3Wallet);

  // Ensure every destination ATA exists (the on-chain handler does not init them).
  const prereqs: { ata: PublicKey; owner: PublicKey; mint: PublicKey; label: string }[] = [
    { ata: userShare, owner: userWallet, mint: shareMint, label: "user share" },
    { ata: dev1Usdc, owner: globalConfig.dev1Wallet, mint: usdcMint, label: "dev1 USDC" },
    { ata: dev2Usdc, owner: globalConfig.dev2Wallet, mint: usdcMint, label: "dev2 USDC" },
    { ata: dev3Usdc, owner: globalConfig.dev3Wallet, mint: usdcMint, label: "dev3 USDC" },
  ];
  const infos = await connection.getMultipleAccountsInfo(prereqs.map((p) => p.ata));
  const ataIxs: TransactionInstruction[] = [];
  infos.forEach((info, i) => {
    if (!info) {
      const p = prereqs[i];
      console.log(`  Creating missing ATA (${p.label}) ${p.ata.toBase58()}`);
      ataIxs.push(createAssociatedTokenAccountIdempotentInstruction(admin.publicKey, p.ata, p.owner, p.mint));
    }
  });
  if (ataIxs.length > 0) {
    const bh = await connection.getLatestBlockhash();
    const msg = new TransactionMessage({ payerKey: admin.publicKey, recentBlockhash: bh.blockhash, instructions: ataIxs }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([admin]);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight });
    console.log(`  ATA prep tx: ${sig}`);
  }

  const sig = await program.methods
    .welcomeBonusDeposit()
    .accounts({
      admin: admin.publicKey,
      globalConfig: globalConfigPda,
      user: userWallet,
      userAccount: userAccountPda,
      shareMint,
      vaultState: vaultStatePda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts([
      { pubkey: adminUsdc, isSigner: false, isWritable: true },
      { pubkey: vaultUsdcPda, isSigner: false, isWritable: true },
      { pubkey: userShare, isSigner: false, isWritable: true },
      { pubkey: dev1Usdc, isSigner: false, isWritable: true },
      { pubkey: dev2Usdc, isSigner: false, isWritable: true },
      { pubkey: dev3Usdc, isSigner: false, isWritable: true },
    ])
    .rpc();

  console.log(`\nWelcome bonus distributed: ${sig}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
