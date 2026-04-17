use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount, Transfer};

use crate::errors::VaultError;
use crate::state::{GlobalConfig, UserAccount, VaultState};

#[derive(Accounts)]
pub struct WelcomeBonusDeposit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [GlobalConfig::SEED],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ VaultError::UnauthorizedAdmin
    )]
    pub global_config: Account<'info, GlobalConfig>,

    /// CHECK: user wallet (used only for seeds)
    pub user: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [UserAccount::SEED, user.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
        address = global_config.share_mint
    )]
    pub share_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [VaultState::SEED],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub token_program: Program<'info, Token>,
}

/// Expected remaining accounts (in this exact order):
/// 0. admin_usdc_account (TokenAccount, writable)
/// 1. vault_usdc_account (TokenAccount, writable)
/// 2. user_share_account (TokenAccount, writable)
/// 3. dev1_usdc_account (TokenAccount, writable)
/// 4. dev2_usdc_account (TokenAccount, writable)
/// 5. dev3_usdc_account (TokenAccount, writable)
pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, WelcomeBonusDeposit<'info>>,
) -> Result<()> {

    require!(
        ctx.remaining_accounts.len() >= 6,
        VaultError::InvalidRemainingAccounts
    );

    let admin_usdc_ai = &ctx.remaining_accounts[0];
    let vault_usdc_ai = &ctx.remaining_accounts[1];
    let user_share_ai = &ctx.remaining_accounts[2];
    let dev1_usdc_ai = &ctx.remaining_accounts[3];
    let dev2_usdc_ai = &ctx.remaining_accounts[4];
    let dev3_usdc_ai = &ctx.remaining_accounts[5];

    // Defense-in-depth validation (High #3 / Critical #1).
    let usdc_mint = ctx.accounts.global_config.usdc_mint;
    let share_mint_pk = ctx.accounts.share_mint.key();
    let vault_usdc_expected = ctx.accounts.global_config.vault_usdc_account;

    // admin_usdc: must be USDC mint AND owned by admin signer
    {
        let admin_usdc: Account<TokenAccount> = Account::try_from(admin_usdc_ai)?;
        require!(admin_usdc.mint == usdc_mint, VaultError::InvalidRemainingAccounts);
        require!(
            admin_usdc.owner == ctx.accounts.admin.key(),
            VaultError::InvalidRemainingAccounts
        );
    }
    // vault_usdc: must be the canonical vault USDC account
    require!(
        vault_usdc_ai.key() == vault_usdc_expected,
        VaultError::InvalidRemainingAccounts
    );
    // user_share: must match share mint AND be owned by user wallet
    {
        let user_share: Account<TokenAccount> = Account::try_from(user_share_ai)?;
        require!(user_share.mint == share_mint_pk, VaultError::InvalidRemainingAccounts);
        require!(
            user_share.owner == ctx.accounts.user.key(),
            VaultError::InvalidRemainingAccounts
        );
    }
    // dev USDC accounts: USDC mint AND owned by the respective dev wallet
    let dev1_wallet = ctx.accounts.global_config.dev1_wallet;
    let dev2_wallet = ctx.accounts.global_config.dev2_wallet;
    let dev3_wallet = ctx.accounts.global_config.dev3_wallet;
    for (ai, expected_owner) in [
        (dev1_usdc_ai, dev1_wallet),
        (dev2_usdc_ai, dev2_wallet),
        (dev3_usdc_ai, dev3_wallet),
    ] {
        let ta: Account<TokenAccount> = Account::try_from(ai)?;
        require!(ta.mint == usdc_mint, VaultError::InvalidRemainingAccounts);
        require!(ta.owner == expected_owner, VaultError::InvalidRemainingAccounts);
    }

    // PDA signer seeds (global_config is authority)
    let global_config_bump = ctx.accounts.global_config.bump;
    let seeds = &[
        GlobalConfig::SEED,
        &[global_config_bump],
    ];
    let signer = &[&seeds[..]];

    let welcome_bonus_user = ctx.accounts.global_config.welcome_bonus_user;
    let welcome_bonus_dev = ctx.accounts.global_config.welcome_bonus_dev;
    let total_bonus = welcome_bonus_user.checked_add(
        welcome_bonus_dev.checked_mul(3).ok_or(VaultError::MathOverflow)?
    ).ok_or(VaultError::MathOverflow)?;

    // Transfer bonus from admin to vault
    {
        let cpi_accounts = Transfer {
            from: admin_usdc_ai.to_account_info(),
            to: vault_usdc_ai.to_account_info(),
            authority: ctx.accounts.admin.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, total_bonus)?;
    }

    // Calculate shares for user (welcome_bonus_user worth)
    let current_share_price = ctx.accounts.vault_state.calculate_share_price()?;
    let shares_to_mint = welcome_bonus_user
        .checked_mul(1_000_000_000)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(current_share_price)
        .ok_or(VaultError::MathOverflow)?;

    // Update user account shares and entry price
    let user_account = &mut ctx.accounts.user_account;
    if user_account.shares == 0 {
        user_account.entry_price = current_share_price;
    } else {
        let total_value_old = user_account
            .shares
            .checked_mul(user_account.entry_price)
            .ok_or(VaultError::MathOverflow)?;
        let total_value_new = shares_to_mint
            .checked_mul(current_share_price)
            .ok_or(VaultError::MathOverflow)?;
        let total_shares = user_account
            .shares
            .checked_add(shares_to_mint)
            .ok_or(VaultError::MathOverflow)?;
        let total_value = total_value_old
            .checked_add(total_value_new)
            .ok_or(VaultError::MathOverflow)?;
        user_account.entry_price = total_value
            .checked_div(total_shares)
            .ok_or(VaultError::MathOverflow)?;
    }

    // Mint shares to user
    {
        let cpi_accounts = MintTo {
            mint: ctx.accounts.share_mint.to_account_info(),
            to: user_share_ai.to_account_info(),
            authority: ctx.accounts.global_config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::mint_to(cpi_ctx, shares_to_mint)?;
    }

    user_account.shares = user_account
        .shares
        .checked_add(shares_to_mint)
        .ok_or(VaultError::MathOverflow)?;

    // Update vault state
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.total_tvl = vault_state
        .total_tvl
        .checked_add(welcome_bonus_user)
        .ok_or(VaultError::MathOverflow)?;
    vault_state.total_shares = vault_state
        .total_shares
        .checked_add(shares_to_mint)
        .ok_or(VaultError::MathOverflow)?;

    // Transfer dev share to each dev wallet
    {
        let cpi_accounts = Transfer {
            from: vault_usdc_ai.to_account_info(),
            to: dev1_usdc_ai.to_account_info(),
            authority: ctx.accounts.global_config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, welcome_bonus_dev)?;
    }
    {
        let cpi_accounts = Transfer {
            from: vault_usdc_ai.to_account_info(),
            to: dev2_usdc_ai.to_account_info(),
            authority: ctx.accounts.global_config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, welcome_bonus_dev)?;
    }
    {
        let cpi_accounts = Transfer {
            from: vault_usdc_ai.to_account_info(),
            to: dev3_usdc_ai.to_account_info(),
            authority: ctx.accounts.global_config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, welcome_bonus_dev)?;
    }

    msg!(
        "Welcome bonus deposited: {} USDC to user, {} to each dev",
        welcome_bonus_user,
        welcome_bonus_dev
    );

    Ok(())
}
