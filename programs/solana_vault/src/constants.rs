
// Fee tier thresholds (in USDC, scaled by 1e6 for decimals)
pub const TIER_1_THRESHOLD: u64 = 100_000_000; // $100
pub const TIER_2_THRESHOLD: u64 = 500_000_000; // $500

// Fee tier percentages
pub const TIER_1_FEE: u8 = 70; // 70% for < $100
pub const TIER_2_FEE: u8 = 60; // 60% for $100-$499
pub const TIER_3_FEE: u8 = 50; // 50% for >= $500

// Distribution percentages (out of 100)
pub const COMPANY_SHARE: u8 = 57;
pub const DEV1_SHARE: u8 = 15;
pub const DEV2_SHARE: u8 = 10;
pub const DEV3_SHARE: u8 = 5;
pub const MARKETER_SHARE: u8 = 3;
pub const REFERRAL_POOL_SHARE: u8 = 10;

// Referral level percentages (out of 100% of referral pool)
pub const REFERRAL_L1_SHARE: u8 = 40;
pub const REFERRAL_L2_SHARE: u8 = 25;
pub const REFERRAL_L3_SHARE: u8 = 15;
pub const REFERRAL_L4_SHARE: u8 = 12;
pub const REFERRAL_L5_SHARE: u8 = 8;

// Welcome bonus amounts (in USDC, scaled by 1e6)
pub const WELCOME_BONUS_TOTAL: u64 = 5_000_000; // 5 USDC
pub const WELCOME_BONUS_USER: u64 = 3_500_000; // 3.5 USDC
pub const WELCOME_BONUS_DEV: u64 = 500_000; // 0.5 USDC each

// USDC decimals
pub const USDC_DECIMALS: u8 = 6;

// Maximum referral levels
pub const MAX_REFERRAL_LEVELS: usize = 5;
