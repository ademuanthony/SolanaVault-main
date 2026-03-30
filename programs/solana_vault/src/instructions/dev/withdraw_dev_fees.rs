use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct WithdrawDevFees<'info> {
    #[account(mut)]
    pub dev_authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(mut)]
    pub dev_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"vault_usdc", global_config.key().as_ref()],
        bump
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawDevFees>, dev_index: u8, amount: u64) -> Result<()> {
    require!(
        dev_index >= 1 && dev_index <= 3,
        VaultError::InvalidDevIndex
    );
    
    let dev_authority_key = ctx.accounts.dev_authority.key();
    
    // Verify dev authority matches and get wallet before mutable borrow
    let (expected_authority, dev_wallet, current_fees) = match dev_index {
        1 => (
            ctx.accounts.global_config.dev1_authority,
            ctx.accounts.global_config.dev1_wallet,
            ctx.accounts.global_config.dev1_fees,
        ),
        2 => (
            ctx.accounts.global_config.dev2_authority,
            ctx.accounts.global_config.dev2_wallet,
            ctx.accounts.global_config.dev2_fees,
        ),
        3 => (
            ctx.accounts.global_config.dev3_authority,
            ctx.accounts.global_config.dev3_wallet,
            ctx.accounts.global_config.dev3_fees,
        ),
        _ => return Err(VaultError::InvalidDevIndex.into()),
    };
    
    require!(
        dev_authority_key == expected_authority,
        VaultError::UnauthorizedDev
    );
    
    require!(
        current_fees >= amount,
        VaultError::InsufficientFunds
    );
    
    require!(
        ctx.accounts.dev_usdc_account.owner == dev_wallet,
        VaultError::UnauthorizedDev
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
        to: ctx.accounts.dev_usdc_account.to_account_info(),
        authority: global_config_authority,
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, amount)?;
    
    // Update fees
    let global_config = &mut ctx.accounts.global_config;
    match dev_index {
        1 => global_config.dev1_fees = global_config.dev1_fees
            .checked_sub(amount)
            .ok_or(VaultError::MathOverflow)?,
        2 => global_config.dev2_fees = global_config.dev2_fees
            .checked_sub(amount)
            .ok_or(VaultError::MathOverflow)?,
        3 => global_config.dev3_fees = global_config.dev3_fees
            .checked_sub(amount)
            .ok_or(VaultError::MathOverflow)?,
        _ => return Err(VaultError::InvalidDevIndex.into()),
    }
    
    msg!("Dev {} withdrew {} USDC fees", dev_index, amount);
    
    Ok(())
}
