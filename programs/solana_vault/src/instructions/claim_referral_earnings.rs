use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::state::{GlobalConfig, UserAccount};

#[derive(Accounts)]
pub struct ClaimReferralEarnings<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        mut,
        seeds = [UserAccount::SEED, user.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,
    
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault_usdc", global_config.key().as_ref()],
        bump
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimReferralEarnings>) -> Result<()> {
    let user_account = &mut ctx.accounts.user_account;
    let amount = user_account.unclaimed_referral_earnings;
    
    require!(amount > 0, VaultError::InsufficientFunds);
    
    // Transfer USDC to user
    let global_config_bump = ctx.accounts.global_config.bump;
    let seeds = &[
        GlobalConfig::SEED,
        &[global_config_bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_usdc_account.to_account_info(),
        to: ctx.accounts.user_usdc_account.to_account_info(),
        authority: ctx.accounts.global_config.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;
    
    // Reset unclaimed earnings
    user_account.unclaimed_referral_earnings = 0;
    
    msg!("Claimed {} USDC in referral earnings", amount);
    
    Ok(())
}
