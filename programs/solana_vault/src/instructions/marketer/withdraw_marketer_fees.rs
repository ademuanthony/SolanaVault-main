use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct WithdrawMarketerFees<'info> {
    #[account(mut)]
    pub marketer_authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(mut)]
    pub marketer_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault_usdc", global_config.key().as_ref()],
        bump
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawMarketerFees>, amount: u64) -> Result<()> {
    let marketer_authority_key = ctx.accounts.marketer_authority.key();
    
    // Verify marketer authority matches and get wallet before mutable borrow
    let expected_authority = ctx.accounts.global_config.marketer1_authority;
    let marketer_wallet = ctx.accounts.global_config.marketer1_wallet;
    let current_fees = ctx.accounts.global_config.marketer1_fees;
    
    require!(
        marketer_authority_key == expected_authority,
        VaultError::UnauthorizedDev // Reuse this error for now
    );
    
    require!(
        current_fees >= amount,
        VaultError::InsufficientFunds
    );
    
    require!(
        ctx.accounts.marketer_usdc_account.owner == marketer_wallet,
        VaultError::UnauthorizedDev // Reuse this error for now
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
        to: ctx.accounts.marketer_usdc_account.to_account_info(),
        authority: global_config_authority,
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;
    
    // Update fees
    let global_config = &mut ctx.accounts.global_config;
    global_config.marketer1_fees = global_config.marketer1_fees
        .checked_sub(amount)
        .ok_or(VaultError::MathOverflow)?;
    
    msg!("Marketer withdrew {} USDC fees", amount);
    
    Ok(())
}
