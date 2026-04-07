use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::state::GlobalConfig;

use super::jupiter_swap::get_jupiter_program_id;

#[derive(Accounts)]
pub struct JupiterSwapV2<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,

    /// CHECK: Jupiter swap program (validated below)
    pub jupiter_program: AccountInfo<'info>,

    /// CHECK: Source token account (vault's custom PDA token account)
    #[account(mut)]
    pub source_token_account: AccountInfo<'info>,

    /// CHECK: Destination token account
    #[account(mut)]
    pub destination_token_account: AccountInfo<'info>,

    /// The PDA's standard ATA for the input mint (where Jupiter expects source tokens).
    /// Tokens are transferred here from source_token_account before the swap.
    #[account(mut)]
    pub jupiter_source_ata: Account<'info, TokenAccount>,

    /// The PDA's standard ATA for the output mint (where Jupiter deposits output tokens).
    /// Tokens are transferred from here to destination_token_account after the swap.
    #[account(mut)]
    pub jupiter_destination_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// V2 Jupiter swap with automatic pre/post token transfers.
///
/// Because the vault uses custom PDA token accounts (not standard ATAs),
/// but Jupiter derives standard ATAs for the user, we must:
/// 1. Transfer `swap_amount` from vault source → PDA's standard source ATA
/// 2. CPI into Jupiter (swaps between PDA's standard ATAs)
/// 3. Transfer all output from PDA's standard destination ATA → vault destination
///
/// remaining_accounts must be the Jupiter swap instruction accounts in the
/// exact order Jupiter expects.
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, JupiterSwapV2<'info>>,
    swap_data: Vec<u8>,
    swap_amount: u64,
) -> Result<()> {
    require!(!swap_data.is_empty(), VaultError::InvalidDepositAmount);
    require!(swap_amount > 0, VaultError::InvalidDepositAmount);

    // Validate Jupiter program ID
    let jupiter_program_id = get_jupiter_program_id();
    require!(
        ctx.accounts.jupiter_program.key() == jupiter_program_id,
        VaultError::InvalidRemainingAccounts
    );

    require!(
        !ctx.remaining_accounts.is_empty(),
        VaultError::InvalidRemainingAccounts
    );

    let bump = ctx.accounts.global_config.bump;
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[GlobalConfig::SEED, &bump_seed];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    // Step 1: Transfer input tokens from vault PDA account → PDA's standard ATA
    // (Only if they are different accounts)
    if ctx.accounts.source_token_account.key() != ctx.accounts.jupiter_source_ata.key() {
        let transfer_in = Transfer {
            from: ctx.accounts.source_token_account.to_account_info(),
            to: ctx.accounts.jupiter_source_ata.to_account_info(),
            authority: ctx.accounts.global_config.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_in,
                signer_seeds,
            ),
            swap_amount,
        )?;
    }

    // Step 2: CPI into Jupiter
    // Explicitly control signer status: only the GlobalConfig PDA should be a signer.
    // Do NOT copy ai.is_signer — it may have been mutated by the prior token::transfer CPI.
    let global_config_key = ctx.accounts.global_config.key();
    let metas: Vec<AccountMeta> = ctx.remaining_accounts.iter().map(|ai| {
        let is_signer = *ai.key == global_config_key;
        if ai.is_writable {
            AccountMeta::new(*ai.key, is_signer)
        } else {
            AccountMeta::new_readonly(*ai.key, is_signer)
        }
    }).collect();

    let ix = Instruction {
        program_id: jupiter_program_id,
        accounts: metas,
        data: swap_data,
    };

    let mut account_infos: Vec<AccountInfo<'info>> = Vec::with_capacity(1 + ctx.remaining_accounts.len());
    account_infos.push(ctx.accounts.jupiter_program.to_account_info());
    for ai in ctx.remaining_accounts.iter() {
        account_infos.push(ai.clone());
    }

    invoke_signed(&ix, &account_infos, signer_seeds)?;

    // Step 3: Transfer output tokens from PDA's standard destination ATA → vault destination
    // (Only if they are different accounts)
    ctx.accounts.jupiter_destination_ata.reload()?;
    let output_amount = ctx.accounts.jupiter_destination_ata.amount;

    if ctx.accounts.destination_token_account.key() != ctx.accounts.jupiter_destination_ata.key()
        && output_amount > 0
    {
        let transfer_out = Transfer {
            from: ctx.accounts.jupiter_destination_ata.to_account_info(),
            to: ctx.accounts.destination_token_account.to_account_info(),
            authority: ctx.accounts.global_config.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_out,
                signer_seeds,
            ),
            output_amount,
        )?;
    }

    msg!("Jupiter swap v2 executed: in={}, out={}", swap_amount, output_amount);

    Ok(())
}
