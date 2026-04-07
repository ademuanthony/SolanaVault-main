use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount};

use crate::errors::VaultError;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct ClosePdaTokenAccount<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,

    /// The token account owned by globalConfigPda to close.
    /// Must have zero balance.
    #[account(
        mut,
        constraint = token_account.owner == global_config.key() @ VaultError::UnauthorizedAdmin,
        constraint = token_account.amount == 0 @ VaultError::TokenAccountNotEmpty,
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClosePdaTokenAccount>) -> Result<()> {
    let bump = ctx.accounts.global_config.bump;
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[GlobalConfig::SEED, &bump_seed];

    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.token_account.to_account_info(),
            destination: ctx.accounts.admin.to_account_info(),
            authority: ctx.accounts.global_config.to_account_info(),
        },
        &[seeds],
    ))?;

    msg!(
        "PDA token account closed, rent returned to admin: {}",
        ctx.accounts.admin.key()
    );

    Ok(())
}
