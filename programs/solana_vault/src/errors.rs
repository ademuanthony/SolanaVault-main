use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Unauthorized: Only admin can perform this action")]
    UnauthorizedAdmin,
    
    #[msg("Unauthorized: Only dev can perform this action")]
    UnauthorizedDev,
    
    #[msg("Invalid dev index")]
    InvalidDevIndex,
    
    #[msg("Dev can only update their own wallet")]
    InvalidDevWalletUpdate,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
    
    #[msg("Math overflow")]
    MathOverflow,
    
    #[msg("Invalid referral chain")]
    InvalidReferralChain,
    
    #[msg("User account not found")]
    UserAccountNotFound,
    
    #[msg("Vault not initialized")]
    VaultNotInitialized,
    
    #[msg("Invalid share amount")]
    InvalidShareAmount,
    
    #[msg("Invalid deposit amount")]
    InvalidDepositAmount,
    
    #[msg("User already registered")]
    UserAlreadyRegistered,
    
    #[msg("Cannot refer yourself")]
    CannotReferSelf,
    
    #[msg("Referrer not found")]
    ReferrerNotFound,

   
    // ...
    #[msg("Invalid remaining accounts passed")]
    InvalidRemainingAccounts,
    
    #[msg("Invalid operation")]
    InvalidOperation,
    
    #[msg("User account is flagged and cannot perform this operation")]
    UserFlagged,

    #[msg("Invalid fee distribution: total must be 100%")]
    InvalidFeeDistribution,

    #[msg("Invalid referral distribution: total must be 100%")]
    InvalidReferralDistribution,

    #[msg("Token account must have zero balance before closing")]
    TokenAccountNotEmpty,

    #[msg("TVL decrease exceeds maximum allowed per update (20%)")]
    TvlDecreaseTooLarge,

    #[msg("TVL increase exceeds maximum allowed per update (50%)")]
    TvlIncreaseTooLarge,

    #[msg("Vault is paused")]
    VaultPaused,

    #[msg("No pending admin to accept")]
    NoPendingAdmin,

    #[msg("Signer does not match the pending admin")]
    NotPendingAdmin,

    #[msg("Deposit would exceed global max TVL")]
    ExceedsMaxTvl,

    #[msg("Deposit would exceed per-user share cap")]
    ExceedsMaxUserShares,

    #[msg("Slippage: output less than minimum_amount_out")]
    SlippageExceeded,
}
