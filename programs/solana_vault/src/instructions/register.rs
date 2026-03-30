use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::state::{GlobalConfig, UserAccount};

#[derive(Accounts)]
pub struct Register<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        init,
        payer = user,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [UserAccount::SEED, user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Register>, referrer: Option<Pubkey>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    
    // Validate referrer if provided
    if let Some(ref_referrer) = referrer {
        require!(
            ref_referrer != ctx.accounts.user.key(),
            VaultError::CannotReferSelf
        );
    }
    
    user_account.wallet = ctx.accounts.user.key();
    user_account.referrer = referrer;
    user_account.shares = 0;
    user_account.entry_price = 1_000_000; // 1.0 scaled by 1e6
    user_account.unclaimed_referral_earnings = 0;
    user_account.total_referral_earnings = 0;
    user_account.is_flagged = false;
    user_account.bump = ctx.bumps.user_account;
    
    msg!("User registered: {}", ctx.accounts.user.key());
    if let Some(ref_referrer) = referrer {
        msg!("Referrer: {}", ref_referrer);
    }
    
    Ok(())
}
