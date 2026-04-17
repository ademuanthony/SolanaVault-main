use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::state::GlobalConfig;

/// Permissionless keeper sweep — atomically transfers every accrued fee
/// bucket (company / dev1 / dev2 / dev3 / marketer1) from the vault USDC
/// PDA to each recipient's USDC ATA in a single transaction, then zeros
/// the bucket counters.
///
/// Anyone can sign the `payer` slot. Safety rails:
///   * Every destination account is pinned by `token::authority = config.<wallet>`,
///     so a caller cannot redirect payouts.
///   * `min_distribution_amount` guards against dust-griefing.
///   * Whole tx reverts atomically on any CPI failure — no partial zeroing.
///
/// The per-bucket `withdraw_company_fees` / `withdraw_dev_fees` /
/// `withdraw_marketer_fees` instructions remain available as fallbacks in
/// case one recipient ATA is frozen or in transition.
#[derive(Accounts)]
pub struct DistributeAccruedFees<'info> {
    /// Just pays tx fees / compute. No privilege beyond signing.
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        address = global_config.vault_usdc_account,
        token::mint = global_config.usdc_mint,
        seeds = [b"vault_usdc", global_config.key().as_ref()],
        bump,
    )]
    pub vault_usdc_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = global_config.usdc_mint,
        token::authority = global_config.company_wallet,
    )]
    pub company_usdc_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = global_config.usdc_mint,
        token::authority = global_config.dev1_wallet,
    )]
    pub dev1_usdc_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = global_config.usdc_mint,
        token::authority = global_config.dev2_wallet,
    )]
    pub dev2_usdc_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = global_config.usdc_mint,
        token::authority = global_config.dev3_wallet,
    )]
    pub dev3_usdc_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = global_config.usdc_mint,
        token::authority = global_config.marketer1_wallet,
    )]
    pub marketer1_usdc_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<DistributeAccruedFees>) -> Result<()> {
    require!(!ctx.accounts.global_config.paused, VaultError::VaultPaused);

    // Snapshot bucket amounts before any mutation.
    let c = ctx.accounts.global_config.company_fees;
    let d1 = ctx.accounts.global_config.dev1_fees;
    let d2 = ctx.accounts.global_config.dev2_fees;
    let d3 = ctx.accounts.global_config.dev3_fees;
    let m1 = ctx.accounts.global_config.marketer1_fees;

    let total = c
        .checked_add(d1).ok_or(VaultError::MathOverflow)?
        .checked_add(d2).ok_or(VaultError::MathOverflow)?
        .checked_add(d3).ok_or(VaultError::MathOverflow)?
        .checked_add(m1).ok_or(VaultError::MathOverflow)?;

    require!(total > 0, VaultError::NothingToDistribute);
    let min_total = ctx.accounts.global_config.min_distribution_amount;
    if min_total > 0 {
        require!(total >= min_total, VaultError::BelowMinDistribution);
    }

    // GlobalConfig PDA signer seeds for CPI authority.
    let bump = ctx.accounts.global_config.bump;
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[GlobalConfig::SEED, &bump_seed];
    let signer: &[&[&[u8]]] = &[seeds];

    let token_program = ctx.accounts.token_program.to_account_info();
    let vault_usdc = ctx.accounts.vault_usdc_account.to_account_info();
    let authority = ctx.accounts.global_config.to_account_info();

    // Per-bucket sweep. Each transfer is skipped when amount == 0.
    // If any CPI fails, the whole instruction reverts and no bucket is zeroed.
    let transfers: [(u64, AccountInfo); 5] = [
        (c, ctx.accounts.company_usdc_account.to_account_info()),
        (d1, ctx.accounts.dev1_usdc_account.to_account_info()),
        (d2, ctx.accounts.dev2_usdc_account.to_account_info()),
        (d3, ctx.accounts.dev3_usdc_account.to_account_info()),
        (m1, ctx.accounts.marketer1_usdc_account.to_account_info()),
    ];

    for (amount, dest) in transfers.iter() {
        if *amount > 0 {
            let cpi = CpiContext::new_with_signer(
                token_program.clone(),
                Transfer {
                    from: vault_usdc.clone(),
                    to: dest.clone(),
                    authority: authority.clone(),
                },
                signer,
            );
            token::transfer(cpi, *amount)?;
        }
    }

    // All transfers succeeded — zero the buckets and stamp the timestamp.
    let cfg = &mut ctx.accounts.global_config;
    cfg.company_fees = 0;
    cfg.dev1_fees = 0;
    cfg.dev2_fees = 0;
    cfg.dev3_fees = 0;
    cfg.marketer1_fees = 0;
    cfg.last_distribution_at = Clock::get()?.unix_timestamp;

    msg!(
        "Fees distributed: company={} dev1={} dev2={} dev3={} marketer1={} total={}",
        c, d1, d2, d3, m1, total
    );

    Ok(())
}
