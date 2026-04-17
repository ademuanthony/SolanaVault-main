import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SolanaVault } from "../target/types/solana_vault";
import { JupiterSwapData } from "./jupiter";
import { DlmmCpiData, DlmmAccountMeta } from "./meteora_dlmm";

export interface InitializeArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  vaultState: PublicKey;
  usdcMint: PublicKey;
  vaultUsdcAccount: PublicKey;
  shareMint: PublicKey;
  companyWallet: PublicKey;
  dev1Wallet: PublicKey;
  dev1Authority: PublicKey;
  dev2Wallet: PublicKey;
  dev2Authority: PublicKey;
  dev3Wallet: PublicKey;
  dev3Authority: PublicKey;
  marketer1Wallet: PublicKey;
  marketer1Authority: PublicKey;
}

export interface RegisterArgs {
  user: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  referrer?: PublicKey | null;
}

export interface DepositArgs {
  user: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  userUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  shareMint: PublicKey;
  userShareAccount: PublicKey;
  vaultState: PublicKey;
  amount: BN;
}

export interface WithdrawArgs {
  user: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  vaultState: PublicKey;
  userUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  userShareAccount: PublicKey;
  shareMint: PublicKey;
  shares: BN;
  remainingAccounts?: anchor.web3.AccountMeta[];
}

export interface ClaimReferralEarningsArgs {
  user: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  userUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
}

export interface DistributeAccruedFeesArgs {
  payer: PublicKey;
  globalConfig: PublicKey;
  vaultUsdcAccount: PublicKey;
  companyUsdcAccount: PublicKey;
  dev1UsdcAccount: PublicKey;
  dev2UsdcAccount: PublicKey;
  dev3UsdcAccount: PublicKey;
  marketer1UsdcAccount: PublicKey;
}

export interface WelcomeBonusDepositArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  user: PublicKey;
  userAccount: PublicKey;
  shareMint: PublicKey;
  vaultState: PublicKey;
  remainingAccounts: anchor.web3.AccountMeta[];
}

export interface SetCompanyWalletArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  newCompanyWallet: PublicKey;
}

export interface WithdrawCompanyFeesArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  companyUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  amount: BN;
}

export interface JupiterSwapArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  jupiterProgram: PublicKey;
  sourceTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  amount: BN;
  minimumAmountOut: BN;
  swapData: JupiterSwapData;
  remainingAccounts: anchor.web3.AccountMeta[];
}

export interface JupiterSwapV2Args {
  admin: PublicKey;
  globalConfig: PublicKey;
  jupiterProgram: PublicKey;
  sourceTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  jupiterSourceAta: PublicKey;
  jupiterDestinationAta: PublicKey;
  swapData: Buffer | Uint8Array;
  swapAmount: BN;
  /// Slippage rail: if post-swap output < `minimumAmountOut`, the on-chain
  /// handler reverts with `SlippageExceeded` (High #5).
  minimumAmountOut: BN;
  remainingAccounts: anchor.web3.AccountMeta[];
  addressLookupTableAccounts?: anchor.web3.AddressLookupTableAccount[];
  preInstructions?: anchor.web3.TransactionInstruction[];
}

export interface OpenDlmmPositionArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  dlmmPosition: PublicKey;
  vaultState: PublicKey;
  vaultUsdcAccount: PublicKey;
  dlmmProgram: PublicKey;
  params: any; // OpenDlmmPositionParams from IDL
  cpiData: DlmmCpiData;
  remainingAccounts: anchor.web3.AccountMeta[];
}

export interface CloseDlmmPositionArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  dlmmPosition: PublicKey;
  vaultState: PublicKey;
  vaultUsdcAccount: PublicKey;
  dlmmProgram: PublicKey;
  cpiData: DlmmCpiData;
  remainingAccounts: anchor.web3.AccountMeta[];
}

export interface ClaimDlmmFeesArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  dlmmPosition: PublicKey;
  dlmmProgram: PublicKey;
  cpiData: DlmmCpiData;
  remainingAccounts: anchor.web3.AccountMeta[];
}

export interface ProposeNewAdminArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  newAdmin: PublicKey | null;
}

export interface AcceptAdminArgs {
  newAdmin: PublicKey;
  globalConfig: PublicKey;
}

export interface FlagUserArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
}

export interface UnflagUserArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
}

export interface AdminRegisterUserArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  userWallet: PublicKey;
  referrer: PublicKey | null;
}

export interface CloseUserAccountArgs {
  authority: PublicKey;
  globalConfig: PublicKey;
  userAccount: PublicKey;
  rentReceiver: PublicKey;
}

export interface CloseDlmmPositionAccountArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  dlmmPosition: PublicKey;
}

export interface UpdateVaultConfigArgs {
  admin: PublicKey;
  globalConfig: PublicKey;
  params: any; // UpdateConfigParams from IDL
}

