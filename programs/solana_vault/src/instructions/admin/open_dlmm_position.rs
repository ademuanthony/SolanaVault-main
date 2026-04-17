use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
};
use anchor_spl::token::TokenAccount;

use crate::errors::VaultError;
use crate::state::{DlmmMode, DlmmPosition, GlobalConfig, VaultState};

/// Meteora DLMM program id (mainnet + devnet).
pub const METEORA_DLMM_PROGRAM_ID_STR: &str = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";

pub fn get_meteora_dlmm_program_id() -> Pubkey {
    METEORA_DLMM_PROGRAM_ID_STR
        .parse()
        .expect("Invalid Meteora DLMM program ID")
}

/// Compact representation of DLMM AccountMeta for CPI.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DlmmAccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

/// Full DLMM CPI payload (accounts + raw instruction data).
///
/// Built off-chain using Meteora's DLMM SDK and passed in so we can
/// forward the CPI on-chain.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DlmmCpiData {
    pub accounts: Vec<DlmmAccountMeta>,
    pub data: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OpenDlmmPositionParams {
    pub position_index: u8,
    pub dlmm_pool: Pubkey,
    pub position_nft: Pubkey,
    pub bin_array_lower: Pubkey,
    pub bin_array_upper: Pubkey,
    pub mode: DlmmMode,
    pub bin_id_lower: i32,
    pub bin_id_upper: i32,
    pub token_x_amount: u64,
    pub token_y_amount: u64,
    pub ratio: u8,
    pub one_sided: bool,
}

#[derive(Accounts)]
#[instruction(params: OpenDlmmPositionParams)]
pub struct OpenDlmmPosition<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,

    /// DLMM position metadata owned by this program. The PDA derivation
    /// is `["dlmm_position", [position_index]]`.
    #[account(
        init,
        payer = admin,
        space = 8 + DlmmPosition::INIT_SPACE,
        seeds = [DlmmPosition::SEED, &[params.position_index]],
        bump
    )]
    pub dlmm_position: Account<'info, DlmmPosition>,

    #[account(
        mut,
        seeds = [VaultState::SEED],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    /// Vault USDC PDA — used to diff balance pre/post CPI and mark TVL
    /// down by the amount of USDC deployed into the Meteora position.
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

    pub system_program: Program<'info, System>,
}

/// Expected remaining accounts: all additional accounts required by the
/// Meteora DLMM CPI (`initializePositionAndAddLiquidity` or similar),
/// in the same order as `cpi_data.accounts`.
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, OpenDlmmPosition<'info>>,
    params: OpenDlmmPositionParams,
    cpi_data: DlmmCpiData,
) -> Result<()> {
    // Validate program id
    let expected = get_meteora_dlmm_program_id();
    require!(
        ctx.accounts.dlmm_program.key() == expected,
        VaultError::InvalidRemainingAccounts
    );

    let dlmm_program_key = ctx.accounts.dlmm_program.key();

    // Snapshot vault USDC balance pre-CPI to compute the TVL delta afterwards.
    let pre_usdc = ctx.accounts.vault_usdc_account.amount;

    // Build the DLMM `Instruction` from client-provided metas + data.
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
        Vec::with_capacity(5 + ctx.remaining_accounts.len());
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

    // TVL is conserved by "deploy into position": USDC leaves the vault ATA
    // but is still capital-at-work. Do not mutate `total_tvl` here — that
    // stays pinned to the last `update_tvl` snapshot. We only log the delta
    // for off-chain monitoring.
    ctx.accounts.vault_usdc_account.reload()?;
    let post_usdc = ctx.accounts.vault_usdc_account.amount;
    let usdc_deployed = pre_usdc.saturating_sub(post_usdc);

    // Update DlmmPosition metadata after successful CPI.
    let position = &mut ctx.accounts.dlmm_position;
    position.position_index = params.position_index;
    position.dlmm_pool = params.dlmm_pool;
    position.position_nft = params.position_nft;
    position.bin_array_lower = params.bin_array_lower;
    position.bin_array_upper = params.bin_array_upper;
    position.mode = params.mode;
    position.bin_id_lower = params.bin_id_lower;
    position.bin_id_upper = params.bin_id_upper;
    position.token_x_amount = params.token_x_amount;
    position.token_y_amount = params.token_y_amount;
    position.ratio = params.ratio;
    position.one_sided = params.one_sided;
    position.created_at = Clock::get()?.unix_timestamp;
    position.bump = ctx.bumps.dlmm_position;

    // Increment positions_count (saturating at u8::MAX).
    let vault_state = &mut ctx.accounts.vault_state;
    if vault_state.positions_count < u8::MAX {
        vault_state.positions_count += 1;
    }

    msg!(
        "DLMM position opened: pool={}, index={}, nft={}, usdc_deployed={}",
        params.dlmm_pool,
        params.position_index,
        params.position_nft,
        usdc_deployed
    );

    Ok(())
}

