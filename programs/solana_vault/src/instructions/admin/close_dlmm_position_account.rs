use anchor_lang::prelude::*;
use crate::errors::VaultError;
use crate::state::{DlmmPosition, GlobalConfig};

#[derive(Accounts)]
pub struct CloseDlmmPositionAccount<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        mut,
        seeds = [b"dlmm_position", &dlmm_position.position_index.to_le_bytes()],
        bump = dlmm_position.bump,
        close = admin,
    )]
    pub dlmm_position: Account<'info, DlmmPosition>,
}

pub fn handler(_ctx: Context<CloseDlmmPositionAccount>) -> Result<()> {
    msg!("DLMM position account closed successfully");
    Ok(())
}
