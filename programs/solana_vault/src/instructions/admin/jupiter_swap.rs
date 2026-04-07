use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
};

use crate::errors::VaultError;
use crate::state::GlobalConfig;

/// Jupiter v6 Swap Program ID (mainnet)
/// The v1 API (api.jup.ag/swap/v1/) still routes through v6 on-chain
pub const JUPITER_V6_PROGRAM_ID_STR: &str = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

pub fn get_jupiter_program_id() -> Pubkey {
    JUPITER_V6_PROGRAM_ID_STR
        .parse()
        .expect("Invalid Jupiter program ID")
}

/// Compact representation of Jupiter's required AccountMeta for CPI.
///
/// This is constructed off-chain from Jupiter's `/swap-instructions` response
/// and passed into the program so we can rebuild the exact `Instruction`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SwapAccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

/// Full Jupiter swap payload (accounts + raw instruction data).
///
/// The client is responsible for:
/// - Calling Jupiter's quote + swap-instructions APIs
/// - Converting the returned `Instruction` accounts + data into this struct
/// - Ensuring that all `pubkey`s here correspond to the accounts passed to
///   this instruction (explicit accounts + `remaining_accounts`)
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct JupiterSwapData {
    pub accounts: Vec<SwapAccountMeta>,
    pub data: Vec<u8>,
}

#[derive(Accounts)]
pub struct JupiterSwap<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,

    /// CHECK: Jupiter swap program (validated via instruction)
    /// Should match JUPITER_V6_PROGRAM_ID
    pub jupiter_program: AccountInfo<'info>,

    /// CHECK: Source token account (typically vault USDC account)
    /// This should be the token account we're swapping FROM
    #[account(mut)]
    pub source_token_account: AccountInfo<'info>,

    /// CHECK: Destination token account (token account we're swapping TO)
    #[account(mut)]
    pub destination_token_account: AccountInfo<'info>,

    /// CHECK: Token program
    pub token_program: AccountInfo<'info>,
}

/// Expected remaining accounts: All additional accounts required by the
/// Jupiter swap route that are not already explicit fields above.
///
/// These are determined off-chain when building the swap route via Jupiter's
/// `/v6/swap-instructions` API and must line up with `swap_data.accounts`.
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, JupiterSwap<'info>>,
    amount: u64,
    minimum_amount_out: u64,
    swap_data: JupiterSwapData,
) -> Result<()> {
    require!(amount > 0, VaultError::InvalidDepositAmount);
    require!(minimum_amount_out > 0, VaultError::InvalidRemainingAccounts);

    // Validate Jupiter program ID
    let jupiter_program_id = get_jupiter_program_id();
    require!(
        ctx.accounts.jupiter_program.key() == jupiter_program_id,
        VaultError::InvalidRemainingAccounts
    );

    // Build the Jupiter `Instruction` from client-provided metas + data.
    //
    // The client MUST ensure that:
    // - `swap_data.accounts` are in the exact order expected by Jupiter
    // - Every `pubkey` in `swap_data.accounts` is passed as either:
    //   - an explicit account (source_token_account, destination_token_account, token_program), or
    //   - one of `ctx.remaining_accounts`
    let mut metas: Vec<AccountMeta> = Vec::with_capacity(swap_data.accounts.len());
    for meta in &swap_data.accounts {
        metas.push(AccountMeta {
            pubkey: meta.pubkey,
            is_signer: meta.is_signer,
            is_writable: meta.is_writable,
        });
    }

    let ix = Instruction {
        program_id: jupiter_program_id,
        accounts: metas,
        data: swap_data.data.clone(),
    };

    // Map metas -> AccountInfos in the SAME ORDER as `swap_data.accounts`.
    // Start with a pool of all available AccountInfos.
    let mut all_infos: Vec<AccountInfo<'info>> = Vec::with_capacity(3 + ctx.remaining_accounts.len());
    all_infos.push(ctx.accounts.source_token_account.to_account_info());
    all_infos.push(ctx.accounts.destination_token_account.to_account_info());
    all_infos.push(ctx.accounts.token_program.to_account_info());
    all_infos.extend_from_slice(ctx.remaining_accounts);

    let mut account_infos: Vec<AccountInfo<'info>> = Vec::with_capacity(swap_data.accounts.len() + 1);
    // First element must be the Jupiter program itself for `invoke_signed`.
    account_infos.push(ctx.accounts.jupiter_program.to_account_info());

    for meta in &swap_data.accounts {
        let info = all_infos
            .iter()
            .find(|ai| ai.key == &meta.pubkey)
            .ok_or(VaultError::InvalidRemainingAccounts)?;
        account_infos.push(info.clone());
    }

    // Determine if we need the GlobalConfig PDA to sign.
    let needs_global_signer = swap_data
        .accounts
        .iter()
        .any(|m| m.is_signer && m.pubkey == ctx.accounts.global_config.key());

    if needs_global_signer {
        // Prepare seeds for the GlobalConfig PDA.
        let bump = ctx.accounts.global_config.bump;
        let bump_seed = [bump];
        let seeds: &[&[u8]] = &[
            GlobalConfig::SEED,
            &bump_seed,
        ];

        invoke_signed(&ix, &account_infos, &[seeds])
            .map_err(|_| VaultError::InvalidRemainingAccounts)?;
    } else {
        // No PDA signing required; plain invoke is enough.
        invoke(&ix, &account_infos)
            .map_err(|_| VaultError::InvalidRemainingAccounts)?;
    }

    msg!(
        "Jupiter swap executed: in_amount = {}, min_out = {}",
        amount,
        minimum_amount_out
    );

    Ok(())
}
