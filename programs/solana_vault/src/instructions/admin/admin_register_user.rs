use anchor_lang::prelude::*;
use crate::errors::VaultError;
use crate::state::{GlobalConfig, UserAccount};

#[derive(Accounts)]
#[instruction(user_wallet: Pubkey)]
pub struct AdminRegisterUser<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [UserAccount::SEED, user_wallet.as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AdminRegisterUser>,
    user_wallet: Pubkey,
    referrer: Option<Pubkey>,
) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    
    // Validate referrer if provided
    if let Some(ref_referrer) = referrer {
        require!(
            ref_referrer != user_wallet,
            VaultError::CannotReferSelf
        );
    }
    
    user_account.wallet = user_wallet;
    user_account.referrer = referrer;
    user_account.shares = 0;
    user_account.entry_price = 1_000_000; // 1.0 scaled by 1e6
    user_account.unclaimed_referral_earnings = 0;
    user_account.total_referral_earnings = 0;
    user_account.is_flagged = false;
    user_account.bump = ctx.bumps.user_account;
    
    msg!("Admin registered user: {}", user_wallet);
    if let Some(ref_referrer) = referrer {
        msg!("Referrer: {}", ref_referrer);
    }
    
    Ok(())
}
