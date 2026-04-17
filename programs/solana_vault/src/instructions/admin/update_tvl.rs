use anchor_lang::prelude::*;
use crate::errors::VaultError;
use crate::state::{GlobalConfig, VaultState};

/// Maximum TVL decrease allowed per update: 20%.
/// Prevents admin from instantly draining vault value.
/// Multiple calls can decrease further, but each is capped.
const MAX_DECREASE_BPS: u64 = 2000; // 20% in basis points

/// Maximum TVL increase allowed per update: 50%.
/// Symmetric rail against an accidental or malicious admin pumping TVL
/// (which inflates share price and under-mints shares for depositors).
const MAX_INCREASE_BPS: u64 = 5000; // 50% in basis points

#[derive(Accounts)]
pub struct UpdateTvl<'info> {
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

pub fn handler(ctx: Context<UpdateTvl>, new_tvl: u64) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let old_tvl = vault_state.total_tvl;

    if new_tvl < old_tvl {
        // Cap the decrease to MAX_DECREASE_BPS per call
        let max_decrease = old_tvl
            .checked_mul(MAX_DECREASE_BPS)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(VaultError::MathOverflow)?;

        let actual_decrease = old_tvl.saturating_sub(new_tvl);
        require!(
            actual_decrease <= max_decrease,
            VaultError::TvlDecreaseTooLarge
        );
    } else if new_tvl > old_tvl && old_tvl > 0 {
        // Cap the increase to MAX_INCREASE_BPS per call.
        // `old_tvl > 0` skips the bootstrap case: genuine first-time
        // reconciliation after initial deposits should not be blocked.
        let max_increase = old_tvl
            .checked_mul(MAX_INCREASE_BPS)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(VaultError::MathOverflow)?;

        let actual_increase = new_tvl.saturating_sub(old_tvl);
        require!(
            actual_increase <= max_increase,
            VaultError::TvlIncreaseTooLarge
        );
    }

    vault_state.total_tvl = new_tvl;

    msg!(
        "TVL updated: {} -> {} (delta: {}{})",
        old_tvl,
        new_tvl,
        if new_tvl >= old_tvl { "+" } else { "-" },
        if new_tvl >= old_tvl { new_tvl - old_tvl } else { old_tvl - new_tvl }
    );

    Ok(())
}
