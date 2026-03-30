use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};


use crate::errors::VaultError;
use crate::state::{GlobalConfig, UserAccount, VaultState};

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [UserAccount::SEED, user.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        seeds = [VaultState::SEED],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault_usdc", global_config.key().as_ref()],
        bump
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_share_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = global_config.share_mint
    )]
    pub share_mint: Account<'info, Mint>,

    // /// CHECK: Optional referral account for level 1 (must match user_account.referrer)
    // pub referrer_l1: Option<AccountInfo<'info>>,

    // /// CHECK: Optional referral account for level 2
    // pub referrer_l2: Option<AccountInfo<'info>>,

    // /// CHECK: Optional referral account for level 3
    // pub referrer_l3: Option<AccountInfo<'info>>,

    // /// CHECK: Optional referral account for level 4
    // pub referrer_l4: Option<AccountInfo<'info>>,

    // /// CHECK: Optional referral account for level 5
    // pub referrer_l5: Option<AccountInfo<'info>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>,
    shares: u64,
) -> Result<()> {
    require!(shares > 0, VaultError::InvalidShareAmount);

    let referrer = ctx.accounts.user_account.referrer;

    // ✅ Clone AccountInfos so we don't hold refs tied to ctx.accounts borrows
    let mut referral_accounts: [Option<AccountInfo<'info>>; 5] = [None, None, None, None, None];

    for (i, acc) in ctx.remaining_accounts.iter().take(5).enumerate() {
        referral_accounts[i] = Some(acc.clone());
    }


    let user_account = &mut ctx.accounts.user_account;
    let vault_state = &mut ctx.accounts.vault_state;
    let global_config = &mut ctx.accounts.global_config;
    
    // Check if user is flagged
    require!(!user_account.is_flagged, VaultError::UserFlagged);

    require!(
        user_account.shares >= shares,
        VaultError::InsufficientFunds
    );

    // Calculate USDC value of shares
    let current_share_price = vault_state.calculate_share_price()?;
    // Use u128 for intermediate calculation to avoid overflow
    let usdc_value_u128 = (shares as u128)
        .checked_mul(current_share_price as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(1_000_000_000)
        .ok_or(VaultError::MathOverflow)?;
    require!(
        usdc_value_u128 <= u64::MAX as u128,
        VaultError::MathOverflow
    );
    let usdc_value = usdc_value_u128 as u64;

    // Calculate entry value (cost basis)
    // Use u128 for intermediate calculation to avoid overflow
    let entry_value_u128 = (shares as u128)
        .checked_mul(user_account.entry_price as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(1_000_000_000)
        .ok_or(VaultError::MathOverflow)?;
    require!(
        entry_value_u128 <= u64::MAX as u128,
        VaultError::MathOverflow
    );
    let entry_value = entry_value_u128 as u64;

    // Calculate profit (only if positive)
    let profit = if usdc_value > entry_value {
        usdc_value
            .checked_sub(entry_value)
            .ok_or(VaultError::MathOverflow)?
    } else {
        0
    };

    // Calculate fee based on tier (using remaining shares for active deposit value)
    let remaining_shares = user_account
        .shares
        .checked_sub(shares)
        .ok_or(VaultError::MathOverflow)?;
    // Use u128 for intermediate calculation to avoid overflow
    let active_deposit_value_u128 = (remaining_shares as u128)
        .checked_mul(current_share_price as u128)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(1_000_000_000)
        .ok_or(VaultError::MathOverflow)?;
    require!(
        active_deposit_value_u128 <= u64::MAX as u128,
        VaultError::MathOverflow
    );
    let active_deposit_value = active_deposit_value_u128 as u64;

    let fee_rate = if active_deposit_value < global_config.tier1_threshold {
        global_config.tier1_fee
    } else if active_deposit_value < global_config.tier2_threshold {
        global_config.tier2_fee
    } else {
        global_config.tier3_fee
    };

    let fee_amount = profit
        .checked_mul(fee_rate as u64)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(100)
        .ok_or(VaultError::MathOverflow)?;

    // Calculate user receives
    let user_receives = usdc_value
        .checked_sub(fee_amount)
        .ok_or(VaultError::MathOverflow)?;

    // Burn shares
    let cpi_accounts = Burn {
        mint: ctx.accounts.share_mint.to_account_info(),
        from: ctx.accounts.user_share_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::burn(cpi_ctx, shares)?;

    // Distribute fees if profit was made
    if fee_amount > 0 {
        // ✅ pass array BY VALUE (no borrowed slice lifetimes)
        distribute_fees(referral_accounts, global_config, fee_amount, referrer)?;
    }

    // Transfer USDC to user
    let global_config_bump = ctx.accounts.global_config.bump;
    let seeds = &[
        GlobalConfig::SEED,
        &[global_config_bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_usdc_account.to_account_info(),
        to: ctx.accounts.user_usdc_account.to_account_info(),
        authority: ctx.accounts.global_config.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
    token::transfer(cpi_ctx, user_receives)?;

    // Update state
    user_account.shares = user_account
        .shares
        .checked_sub(shares)
        .ok_or(VaultError::MathOverflow)?;

    vault_state.total_tvl = vault_state
        .total_tvl
        .checked_sub(usdc_value)
        .ok_or(VaultError::MathOverflow)?;
    vault_state.total_shares = vault_state
        .total_shares
        .checked_sub(shares)
        .ok_or(VaultError::MathOverflow)?;

    msg!(
        "Withdraw: {} shares, {} USDC value, {} fee, {} to user",
        shares,
        usdc_value,
        fee_amount,
        user_receives
    );

    Ok(())
}

fn distribute_fees<'info>(
    // ✅ array by value removes lifetime headaches
    referral_accounts: [Option<AccountInfo<'info>>; 5],
    global_config: &mut Account<'info, GlobalConfig>,
    total_fee: u64,
    first_referrer: Option<Pubkey>,
) -> Result<()> {
    // Calculate distribution amounts
    let company_amount = total_fee
        .checked_mul(global_config.company_share as u64)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(100)
        .ok_or(VaultError::MathOverflow)?;

    let dev1_amount = total_fee
        .checked_mul(global_config.dev1_share as u64)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(100)
        .ok_or(VaultError::MathOverflow)?;

    let dev2_amount = total_fee
        .checked_mul(global_config.dev2_share as u64)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(100)
        .ok_or(VaultError::MathOverflow)?;

    let dev3_amount = total_fee
        .checked_mul(global_config.dev3_share as u64)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(100)
        .ok_or(VaultError::MathOverflow)?;

    let marketer1_amount = total_fee
        .checked_mul(global_config.marketer1_share as u64)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(100)
        .ok_or(VaultError::MathOverflow)?;

    let referral_pool_amount = total_fee
        .checked_mul(global_config.referral_pool_share as u64)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(100)
        .ok_or(VaultError::MathOverflow)?;

    // Update company fees
    global_config.company_fees = global_config
        .company_fees
        .checked_add(company_amount)
        .ok_or(VaultError::MathOverflow)?;

    // Update dev fees
    global_config.dev1_fees = global_config
        .dev1_fees
        .checked_add(dev1_amount)
        .ok_or(VaultError::MathOverflow)?;
    global_config.dev2_fees = global_config
        .dev2_fees
        .checked_add(dev2_amount)
        .ok_or(VaultError::MathOverflow)?;
    global_config.dev3_fees = global_config
        .dev3_fees
        .checked_add(dev3_amount)
        .ok_or(VaultError::MathOverflow)?;

    // Update marketer fees
    global_config.marketer1_fees = global_config
        .marketer1_fees
        .checked_add(marketer1_amount)
        .ok_or(VaultError::MathOverflow)?;

    // Distribute referral pool across 5 levels
    if let Some(referrer_pubkey) = first_referrer {
        distribute_referral_pool(
            referral_accounts,
            global_config,
            referral_pool_amount,
            referrer_pubkey,
        )?;
    } else {
        // No referrer, add referral pool to company fees
        global_config.company_fees = global_config
            .company_fees
            .checked_add(referral_pool_amount)
            .ok_or(VaultError::MathOverflow)?;
    }

    Ok(())
}

fn distribute_referral_pool<'info>(
    // ✅ array by value removes lifetime headaches
    referral_accounts: [Option<AccountInfo<'info>>; 5],
    global_config: &mut Account<'info, GlobalConfig>,
    referral_pool_amount: u64,
    first_referrer: Pubkey,
) -> Result<()> {
    // Referral level percentages (out of 100% of referral pool)
    let level_shares = [
        global_config.referral_l1_share,
        global_config.referral_l2_share,
        global_config.referral_l3_share,
        global_config.referral_l4_share,
        global_config.referral_l5_share,
    ];

    // Track current referrer to validate chain
    let mut current_referrer = Some(first_referrer);
    let mut total_distributed = 0u64;

    // Distribute to each level
    for (level, &share_percent) in level_shares.iter().enumerate() {
        // Check if we have a referrer for this level
        if let Some(ref_referrer) = current_referrer {
                // Check if account info is provided for this level
            if let Some(account_info) = referral_accounts[level].as_ref() {
                // Scope for validation (immutable borrow)
                {
                    let account_data_ro = account_info.try_borrow_data()?;
                    let mut ro_slice: &[u8] = &account_data_ro;
                    let referrer_account_ro = UserAccount::try_deserialize(&mut ro_slice)?;

                    // Verify belongs to expected referrer
                    require!(
                        referrer_account_ro.wallet == ref_referrer,
                        VaultError::InvalidReferralChain
                    );
                } // account_data_ro is dropped here, releasing the borrow

                // Calculate amount for this level
                let level_amount = referral_pool_amount
                    .checked_mul(share_percent as u64)
                    .ok_or(VaultError::MathOverflow)?
                    .checked_div(100)
                    .ok_or(VaultError::MathOverflow)?;

                // Get mutable data and deserialize
                let mut account_data = account_info.try_borrow_mut_data()?;
                let mut data_slice: &[u8] = &account_data;
                let mut referrer_account_mut = UserAccount::try_deserialize(&mut data_slice)?;

                // Update referrer's earnings
                referrer_account_mut.unclaimed_referral_earnings = referrer_account_mut
                    .unclaimed_referral_earnings
                    .checked_add(level_amount)
                    .ok_or(VaultError::MathOverflow)?;

                referrer_account_mut.total_referral_earnings = referrer_account_mut
                    .total_referral_earnings
                    .checked_add(level_amount)
                    .ok_or(VaultError::MathOverflow)?;

                // Serialize back
                let mut write_cursor: &mut [u8] = &mut account_data;
                referrer_account_mut.try_serialize(&mut write_cursor)?;

                total_distributed = total_distributed
                    .checked_add(level_amount)
                    .ok_or(VaultError::MathOverflow)?;

                // Move to next level in chain (use the updated account)
                current_referrer = referrer_account_mut.referrer;

                msg!(
                    "Distributed {} USDC to referral level {} ({}%)",
                    level_amount,
                    level + 1,
                    share_percent
                );
            } else {
                // No account provided for this level, stop distribution
                break;
            }
        } else {
            // No more referrers in chain, stop distribution
            break;
        }
    }

    // If there's remaining referral pool (due to shorter chain), add to company fees
    let remaining = referral_pool_amount
        .checked_sub(total_distributed)
        .ok_or(VaultError::MathOverflow)?;

    if remaining > 0 {
        global_config.company_fees = global_config
            .company_fees
            .checked_add(remaining)
            .ok_or(VaultError::MathOverflow)?;
        msg!(
            "Remaining referral pool {} USDC added to company fees (chain shorter than 5 levels)",
            remaining
        );
    }

    Ok(())
}
