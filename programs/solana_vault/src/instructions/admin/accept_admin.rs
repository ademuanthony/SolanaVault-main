use anchor_lang::prelude::*;
use crate::errors::VaultError;
use crate::state::GlobalConfig;

/// Second half of a two-step admin transfer. The pending admin signs to
/// confirm control of the new key. Only then is `admin` swapped.
#[derive(Accounts)]
pub struct AcceptAdmin<'info> {
    #[account(mut)]
    pub new_admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,
}

pub fn handler(ctx: Context<AcceptAdmin>) -> Result<()> {
    let cfg = &mut ctx.accounts.global_config;
    let pending = cfg.pending_admin.ok_or(VaultError::NoPendingAdmin)?;
    require!(
        pending == ctx.accounts.new_admin.key(),
        VaultError::NotPendingAdmin
    );
    let old = cfg.admin;
    cfg.admin = pending;
    cfg.pending_admin = None;
    msg!("Admin rotated: {} -> {}", old, cfg.admin);
    Ok(())
}
