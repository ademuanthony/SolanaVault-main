use anchor_lang::prelude::*;

use crate::errors::VaultError;
use crate::state::GlobalConfig;

#[derive(Accounts)]
pub struct SetDevWallet<'info> {
    #[account(mut)]
    pub dev_authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
}

pub fn handler(ctx: Context<SetDevWallet>, dev_index: u8, new_wallet: Pubkey) -> Result<()> {
    require!(
        dev_index >= 1 && dev_index <= 3,
        VaultError::InvalidDevIndex
    );
    
    let global_config = &mut ctx.accounts.global_config;
    let dev_authority_key = ctx.accounts.dev_authority.key();
    
    // Verify dev authority matches
    let expected_authority = match dev_index {
        1 => global_config.dev1_authority,
        2 => global_config.dev2_authority,
        3 => global_config.dev3_authority,
        _ => return Err(VaultError::InvalidDevIndex.into()),
    };
    
    require!(
        dev_authority_key == expected_authority,
        VaultError::InvalidDevWalletUpdate
    );
    
    // Update wallet
    match dev_index {
        1 => global_config.dev1_wallet = new_wallet,
        2 => global_config.dev2_wallet = new_wallet,
        3 => global_config.dev3_wallet = new_wallet,
        _ => return Err(VaultError::InvalidDevIndex.into()),
    }
    
    msg!("Dev {} wallet updated to: {}", dev_index, new_wallet);
    
    Ok(())
}
