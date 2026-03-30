use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub admin: Pubkey,                           // 32
    pub company_wallet: Pubkey,                  // 32
    pub dev1_wallet: Pubkey,                     // 32
    pub dev1_authority: Pubkey,                  // 32
    pub dev2_wallet: Pubkey,                     // 32
    pub dev2_authority: Pubkey,                  // 32
    pub dev3_wallet: Pubkey,                     // 32
    pub dev3_authority: Pubkey,                  // 32
    pub marketer1_wallet: Pubkey,                // 32
    pub marketer1_authority: Pubkey,             // 32
    pub company_fees: u64,                       // 8
    pub dev1_fees: u64,                          // 8
    pub dev2_fees: u64,                          // 8
    pub dev3_fees: u64,                          // 8
    pub marketer1_fees: u64,                     // 8
    pub usdc_mint: Pubkey,                       // 32
    pub vault_usdc_account: Pubkey,              // 32
    pub share_mint: Pubkey,                      // 32
    
    // Dynamic Config
    pub tier1_threshold: u64,                    // 8
    pub tier2_threshold: u64,                    // 8
    pub tier1_fee: u8,                            // 1
    pub tier2_fee: u8,                            // 1
    pub tier3_fee: u8,                            // 1
    pub company_share: u8,                        // 1
    pub dev1_share: u8,                           // 1
    pub dev2_share: u8,                           // 1
    pub dev3_share: u8,                           // 1
    pub marketer1_share: u8,                      // 1
    pub referral_pool_share: u8,                  // 1
    pub referral_l1_share: u8,                    // 1
    pub referral_l2_share: u8,                    // 1
    pub referral_l3_share: u8,                    // 1
    pub referral_l4_share: u8,                    // 1
    pub referral_l5_share: u8,                    // 1
    
    pub welcome_bonus_user: u64,                  // 8
    pub welcome_bonus_dev: u64,                   // 8
    
    pub bump: u8,                                // 1
}

#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    pub wallet: Pubkey,                          // 32
    pub referrer: Option<Pubkey>,                // 1 + 32
    pub shares: u64,                             // 8
    pub entry_price: u64,                        // 8 (share price when user deposited, scaled by 1e9)
    pub unclaimed_referral_earnings: u64,        // 8
    pub total_referral_earnings: u64,            // 8
    pub is_flagged: bool,                        // 1 (admin can flag suspicious accounts)
    pub bump: u8,                                // 1
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub total_tvl: u64,                          // 8 (total USDC value, scaled by 1e6)
    pub total_shares: u64,                       // 8 (total shares minted, scaled by 1e9)
    pub positions_count: u8,                     // 1 (number of active DLMM positions)
    pub bump: u8,                                // 1
}

/// DLMM position mode
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum DlmmMode {
    Spot,     // Spot mode (0)
    BidAsk,   // Bid-Ask mode (1)
    Curve,    // Curve mode (2)
}

/// DLMM Position Account - tracks a single DLMM position
#[account]
#[derive(InitSpace)]
pub struct DlmmPosition {
    pub position_index: u8,                      // 1 (position index, for ordering)
    pub dlmm_pool: Pubkey,                       // 32 (Meteora DLMM pool address)
    pub position_nft: Pubkey,                    // 32 (Meteora position NFT mint)
    pub bin_array_lower: Pubkey,                 // 32 (Bin array lower bound)
    pub bin_array_upper: Pubkey,                // 32 (Bin array upper bound)
    pub mode: DlmmMode,                          // 1 (Spot/BidAsk/Curve mode)
    pub bin_id_lower: i32,                       // 4 (Lower bin ID)
    pub bin_id_upper: i32,                       // 4 (Upper bin ID)
    pub token_x_amount: u64,                     // 8 (Amount of token X in position, scaled)
    pub token_y_amount: u64,                     // 8 (Amount of token Y in position, scaled)
    pub ratio: u8,                               // 1 (Position ratio/weight, 0-100)
    pub one_sided: bool,                         // 1 (Whether position is one-sided liquidity)
    pub created_at: i64,                         // 8 (Timestamp when position was created)
    pub bump: u8,                                // 1
}

impl GlobalConfig {
    pub const SEED: &'static [u8] = b"global_config";
    
    pub fn get_dev_wallet(&self, index: u8) -> Option<Pubkey> {
        match index {
            1 => Some(self.dev1_wallet),
            2 => Some(self.dev2_wallet),
            3 => Some(self.dev3_wallet),
            _ => None,
        }
    }
    
    pub fn get_dev_fees_mut(&mut self, index: u8) -> Option<&mut u64> {
        match index {
            1 => Some(&mut self.dev1_fees),
            2 => Some(&mut self.dev2_fees),
            3 => Some(&mut self.dev3_fees),
            _ => None,
        }
    }
    
    pub fn get_dev_fees(&self, index: u8) -> Option<u64> {
        match index {
            1 => Some(self.dev1_fees),
            2 => Some(self.dev2_fees),
            3 => Some(self.dev3_fees),
            _ => None,
        }
    }
    
    pub fn get_dev_authority(&self, index: u8) -> Option<Pubkey> {
        match index {
            1 => Some(self.dev1_authority),
            2 => Some(self.dev2_authority),
            3 => Some(self.dev3_authority),
            _ => None,
        }
    }
}

impl UserAccount {
    pub const SEED: &'static [u8] = b"user_account";
    
    pub fn get_user_pda(wallet: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[Self::SEED, wallet.as_ref()], program_id)
    }
}

impl VaultState {
    pub const SEED: &'static [u8] = b"vault_state";
    
    /// Calculate share price (scaled by 1e9)
    /// share_price = (total_tvl * 1e9) / total_shares
    pub fn calculate_share_price(&self) -> Result<u64> {
        if self.total_shares == 0 {
            return Ok(1_000_000); // 1.0 scaled by 1e6 (since 1 Share = 1 USDC)
        }
        let tvl_scaled = self.total_tvl.checked_mul(1_000_000_000).ok_or(VaultError::MathOverflow)?;
        tvl_scaled
            .checked_div(self.total_shares)
            .ok_or(VaultError::MathOverflow.into())
    }
    
    /// Calculate USDC value from shares
    pub fn shares_to_usdc(&self, shares: u64) -> Result<u64> {
        let share_price = self.calculate_share_price()?;
        shares
            .checked_mul(share_price)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(1_000_000_000)
            .ok_or(VaultError::MathOverflow.into())
    }
}

impl DlmmPosition {
    pub const SEED: &'static [u8] = b"dlmm_position";
    
    /// Get PDA for a position account
    /// Uses position_index to create unique PDAs for each position
    pub fn get_position_pda(position_index: u8, program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[Self::SEED, &[position_index]], program_id)
    }
    
    /// Check if position is active (has liquidity)
    pub fn is_active(&self) -> bool {
        self.token_x_amount > 0 || self.token_y_amount > 0
    }
    
    /// Get total value of position (token_x + token_y, assuming 1:1 for simplicity)
    /// In production, you'd need to fetch actual token prices
    pub fn get_total_value(&self) -> u64 {
        self.token_x_amount
            .checked_add(self.token_y_amount)
            .unwrap_or(u64::MAX)
    }
}

use crate::errors::VaultError;
