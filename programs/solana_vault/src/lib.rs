use anchor_lang::prelude::*;

declare_id!("3TV5FTYziezR5xrp9SAeR6zLU4brnTLQuegjixpBrV1t");

pub mod constants;
pub mod errors;
pub mod state;
pub mod instructions;

// Import ALL instruction contexts explicitly at crate level
use instructions::{
    // User instructions
    initialize::*,
    register::*,
    deposit::*,
    withdraw::*,
    claim_referral_earnings::*,
    // Admin instructions
    admin::{
        welcome_bonus_deposit::*,
        set_company_wallet::*,
        withdraw_company_fees::*,
        jupiter_swap::*,
        jupiter_swap_v2::*,
        open_dlmm_position::*,
        close_dlmm_position::*,
        claim_dlmm_fees::*,
        flag_user::*,
        unflag_user::*,
        admin_register_user::*,
        close_user_account::*,
        close_dlmm_position_account::*,
        close_pda_token_account::*,
        update_tvl::*,
        update_vault_config::*,
        propose_new_admin::*,
        accept_admin::*,
    },
    // Dev instructions
    dev::{
        set_dev_wallet::*,
        withdraw_dev_fees::*,
    },
    // Marketer instructions
    marketer::{
        set_marketer_wallet::*,
        withdraw_marketer_fees::*,
    },
};

#[program]
pub mod solana_vault {
    use super::*;

    /// Initialize the vault with admin and dev wallets
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    /// Register a new user with optional referrer
    pub fn register(ctx: Context<Register>, referrer: Option<Pubkey>) -> Result<()> {
        instructions::register::handler(ctx, referrer)
    }

