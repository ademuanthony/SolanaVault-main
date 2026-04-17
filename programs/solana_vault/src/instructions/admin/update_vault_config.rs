use anchor_lang::prelude::*;
use crate::state::GlobalConfig;
use crate::errors::VaultError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateConfigParams {
    // NOTE: `admin` is NOT here — admin rotation is two-step via
    // `propose_new_admin` + `accept_admin` (High #4).
    pub tier1_threshold: Option<u64>,
    pub tier2_threshold: Option<u64>,
    pub tier1_fee: Option<u8>,
    pub tier2_fee: Option<u8>,
    pub tier3_fee: Option<u8>,
    pub company_share: Option<u8>,
    pub dev1_share: Option<u8>,
    pub dev2_share: Option<u8>,
    pub dev3_share: Option<u8>,
    pub marketer1_share: Option<u8>,
    pub referral_pool_share: Option<u8>,
    pub referral_l1_share: Option<u8>,
    pub referral_l2_share: Option<u8>,
    pub referral_l3_share: Option<u8>,
    pub referral_l4_share: Option<u8>,
    pub referral_l5_share: Option<u8>,
    pub welcome_bonus_user: Option<u64>,
    pub welcome_bonus_dev: Option<u64>,
    pub paused: Option<bool>,
    pub max_tvl: Option<u64>,
    pub max_user_shares: Option<u64>,
    pub min_distribution_amount: Option<u64>,
}

#[derive(Accounts)]
pub struct UpdateVaultConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,
}

pub fn handler(ctx: Context<UpdateVaultConfig>, params: UpdateConfigParams) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;

    if let Some(val) = params.tier1_threshold { global_config.tier1_threshold = val; }
    if let Some(val) = params.tier2_threshold { global_config.tier2_threshold = val; }
    if let Some(val) = params.tier1_fee { global_config.tier1_fee = val; }
    if let Some(val) = params.tier2_fee { global_config.tier2_fee = val; }
    if let Some(val) = params.tier3_fee { global_config.tier3_fee = val; }

    if let Some(val) = params.company_share { global_config.company_share = val; }
    if let Some(val) = params.dev1_share { global_config.dev1_share = val; }
    if let Some(val) = params.dev2_share { global_config.dev2_share = val; }
    if let Some(val) = params.dev3_share { global_config.dev3_share = val; }
    if let Some(val) = params.marketer1_share { global_config.marketer1_share = val; }
    if let Some(val) = params.referral_pool_share { global_config.referral_pool_share = val; }

    // Validate total distribution = 100%
    let total_dist = global_config.company_share as u32 +
                     global_config.dev1_share as u32 +
                     global_config.dev2_share as u32 +
                     global_config.dev3_share as u32 +
                     global_config.marketer1_share as u32 +
                     global_config.referral_pool_share as u32;

    require!(total_dist == 100, VaultError::InvalidFeeDistribution);

    if let Some(val) = params.referral_l1_share { global_config.referral_l1_share = val; }
    if let Some(val) = params.referral_l2_share { global_config.referral_l2_share = val; }
    if let Some(val) = params.referral_l3_share { global_config.referral_l3_share = val; }
    if let Some(val) = params.referral_l4_share { global_config.referral_l4_share = val; }
    if let Some(val) = params.referral_l5_share { global_config.referral_l5_share = val; }

    // Validate total referral pool = 100%
    let total_ref = global_config.referral_l1_share as u32 +
                    global_config.referral_l2_share as u32 +
                    global_config.referral_l3_share as u32 +
                    global_config.referral_l4_share as u32 +
                    global_config.referral_l5_share as u32;

    require!(total_ref == 100, VaultError::InvalidReferralDistribution);

    if let Some(val) = params.welcome_bonus_user { global_config.welcome_bonus_user = val; }
    if let Some(val) = params.welcome_bonus_dev { global_config.welcome_bonus_dev = val; }

    if let Some(val) = params.paused { global_config.paused = val; }
    if let Some(val) = params.max_tvl { global_config.max_tvl = val; }
    if let Some(val) = params.max_user_shares { global_config.max_user_shares = val; }
    if let Some(val) = params.min_distribution_amount { global_config.min_distribution_amount = val; }

    msg!("Global configuration updated by admin");
    Ok(())
}
