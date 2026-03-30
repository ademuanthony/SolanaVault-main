use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, UserAccount};

#[derive(Accounts)]
pub struct FlagUser<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ crate::errors::VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        mut,
        seeds = [b"user_account", user_account.wallet.as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,
}

pub fn handler(ctx: Context<FlagUser>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    
    require!(!user_account.is_flagged, crate::errors::VaultError::InvalidOperation);
    
    user_account.is_flagged = true;
    
    msg!("User account {} has been flagged", user_account.wallet);
    
    Ok(())
}
