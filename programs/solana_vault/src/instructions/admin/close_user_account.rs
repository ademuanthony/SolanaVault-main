use anchor_lang::prelude::*;
use crate::errors::VaultError;
use crate::state::{GlobalConfig, UserAccount};

#[derive(Accounts)]
pub struct CloseUserAccount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        mut,
        seeds = [UserAccount::SEED, user_account.wallet.as_ref()],
        bump = user_account.bump,
        close = rent_receiver,
        constraint = user_account.shares == 0 @ VaultError::InvalidOperation,
        constraint = user_account.unclaimed_referral_earnings == 0 @ VaultError::InvalidOperation,
        constraint = authority.key() == user_account.wallet || authority.key() == global_config.admin @ VaultError::UnauthorizedAdmin,
    )]
    pub user_account: Account<'info, UserAccount>,
    
    /// CHECK: Rent receiver (user or admin)
    #[account(mut)]
    pub rent_receiver: AccountInfo<'info>,
}

pub fn handler(_ctx: Context<CloseUserAccount>) -> Result<()> {
    msg!("User account closed successfully");
    Ok(())
}
