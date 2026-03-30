use anchor_lang::prelude::*;
use crate::state::VaultState;
use crate::errors::VaultError;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct SimulateYield<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [VaultState::SEED],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,
}

pub fn handler(ctx: Context<SimulateYield>, amount: u64) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    
    vault_state.total_tvl = vault_state.total_tvl
        .checked_add(amount)
        .ok_or(VaultError::MathOverflow)?;

    msg!("Simulated yield: added {} to TVL. New TVL: {}", amount, vault_state.total_tvl);
    Ok(())
}