export interface SetDevWalletArgs {
  devAuthority: PublicKey;
  globalConfig: PublicKey;
  devIndex: number;
  newWallet: PublicKey;
}

export interface WithdrawDevFeesArgs {
  devAuthority: PublicKey;
  globalConfig: PublicKey;
  devUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  devIndex: number;
  amount: BN;
}

export interface SetMarketerWalletArgs {
  marketerAuthority: PublicKey;
  globalConfig: PublicKey;
  newWallet: PublicKey;
}

export interface WithdrawMarketerFeesArgs {
  marketerAuthority: PublicKey;
  globalConfig: PublicKey;
  marketerUsdcAccount: PublicKey;
  vaultUsdcAccount: PublicKey;
  amount: BN;
}

export class SolanaVaultClient {
  constructor(public readonly program: Program<SolanaVault>) { }

  async initialize(args: InitializeArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .initialize({
        companyWallet: args.companyWallet,
        dev1Wallet: args.dev1Wallet,
        dev1Authority: args.dev1Authority,
        dev2Wallet: args.dev2Wallet,
        dev2Authority: args.dev2Authority,
        dev3Wallet: args.dev3Wallet,
        dev3Authority: args.dev3Authority,
        marketer1Wallet: args.marketer1Wallet,
        marketer1Authority: args.marketer1Authority,
      })
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        vaultState: args.vaultState,
        usdcMint: args.usdcMint,
        vaultUsdcAccount: args.vaultUsdcAccount,
        shareMint: args.shareMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async register(args: RegisterArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .register(args.referrer ?? null)
      .accounts({
        user: args.user,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        systemProgram: SystemProgram.programId,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async deposit(args: DepositArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .deposit(args.amount)
      .accounts({
        user: args.user,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        userUsdcAccount: args.userUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        shareMint: args.shareMint,
        userShareAccount: args.userShareAccount,
        vaultState: args.vaultState,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async withdraw(args: WithdrawArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    // Check if remainingAccounts are provided and valid
    const remaining = args.remainingAccounts || [];

    console.log("SDK: withdraw called with", {
      user: args.user.toBase58(),
      userAccount: args.userAccount.toBase58(),
      shares: args.shares.toString(),
      remainingAccountsCount: remaining.length
    });

    return methods
      .withdraw(args.shares)
      .accounts({
        user: args.user,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        vaultState: args.vaultState,
        userUsdcAccount: args.userUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        userShareAccount: args.userShareAccount,
        shareMint: args.shareMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remaining)
      .signers(signer ? [signer] : [])
      .rpc();
  }

  /// Permissionless sweep of all accrued fee buckets. Any wallet can sign
  /// `payer`; `token::authority` constraints on each destination prevent
  /// the caller from redirecting funds.
  async distributeAccruedFees(args: DistributeAccruedFeesArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    let builder = methods
      .distributeAccruedFees()
      .accounts({
        payer: args.payer,
        globalConfig: args.globalConfig,
        vaultUsdcAccount: args.vaultUsdcAccount,
        companyUsdcAccount: args.companyUsdcAccount,
        dev1UsdcAccount: args.dev1UsdcAccount,
        dev2UsdcAccount: args.dev2UsdcAccount,
        dev3UsdcAccount: args.dev3UsdcAccount,
        marketer1UsdcAccount: args.marketer1UsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      });
    if (signer) builder = builder.signers(signer ? [signer] : []);
    return builder.rpc();
  }

  async claimReferralEarnings(args: ClaimReferralEarningsArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .claimReferralEarnings()
      .accounts({
        user: args.user,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        userUsdcAccount: args.userUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async welcomeBonusDeposit(args: WelcomeBonusDepositArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .welcomeBonusDeposit()
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        user: args.user,
        userAccount: args.userAccount,
        shareMint: args.shareMint,
        vaultState: args.vaultState,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(args.remainingAccounts)
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async setCompanyWallet(args: SetCompanyWalletArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .setCompanyWallet(args.newCompanyWallet)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async withdrawCompanyFees(args: WithdrawCompanyFeesArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .withdrawCompanyFees(args.amount)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        companyUsdcAccount: args.companyUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async jupiterSwapV2(args: JupiterSwapV2Args, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    let builder = methods
      .jupiterSwapV2(
        Buffer.from(args.swapData),
        args.swapAmount,
        args.minimumAmountOut,
      )
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        jupiterProgram: args.jupiterProgram,
        sourceTokenAccount: args.sourceTokenAccount,
        destinationTokenAccount: args.destinationTokenAccount,
        jupiterSourceAta: args.jupiterSourceAta,
        jupiterDestinationAta: args.jupiterDestinationAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(args.remainingAccounts);
    if (args.preInstructions && args.preInstructions.length > 0) {
      builder = builder.preInstructions(args.preInstructions);
    }
    if (signer) builder = builder.signers(signer ? [signer] : []);
    return builder.rpc(
      args.addressLookupTableAccounts
        ? { addressLookupTableAccounts: args.addressLookupTableAccounts }
        : undefined,
    );
  }

  async jupiterSwap(args: JupiterSwapArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .jupiterSwap(args.amount, args.minimumAmountOut, {
        accounts: args.swapData.accounts,
        data: args.swapData.data,
      })
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        jupiterProgram: args.jupiterProgram,
        sourceTokenAccount: args.sourceTokenAccount,
        destinationTokenAccount: args.destinationTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(args.remainingAccounts)
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async openDlmmPosition(args: OpenDlmmPositionArgs, signers: anchor.web3.Signer[] = []) {
    const methods: any = this.program.methods;
    return methods
      .openDlmmPosition(args.params, args.cpiData)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        dlmmPosition: args.dlmmPosition,
        vaultState: args.vaultState,
        vaultUsdcAccount: args.vaultUsdcAccount,
        dlmmProgram: args.dlmmProgram,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(args.remainingAccounts)
      .signers(signers)
      .rpc();
  }

  async closeDlmmPosition(args: CloseDlmmPositionArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .closeDlmmPosition(args.cpiData)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        dlmmPosition: args.dlmmPosition,
        vaultState: args.vaultState,
        vaultUsdcAccount: args.vaultUsdcAccount,
        dlmmProgram: args.dlmmProgram,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(args.remainingAccounts)
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async claimDlmmFees(args: ClaimDlmmFeesArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .claimDlmmFees(args.cpiData)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        dlmmPosition: args.dlmmPosition,
        dlmmProgram: args.dlmmProgram,
      })
      .remainingAccounts(args.remainingAccounts)
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async proposeNewAdmin(args: ProposeNewAdminArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .proposeNewAdmin(args.newAdmin)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async acceptAdmin(args: AcceptAdminArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .acceptAdmin()
      .accounts({
        newAdmin: args.newAdmin,
        globalConfig: args.globalConfig,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async flagUser(args: FlagUserArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    let b = methods
      .flagUser()
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
      });
    if (signer) b = b.signers(signer ? [signer] : []);
    return b.rpc();
  }

  async unflagUser(args: UnflagUserArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    let b = methods
      .unflagUser()
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
      });
    if (signer) b = b.signers(signer ? [signer] : []);
    return b.rpc();
  }

  async adminRegisterUser(args: AdminRegisterUserArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    let b = methods
      .adminRegisterUser(args.userWallet, args.referrer)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        systemProgram: SystemProgram.programId,
      });
    if (signer) b = b.signers(signer ? [signer] : []);
    return b.rpc();
  }

  async closeUserAccount(args: CloseUserAccountArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    let b = methods
      .closeUserAccount()
      .accounts({
        authority: args.authority,
        globalConfig: args.globalConfig,
        userAccount: args.userAccount,
        rentReceiver: args.rentReceiver,
      });
    if (signer) b = b.signers(signer ? [signer] : []);
    return b.rpc();
  }

  async closeDlmmPositionAccount(args: CloseDlmmPositionAccountArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    let b = methods
      .closeDlmmPositionAccount()
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
        dlmmPosition: args.dlmmPosition,
      });
    if (signer) b = b.signers(signer ? [signer] : []);
    return b.rpc();
  }

  async updateVaultConfig(args: UpdateVaultConfigArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    let b = methods
      .updateVaultConfig(args.params)
      .accounts({
        admin: args.admin,
        globalConfig: args.globalConfig,
      });
    if (signer) b = b.signers(signer ? [signer] : []);
    return b.rpc();
  }

  async setDevWallet(args: SetDevWalletArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .setDevWallet(args.devIndex, args.newWallet)
      .accounts({
        devAuthority: args.devAuthority,
        globalConfig: args.globalConfig,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async withdrawDevFees(args: WithdrawDevFeesArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .withdrawDevFees(args.devIndex, args.amount)
      .accounts({
        devAuthority: args.devAuthority,
        globalConfig: args.globalConfig,
        devUsdcAccount: args.devUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async setMarketerWallet(args: SetMarketerWalletArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .setMarketerWallet(args.newWallet)
      .accounts({
        marketerAuthority: args.marketerAuthority,
        globalConfig: args.globalConfig,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }

  async withdrawMarketerFees(args: WithdrawMarketerFeesArgs, signer?: anchor.web3.Signer) {
    const methods: any = this.program.methods;
    return methods
      .withdrawMarketerFees(args.amount)
      .accounts({
        marketerAuthority: args.marketerAuthority,
        globalConfig: args.globalConfig,
        marketerUsdcAccount: args.marketerUsdcAccount,
        vaultUsdcAccount: args.vaultUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers(signer ? [signer] : [])
      .rpc();
  }
}

