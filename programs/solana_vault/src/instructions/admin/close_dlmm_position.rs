use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
};
use anchor_spl::token::TokenAccount;

use crate::errors::VaultError;
use crate::state::{DlmmPosition, GlobalConfig, VaultState};
use super::open_dlmm_position::{DlmmCpiData, get_meteora_dlmm_program_id};

#[derive(Accounts)]
pub struct CloseDlmmPosition<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        close = admin,
        seeds = [DlmmPosition::SEED, &[dlmm_position.position_index]],
        bump = dlmm_position.bump
    )]
    pub dlmm_position: Account<'info, DlmmPosition>,

    #[account(
        mut,
        seeds = [VaultState::SEED],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    /// Vault USDC PDA — used to measure USDC recovered from the closed
    /// position for logging (TVL still reconciles via `update_tvl`).
    #[account(
        mut,
        address = global_config.vault_usdc_account,
        token::mint = global_config.usdc_mint,
        seeds = [b"vault_usdc", global_config.key().as_ref()],
        bump
    )]
    pub vault_usdc_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Meteora DLMM program
    pub dlmm_program: AccountInfo<'info>,
}

/// Expected remaining accounts: all additional accounts required by the
/// Meteora DLMM CPI for closing a position and removing liquidity.
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, CloseDlmmPosition<'info>>,
    cpi_data: DlmmCpiData,
) -> Result<()> {
    // Validate program id
    let expected = get_meteora_dlmm_program_id();
    require!(
        ctx.accounts.dlmm_program.key() == expected,
        VaultError::InvalidRemainingAccounts
    );

    let dlmm_program_key = ctx.accounts.dlmm_program.key();

    // Snapshot vault USDC balance pre-CPI for the post-CPI delta log.
    let pre_usdc = ctx.accounts.vault_usdc_account.amount;

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
    // Include admin and global_config so their signer status is available for CPI.
    let mut all_infos: Vec<AccountInfo<'info>> =
        Vec::with_capacity(3 + ctx.remaining_accounts.len());
    all_infos.push(ctx.accounts.dlmm_program.to_account_info());
    all_infos.push(ctx.accounts.admin.to_account_info());
    all_infos.push(ctx.accounts.global_config.to_account_info());
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

    // Reload and log the USDC delta so an off-chain orchestrator can decide
    // whether to call `update_tvl` (and by how much). TVL is not mutated here.
    ctx.accounts.vault_usdc_account.reload()?;
    let post_usdc = ctx.accounts.vault_usdc_account.amount;
    let usdc_recovered = post_usdc.saturating_sub(pre_usdc);

    // Mark the position as closed and decrement positions_count (account will be closed after handler).
    let position = &mut ctx.accounts.dlmm_position;
    position.token_x_amount = 0;
    position.token_y_amount = 0;
    position.ratio = 0;
    position.one_sided = false;

    let vault_state = &mut ctx.accounts.vault_state;
    if vault_state.positions_count > 0 {
        vault_state.positions_count -= 1;
    }

    msg!(
        "DLMM position closed: pool={}, index={}, nft={}, usdc_recovered={}",
        position.dlmm_pool,
        position.position_index,
        position.position_nft,
        usdc_recovered
    );

    Ok(())
}

