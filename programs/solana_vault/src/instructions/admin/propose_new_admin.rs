use anchor_lang::prelude::*;
use crate::errors::VaultError;
use crate::state::GlobalConfig;

/// First half of a two-step admin transfer. The current admin nominates a
/// successor. Nothing changes until the successor calls `accept_admin`
/// themselves (proving they control the new key).
///
/// Passing `None` cancels an in-flight proposal.
#[derive(Accounts)]
pub struct ProposeNewAdmin<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,
}

pub fn handler(ctx: Context<ProposeNewAdmin>, new_admin: Option<Pubkey>) -> Result<()> {
    let cfg = &mut ctx.accounts.global_config;
    cfg.pending_admin = new_admin;
    match new_admin {
        Some(pk) => msg!("Admin rotation proposed: pending_admin={}", pk),
        None => msg!("Admin rotation proposal cleared"),
    }
    Ok(())
}
