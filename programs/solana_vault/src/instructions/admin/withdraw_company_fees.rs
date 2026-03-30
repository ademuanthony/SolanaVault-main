use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct WithdrawCompanyFees<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(mut)]
    pub company_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault_usdc", global_config.key().as_ref()],
        bump
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawCompanyFees>, amount: u64) -> Result<()> {
    require!(
        ctx.accounts.global_config.company_fees >= amount,
        VaultError::InsufficientFunds
    );
    
    // Prepare seeds before mutable borrow
    let global_config_bump = ctx.accounts.global_config.bump;
    let global_config_authority = ctx.accounts.global_config.to_account_info();
    
    let seeds = &[
        GlobalConfig::SEED,
        &[global_config_bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_usdc_account.to_account_info(),
        to: ctx.accounts.company_usdc_account.to_account_info(),
        authority: global_config_authority,
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;
    
    // Update fees
    let global_config = &mut ctx.accounts.global_config;
    global_config.company_fees = global_config.company_fees
        .checked_sub(amount)
        .ok_or(VaultError::MathOverflow)?;
    
    msg!("Withdrew {} USDC company fees", amount);
    
    Ok(())
}
