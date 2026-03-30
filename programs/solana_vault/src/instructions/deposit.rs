use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::state::{GlobalConfig, UserAccount, VaultState};

#[derive(Accounts)]
pub struct Deposit<'info> {
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
    
    #[account(
        mut,
        address = global_config.share_mint
    )]
    pub share_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = share_mint,
        associated_token::authority = user,
    )]
    pub user_share_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [VaultState::SEED],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::InvalidDepositAmount);
    
    let user_account = &mut ctx.accounts.user_account;
    
    // Check if user is flagged
    require!(!user_account.is_flagged, VaultError::UserFlagged);
    
    let vault_state = &mut ctx.accounts.vault_state;
    
    // Transfer USDC from user to vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_usdc_account.to_account_info(),
        to: ctx.accounts.vault_usdc_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;
    
    // Calculate shares to mint
    let current_share_price = vault_state.calculate_share_price()?;
    let shares_to_mint = if vault_state.total_shares == 0 {
        // First deposit: 1 share = 1 USDC
        amount.checked_mul(1_000_000_000)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(1_000_000)
            .ok_or(VaultError::MathOverflow)?
    } else {
        // Shares = (amount * 1e9) / share_price
        amount.checked_mul(1_000_000_000)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(current_share_price)
            .ok_or(VaultError::MathOverflow)?
    };
    
    // Update weighted average entry price
    if user_account.shares == 0 {
        user_account.entry_price = current_share_price;
    } else {
        let total_value_old = user_account.shares
            .checked_mul(user_account.entry_price)
            .ok_or(VaultError::MathOverflow)?;
        let total_value_new = shares_to_mint
            .checked_mul(current_share_price)
            .ok_or(VaultError::MathOverflow)?;
        let total_shares = user_account.shares
            .checked_add(shares_to_mint)
            .ok_or(VaultError::MathOverflow)?;
        let total_value = total_value_old
            .checked_add(total_value_new)
            .ok_or(VaultError::MathOverflow)?;
        user_account.entry_price = total_value
            .checked_div(total_shares)
            .ok_or(VaultError::MathOverflow)?;
    }
    
    // Mint shares to user
    let global_config_bump = ctx.accounts.global_config.bump;
    let seeds = &[
        GlobalConfig::SEED,
        &[global_config_bump],
    ];
    let signer = &[&seeds[..]];
    
    let cpi_accounts = MintTo {
        mint: ctx.accounts.share_mint.to_account_info(),
        to: ctx.accounts.user_share_account.to_account_info(),
        authority: ctx.accounts.global_config.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::mint_to(cpi_ctx, shares_to_mint)?;
    
    // Update state
    user_account.shares = user_account.shares
        .checked_add(shares_to_mint)
        .ok_or(VaultError::MathOverflow)?;
    
    vault_state.total_tvl = vault_state.total_tvl
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;
    vault_state.total_shares = vault_state.total_shares
        .checked_add(shares_to_mint)
        .ok_or(VaultError::MathOverflow)?;
    
    msg!(
        "Deposit: {} USDC, {} shares minted, entry_price: {}",
        amount,
        shares_to_mint,
        user_account.entry_price
    );
    
    Ok(())
}
