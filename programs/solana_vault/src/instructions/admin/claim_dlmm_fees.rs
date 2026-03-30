use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
};

use crate::errors::VaultError;
use crate::state::{DlmmPosition, GlobalConfig, VaultState};
use super::open_dlmm_position::{DlmmCpiData, get_meteora_dlmm_program_id};

#[derive(Accounts)]
pub struct ClaimDlmmFees<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub dlmm_position: Account<'info, DlmmPosition>,

    #[account(
        mut,
        seeds = [VaultState::SEED],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    /// CHECK: Meteora DLMM program
    pub dlmm_program: AccountInfo<'info>,
}

/// Expected remaining accounts: all additional accounts required by the
/// Meteora DLMM CPI for claiming swap fees / rewards into the vault.
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, ClaimDlmmFees<'info>>,
    claimed_amount: u64,
    cpi_data: DlmmCpiData,
) -> Result<()> {
    // Validate program id
    let expected = get_meteora_dlmm_program_id();
    require!(
        ctx.accounts.dlmm_program.key() == expected,
        VaultError::InvalidRemainingAccounts
    );

    let dlmm_program_key = ctx.accounts.dlmm_program.key();

    let metas: Vec<AccountMeta> = cpi_data
        .accounts
        .iter()
        .map(|m| AccountMeta {
            pubkey: m.pubkey,
            is_signer: m.is_signer,
            is_writable: m.is_writable,
        })
        .collect();

    let ix = Instruction {
        program_id: dlmm_program_key,
        accounts: metas,
        data: cpi_data.data.clone(),
    };

    // Map metas -> AccountInfos using explicit + remaining accounts.
    let mut all_infos: Vec<AccountInfo<'info>> =
        Vec::with_capacity(1 + ctx.remaining_accounts.len());
    all_infos.push(ctx.accounts.dlmm_program.to_account_info());
    all_infos.extend_from_slice(ctx.remaining_accounts);

    let mut account_infos: Vec<AccountInfo<'info>> =
        Vec::with_capacity(cpi_data.accounts.len() + 1);
    account_infos.push(ctx.accounts.dlmm_program.to_account_info());

    for meta in &cpi_data.accounts {
        let info = all_infos
            .iter()
            .find(|ai| ai.key == &meta.pubkey)
            .ok_or(VaultError::InvalidRemainingAccounts)?;
        account_infos.push(info.clone());
    }

    // Decide whether we need the GlobalConfig PDA to sign.
    let needs_global_signer = cpi_data
        .accounts
        .iter()
        .any(|m| m.is_signer && m.pubkey == ctx.accounts.global_config.key());

    if needs_global_signer {
        let bump = ctx.accounts.global_config.bump;
        let bump_seed = [bump];
        let seeds: &[&[u8]] = &[GlobalConfig::SEED, &bump_seed];

        invoke_signed(&ix, &account_infos, &[seeds])
            .map_err(|_| VaultError::InvalidRemainingAccounts)?;
    } else {
        invoke(&ix, &account_infos).map_err(|_| VaultError::InvalidRemainingAccounts)?;
    }

    // Trust the admin-provided claimed_amount and add it to vault TVL.
    if claimed_amount > 0 {
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_tvl = vault_state
            .total_tvl
            .checked_add(claimed_amount)
            .ok_or(VaultError::MathOverflow)?;
    }

    msg!(
        "DLMM fees claimed: pool={}, index={}, amount={}",
        ctx.accounts.dlmm_position.dlmm_pool,
        ctx.accounts.dlmm_position.position_index,
        claimed_amount
    );

    Ok(())
}

