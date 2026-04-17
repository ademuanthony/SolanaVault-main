use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::state::{GlobalConfig, VaultState};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub company_wallet: Pubkey,
    pub dev1_wallet: Pubkey,
    pub dev1_authority: Pubkey,
    pub dev2_wallet: Pubkey,
    pub dev2_authority: Pubkey,
    pub dev3_wallet: Pubkey,
    pub dev3_authority: Pubkey,
    pub marketer1_wallet: Pubkey,
    pub marketer1_authority: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [GlobalConfig::SEED],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [VaultState::SEED],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,
    
    pub usdc_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = global_config,
        seeds = [b"vault_usdc", global_config.key().as_ref()],
        bump
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = admin,
        mint::decimals = 9,
        mint::authority = global_config,
    )]
    pub share_mint: Account<'info, Mint>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;
    let vault_state = &mut ctx.accounts.vault_state;
    
    global_config.admin = ctx.accounts.admin.key();
    global_config.company_wallet = params.company_wallet;
    global_config.dev1_wallet = params.dev1_wallet;
    global_config.dev1_authority = params.dev1_authority;
    global_config.dev2_wallet = params.dev2_wallet;
    global_config.dev2_authority = params.dev2_authority;
    global_config.dev3_wallet = params.dev3_wallet;
    global_config.dev3_authority = params.dev3_authority;
    global_config.marketer1_wallet = params.marketer1_wallet;
    global_config.marketer1_authority = params.marketer1_authority;
    global_config.company_fees = 0;
    global_config.dev1_fees = 0;
    global_config.dev2_fees = 0;
    global_config.dev3_fees = 0;
    global_config.marketer1_fees = 0;
    global_config.usdc_mint = ctx.accounts.usdc_mint.key();
    global_config.vault_usdc_account = ctx.accounts.vault_usdc_account.key();
    global_config.share_mint = ctx.accounts.share_mint.key();
    
    // Set Dynamic Config Defaults
    global_config.tier1_threshold = crate::constants::TIER_1_THRESHOLD;
    global_config.tier2_threshold = crate::constants::TIER_2_THRESHOLD;
    global_config.tier1_fee = crate::constants::TIER_1_FEE;
    global_config.tier2_fee = crate::constants::TIER_2_FEE;
    global_config.tier3_fee = crate::constants::TIER_3_FEE;
    global_config.company_share = crate::constants::COMPANY_SHARE;
    global_config.dev1_share = crate::constants::DEV1_SHARE;
    global_config.dev2_share = crate::constants::DEV2_SHARE;
    global_config.dev3_share = crate::constants::DEV3_SHARE;
    global_config.marketer1_share = crate::constants::MARKETER_SHARE;
    global_config.referral_pool_share = crate::constants::REFERRAL_POOL_SHARE;
    global_config.referral_l1_share = crate::constants::REFERRAL_L1_SHARE;
    global_config.referral_l2_share = crate::constants::REFERRAL_L2_SHARE;
    global_config.referral_l3_share = crate::constants::REFERRAL_L3_SHARE;
    global_config.referral_l4_share = crate::constants::REFERRAL_L4_SHARE;
    global_config.referral_l5_share = crate::constants::REFERRAL_L5_SHARE;
    
    global_config.welcome_bonus_user = crate::constants::WELCOME_BONUS_USER;
    global_config.welcome_bonus_dev = crate::constants::WELCOME_BONUS_DEV;

    global_config.paused = false;
    global_config.pending_admin = None;
    global_config.max_tvl = 0;
    global_config.max_user_shares = 0;

    global_config.bump = ctx.bumps.global_config;
    
    vault_state.total_tvl = 0;
    vault_state.total_shares = 0;
    vault_state.positions_count = 0;
    vault_state.bump = ctx.bumps.vault_state;
    
    msg!("Vault initialized by admin: {}", ctx.accounts.admin.key());
    Ok(())
}