    /// Deposit USDC and receive vault shares
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    /// Withdraw shares, deduct fees, and distribute
    pub fn withdraw<'info>(
        ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
        shares: u64,
    ) -> Result<()> {
        instructions::withdraw::handler(ctx, shares)
    }

    /// Claim accumulated referral earnings
    pub fn claim_referral_earnings(ctx: Context<ClaimReferralEarnings>) -> Result<()> {
        instructions::claim_referral_earnings::handler(ctx)
    }

    // Admin instructions

    /// Deposit welcome bonus for a new user
    pub fn welcome_bonus_deposit<'info>(
        ctx: Context<'_, '_, 'info, 'info, WelcomeBonusDeposit<'info>>,
    ) -> Result<()> {
        instructions::admin::welcome_bonus_deposit::handler(ctx)
    }

    /// Set company wallet
    pub fn set_company_wallet(ctx: Context<SetCompanyWallet>, new_wallet: Pubkey) -> Result<()> {
        instructions::admin::set_company_wallet::handler(ctx, new_wallet)
    }

    /// Withdraw company fees
    pub fn withdraw_company_fees(ctx: Context<WithdrawCompanyFees>, amount: u64) -> Result<()> {
        instructions::admin::withdraw_company_fees::handler(ctx, amount)
    }

    /// Swap USDC ↔ any token via Jupiter
    pub fn jupiter_swap<'info>(
        ctx: Context<'_, '_, '_, 'info, JupiterSwap<'info>>,
        amount: u64,
        minimum_amount_out: u64,
        swap_data: JupiterSwapData,
    ) -> Result<()> {
        instructions::admin::jupiter_swap::handler(ctx, amount, minimum_amount_out, swap_data)
    }

    /// Swap via Jupiter V2 — uses remaining_accounts for CPI metas.
    /// Automatically transfers tokens between vault PDAs and standard ATAs
    /// that Jupiter expects.
    pub fn jupiter_swap_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, JupiterSwapV2<'info>>,
        swap_data: Vec<u8>,
        swap_amount: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        instructions::admin::jupiter_swap_v2::handler(ctx, swap_data, swap_amount, minimum_amount_out)
    }

    /// Open a DLMM position via Meteora (CPI)
    pub fn open_dlmm_position<'info>(
        ctx: Context<'_, '_, '_, 'info, OpenDlmmPosition<'info>>,
        params: OpenDlmmPositionParams,
        cpi_data: DlmmCpiData,
    ) -> Result<()> {
        instructions::admin::open_dlmm_position::handler(ctx, params, cpi_data)
    }

    /// Close a DLMM position and remove liquidity via Meteora (CPI)
    pub fn close_dlmm_position<'info>(
        ctx: Context<'_, '_, '_, 'info, CloseDlmmPosition<'info>>,
        cpi_data: DlmmCpiData,
    ) -> Result<()> {
        instructions::admin::close_dlmm_position::handler(ctx, cpi_data)
    }

    /// Claim trading fees from a DLMM position. Pure CPI forwarder — TVL
    /// must be reconciled afterwards via `update_tvl`.
    pub fn claim_dlmm_fees<'info>(
        ctx: Context<'_, '_, '_, 'info, ClaimDlmmFees<'info>>,
        cpi_data: DlmmCpiData,
    ) -> Result<()> {
        instructions::admin::claim_dlmm_fees::handler(ctx, cpi_data)
    }

    // Dev instructions

    /// Set dev wallet (each dev can only set their own)
    pub fn set_dev_wallet(
        ctx: Context<SetDevWallet>,
        dev_index: u8,
        new_wallet: Pubkey,
    ) -> Result<()> {
        instructions::dev::set_dev_wallet::handler(ctx, dev_index, new_wallet)
    }

    /// Withdraw dev fees
    pub fn withdraw_dev_fees(
        ctx: Context<WithdrawDevFees>,
        dev_index: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::dev::withdraw_dev_fees::handler(ctx, dev_index, amount)
    }

    // Marketer instructions

    /// Set marketer wallet (marketer can only set their own)
    pub fn set_marketer_wallet(
        ctx: Context<SetMarketerWallet>,
        new_wallet: Pubkey,
    ) -> Result<()> {
        instructions::marketer::set_marketer_wallet::handler(ctx, new_wallet)
    }

    /// Withdraw marketer fees
    pub fn withdraw_marketer_fees(
        ctx: Context<WithdrawMarketerFees>,
        amount: u64,
    ) -> Result<()> {
        instructions::marketer::withdraw_marketer_fees::handler(ctx, amount)
    }
    
    // Admin user management
    
    /// Flag a user account (admin only)
    pub fn flag_user(ctx: Context<FlagUser>) -> Result<()> {
        instructions::admin::flag_user::handler(ctx)
    }
    
    /// Unflag a user account (admin only)
    pub fn unflag_user(ctx: Context<UnflagUser>) -> Result<()> {
        instructions::admin::unflag_user::handler(ctx)
    }
    
    /// Admin register a user (admin only)
    pub fn admin_register_user(
        ctx: Context<AdminRegisterUser>,
        user_wallet: Pubkey,
        referrer: Option<Pubkey>,
    ) -> Result<()> {
        instructions::admin::admin_register_user::handler(ctx, user_wallet, referrer)
    }
    
    /// Close an empty user account (user or admin)
    pub fn close_user_account(ctx: Context<CloseUserAccount>) -> Result<()> {
        instructions::admin::close_user_account::handler(ctx)
    }
    
    /// Close a DLMM position account (admin only, must be already closed)
    pub fn close_dlmm_position_account(ctx: Context<CloseDlmmPositionAccount>) -> Result<()> {
        instructions::admin::close_dlmm_position_account::handler(ctx)
    }

    /// Close a PDA-owned token account and return rent to admin (must have zero balance)
    pub fn close_pda_token_account(ctx: Context<ClosePdaTokenAccount>) -> Result<()> {
        instructions::admin::close_pda_token_account::handler(ctx)
    }

    /// Update TVL to reflect actual vault value (admin only, max 20% decrease per call)
    pub fn update_tvl(ctx: Context<UpdateTvl>, new_tvl: u64) -> Result<()> {
        instructions::admin::update_tvl::handler(ctx, new_tvl)
    }

    /// Update global configuration (admin only). Admin rotation is NOT
    /// included here — see `propose_new_admin` / `accept_admin`.
    pub fn update_vault_config(ctx: Context<UpdateVaultConfig>, params: UpdateConfigParams) -> Result<()> {
        instructions::admin::update_vault_config::handler(ctx, params)
    }

    /// Propose a new admin (first step of two-step rotation). `Some(pk)` sets
    /// the pending admin; `None` cancels an in-flight proposal.
    pub fn propose_new_admin(ctx: Context<ProposeNewAdmin>, new_admin: Option<Pubkey>) -> Result<()> {
        instructions::admin::propose_new_admin::handler(ctx, new_admin)
    }

    /// Accept admin role (second step). Must be signed by the pending admin.
    pub fn accept_admin(ctx: Context<AcceptAdmin>) -> Result<()> {
        instructions::admin::accept_admin::handler(ctx)
    }
}
