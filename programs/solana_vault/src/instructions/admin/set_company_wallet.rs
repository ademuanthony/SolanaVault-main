use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct SetCompanyWallet<'info> {
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

pub fn handler(ctx: Context<SetCompanyWallet>, new_wallet: Pubkey) -> Result<()> {
    ctx.accounts.global_config.company_wallet = new_wallet;
    msg!("Company wallet updated to: {}", new_wallet);
    Ok(())
}
