use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct SetMarketerWallet<'info> {
    #[account(mut)]
    pub marketer_authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
}

pub fn handler(ctx: Context<SetMarketerWallet>, new_wallet: Pubkey) -> Result<()> {
    let global_config = &mut ctx.accounts.global_config;
    let marketer_authority_key = ctx.accounts.marketer_authority.key();
    
    // Verify marketer authority matches
    require!(
        marketer_authority_key == global_config.marketer1_authority,
        VaultError::InvalidDevWalletUpdate // Reuse this error for now
    );
    
    // Update wallet
    global_config.marketer1_wallet = new_wallet;
    
    msg!("Marketer wallet updated to: {}", new_wallet);
    
    Ok(())
}
