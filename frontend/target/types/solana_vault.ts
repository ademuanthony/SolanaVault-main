/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solana_vault.json`.
 */
export type SolanaVault = {
  "address": "G9hoVfjm6QHGMQZpHpVsUGQmSBD6LQaXk9UbD5BzqtWR",
  "metadata": {
    "name": "solanaVault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptAdmin",
      "docs": [
        "Accept admin role (second step). Must be signed by the pending admin."
      ],
      "discriminator": [
        112,
        42,
        45,
        90,
        116,
        181,
        13,
        170
      ],
      "accounts": [
        {
          "name": "newAdmin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "adminRegisterUser",
      "docs": [
        "Admin register a user (admin only)"
      ],
      "discriminator": [
        138,
        120,
        187,
        120,
        156,
        216,
        162,
        48
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "userWallet"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "userWallet",
          "type": "pubkey"
        },
        {
          "name": "referrer",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "claimDlmmFees",
      "docs": [
        "Claim trading fees from a DLMM position. Pure CPI forwarder — TVL",
        "must be reconciled afterwards via `update_tvl`."
      ],
      "discriminator": [
        102,
        188,
        67,
        120,
        236,
        199,
        117,
        122
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "dlmmPosition",
          "writable": true
        },
        {
          "name": "dlmmProgram"
        }
      ],
      "args": [
        {
          "name": "cpiData",
          "type": {
            "defined": {
              "name": "dlmmCpiData"
            }
          }
        }
      ]
    },
    {
      "name": "claimReferralEarnings",
      "docs": [
        "Claim accumulated referral earnings"
      ],
      "discriminator": [
        162,
        50,
        120,
        14,
        177,
        183,
        159,
        153
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userUsdcAccount",
          "writable": true
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "closeDlmmPosition",
      "docs": [
        "Close a DLMM position and remove liquidity via Meteora (CPI)"
      ],
      "discriminator": [
        171,
        247,
        237,
        247,
        208,
        250,
        30,
        228
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "dlmmPosition",
          "writable": true
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vaultUsdcAccount",
          "docs": [
            "Vault USDC PDA — used to measure USDC recovered from the closed",
            "position for logging (TVL still reconciles via `update_tvl`)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "dlmmProgram"
        }
      ],
      "args": [
        {
          "name": "cpiData",
          "type": {
            "defined": {
              "name": "dlmmCpiData"
            }
          }
        }
      ]
    },
    {
      "name": "closeDlmmPositionAccount",
      "docs": [
        "Close a DLMM position account (admin only, must be already closed)"
      ],
      "discriminator": [
        46,
        119,
        109,
        75,
        187,
        225,
        161,
        103
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "dlmmPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  108,
                  109,
                  109,
                  95,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "dlmm_position.position_index",
                "account": "dlmmPosition"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "closePdaTokenAccount",
      "docs": [
        "Close a PDA-owned token account and return rent to admin (must have zero balance)"
      ],
      "discriminator": [
        162,
        108,
        103,
        172,
        242,
        60,
        198,
        243
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenAccount",
          "docs": [
            "The token account owned by globalConfigPda to close.",
            "Must have zero balance."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "closeUserAccount",
      "docs": [
        "Close an empty user account (user or admin)"
      ],
      "discriminator": [
        236,
        181,
        3,
        71,
        194,
        18,
        151,
        191
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user_account.wallet",
                "account": "userAccount"
              }
            ]
          }
        },
        {
          "name": "rentReceiver",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "docs": [
        "Deposit USDC and receive vault shares"
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "userUsdcAccount",
          "writable": true
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "userShareAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "shareMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "distributeAccruedFees",
      "docs": [
        "Permissionless fee sweep: atomically pay out every accrued fee bucket",
        "(company + 3 devs + marketer1) to their configured wallets and zero",
        "the counters. Anyone can sign `payer`; `token::authority` constraints",
        "pin each destination so a caller cannot redirect funds."
      ],
      "discriminator": [
        205,
        241,
        193,
        87,
        26,
        33,
        131,
        94
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Just pays tx fees / compute. No privilege beyond signing."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "companyUsdcAccount",
          "writable": true
        },
        {
          "name": "dev1UsdcAccount",
          "writable": true
        },
        {
          "name": "dev2UsdcAccount",
          "writable": true
        },
        {
          "name": "dev3UsdcAccount",
          "writable": true
        },
        {
          "name": "marketer1UsdcAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "flagUser",
      "docs": [
        "Flag a user account (admin only)"
      ],
      "discriminator": [
        185,
        51,
        188,
        148,
        224,
        56,
        167,
        209
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user_account.wallet",
                "account": "userAccount"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the vault with admin and dev wallets"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "shareMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "initializeParams"
            }
          }
        }
      ]
    },
    {
      "name": "jupiterSwap",
      "docs": [
        "Swap USDC ↔ any token via Jupiter"
      ],
      "discriminator": [
        116,
        207,
        0,
        196,
        252,
        120,
        243,
        18
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "jupiterProgram",
          "docs": [
            "Should match JUPITER_V6_PROGRAM_ID"
          ]
        },
        {
          "name": "sourceTokenAccount",
          "docs": [
            "This should be the token account we're swapping FROM"
          ],
          "writable": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "minimumAmountOut",
          "type": "u64"
        },
        {
          "name": "swapData",
          "type": {
            "defined": {
              "name": "jupiterSwapData"
            }
          }
        }
      ]
    },
    {
      "name": "jupiterSwapV2",
      "docs": [
        "Swap via Jupiter V2 — uses remaining_accounts for CPI metas.",
        "Automatically transfers tokens between vault PDAs and standard ATAs",
        "that Jupiter expects."
      ],
      "discriminator": [
        28,
        155,
        14,
        63,
        87,
        96,
        62,
        221
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "jupiterProgram"
        },
        {
          "name": "sourceTokenAccount",
          "writable": true
        },
        {
          "name": "destinationTokenAccount",
          "writable": true
        },
        {
          "name": "jupiterSourceAta",
          "docs": [
            "The PDA's standard ATA for the input mint (where Jupiter expects source tokens).",
            "Tokens are transferred here from source_token_account before the swap."
          ],
          "writable": true
        },
        {
          "name": "jupiterDestinationAta",
          "docs": [
            "The PDA's standard ATA for the output mint (where Jupiter deposits output tokens).",
            "Tokens are transferred from here to destination_token_account after the swap."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "swapData",
          "type": "bytes"
        },
        {
          "name": "swapAmount",
          "type": "u64"
        },
        {
          "name": "minimumAmountOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "openDlmmPosition",
      "docs": [
        "Open a DLMM position via Meteora (CPI)"
      ],
      "discriminator": [
        37,
        191,
        48,
        198,
        118,
        128,
        208,
        14
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "dlmmPosition",
          "docs": [
            "DLMM position metadata owned by this program. The PDA derivation",
            "is `[\"dlmm_position\", [position_index]]`."
          ],
          "writable": true
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "vaultUsdcAccount",
          "docs": [
            "Vault USDC PDA — used to diff balance pre/post CPI and mark TVL",
            "down by the amount of USDC deployed into the Meteora position."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "dlmmProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "openDlmmPositionParams"
            }
          }
        },
        {
          "name": "cpiData",
          "type": {
            "defined": {
              "name": "dlmmCpiData"
            }
          }
        }
      ]
    },
    {
      "name": "proposeNewAdmin",
      "docs": [
        "Propose a new admin (first step of two-step rotation). `Some(pk)` sets",
        "the pending admin; `None` cancels an in-flight proposal."
      ],
      "discriminator": [
        232,
        189,
        155,
        60,
        4,
        68,
        17,
        188
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "register",
      "docs": [
        "Register a new user with optional referrer"
      ],
      "discriminator": [
        211,
        124,
        67,
        15,
        211,
        194,
        178,
        240
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "referrer",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "setCompanyWallet",
      "docs": [
        "Set company wallet"
      ],
      "discriminator": [
        103,
        25,
        27,
        36,
        174,
        16,
        180,
        55
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setDevWallet",
      "docs": [
        "Set dev wallet (each dev can only set their own)"
      ],
      "discriminator": [
        147,
        221,
        84,
        51,
        123,
        126,
        25,
        186
      ],
      "accounts": [
        {
          "name": "devAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "devIndex",
          "type": "u8"
        },
        {
          "name": "newWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setMarketerWallet",
      "docs": [
        "Set marketer wallet (marketer can only set their own)"
      ],
      "discriminator": [
        78,
        210,
        48,
        92,
        237,
        61,
        236,
        32
      ],
      "accounts": [
        {
          "name": "marketerAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newWallet",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "unflagUser",
      "docs": [
        "Unflag a user account (admin only)"
      ],
      "discriminator": [
        135,
        227,
        114,
        4,
        187,
        101,
        147,
        112
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user_account.wallet",
                "account": "userAccount"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "updateTvl",
      "docs": [
        "Update TVL to reflect actual vault value (admin only, max 20% decrease per call)"
      ],
      "discriminator": [
        126,
        203,
        107,
        162,
        169,
        48,
        79,
        156
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newTvl",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateVaultConfig",
      "docs": [
        "Update global configuration (admin only). Admin rotation is NOT",
        "included here — see `propose_new_admin` / `accept_admin`."
      ],
      "discriminator": [
        122,
        3,
        21,
        222,
        158,
        255,
        238,
        157
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateConfigParams"
            }
          }
        }
      ]
    },
    {
      "name": "welcomeBonusDeposit",
      "docs": [
        "Deposit welcome bonus for a new user"
      ],
      "discriminator": [
        140,
        78,
        62,
        209,
        193,
        181,
        6,
        58
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "user"
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "withdraw",
      "docs": [
        "Withdraw shares, deduct fees, and distribute"
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "userAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "vaultState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "userUsdcAccount",
          "writable": true
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "userShareAccount",
          "writable": true
        },
        {
          "name": "shareMint",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "shares",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawCompanyFees",
      "docs": [
        "Withdraw company fees"
      ],
      "discriminator": [
        155,
        195,
        213,
        213,
        121,
        243,
        176,
        127
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "companyUsdcAccount",
          "writable": true
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawDevFees",
      "docs": [
        "Withdraw dev fees"
      ],
      "discriminator": [
        120,
        194,
        245,
        142,
        246,
        177,
        195,
        9
      ],
      "accounts": [
        {
          "name": "devAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "devUsdcAccount",
          "writable": true
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "devIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawMarketerFees",
      "docs": [
        "Withdraw marketer fees"
      ],
      "discriminator": [
        33,
        185,
        74,
        247,
        128,
        4,
        33,
        63
      ],
      "accounts": [
        {
          "name": "marketerAuthority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "marketerUsdcAccount",
          "writable": true
        },
        {
          "name": "vaultUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  117,
                  115,
                  100,
                  99
                ]
              },
              {
                "kind": "account",
                "path": "globalConfig"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "dlmmPosition",
      "discriminator": [
        21,
        99,
        160,
        10,
        119,
        253,
        141,
        87
      ]
    },
    {
      "name": "globalConfig",
      "discriminator": [
        149,
        8,
        156,
        202,
        160,
        252,
        176,
        217
      ]
    },
    {
      "name": "userAccount",
      "discriminator": [
        211,
        33,
        136,
        16,
        186,
        110,
        242,
        127
      ]
    },
    {
      "name": "vaultState",
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorizedAdmin",
      "msg": "Unauthorized: Only admin can perform this action"
    },
    {
      "code": 6001,
      "name": "unauthorizedDev",
      "msg": "Unauthorized: Only dev can perform this action"
    },
    {
      "code": 6002,
      "name": "invalidDevIndex",
      "msg": "Invalid dev index"
    },
    {
      "code": 6003,
      "name": "invalidDevWalletUpdate",
      "msg": "Dev can only update their own wallet"
    },
    {
      "code": 6004,
      "name": "insufficientFunds",
      "msg": "Insufficient funds"
    },
    {
      "code": 6005,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6006,
      "name": "invalidReferralChain",
      "msg": "Invalid referral chain"
    },
    {
      "code": 6007,
      "name": "userAccountNotFound",
      "msg": "User account not found"
    },
    {
      "code": 6008,
      "name": "vaultNotInitialized",
      "msg": "Vault not initialized"
    },
    {
      "code": 6009,
      "name": "invalidShareAmount",
      "msg": "Invalid share amount"
    },
    {
      "code": 6010,
      "name": "invalidDepositAmount",
      "msg": "Invalid deposit amount"
    },
    {
      "code": 6011,
      "name": "userAlreadyRegistered",
      "msg": "User already registered"
    },
    {
      "code": 6012,
      "name": "cannotReferSelf",
      "msg": "Cannot refer yourself"
    },
    {
      "code": 6013,
      "name": "referrerNotFound",
      "msg": "Referrer not found"
    },
    {
      "code": 6014,
      "name": "invalidRemainingAccounts",
      "msg": "Invalid remaining accounts passed"
    },
    {
      "code": 6015,
      "name": "invalidOperation",
      "msg": "Invalid operation"
    },
    {
      "code": 6016,
      "name": "userFlagged",
      "msg": "User account is flagged and cannot perform this operation"
    },
    {
      "code": 6017,
      "name": "invalidFeeDistribution",
      "msg": "Invalid fee distribution: total must be 100%"
    },
    {
      "code": 6018,
      "name": "invalidReferralDistribution",
      "msg": "Invalid referral distribution: total must be 100%"
    },
    {
      "code": 6019,
      "name": "tokenAccountNotEmpty",
      "msg": "Token account must have zero balance before closing"
    },
    {
      "code": 6020,
      "name": "tvlDecreaseTooLarge",
      "msg": "TVL decrease exceeds maximum allowed per update (20%)"
    },
    {
      "code": 6021,
      "name": "tvlIncreaseTooLarge",
      "msg": "TVL increase exceeds maximum allowed per update (50%)"
    },
    {
      "code": 6022,
      "name": "vaultPaused",
      "msg": "Vault is paused"
    },
    {
      "code": 6023,
      "name": "noPendingAdmin",
      "msg": "No pending admin to accept"
    },
    {
      "code": 6024,
      "name": "notPendingAdmin",
      "msg": "Signer does not match the pending admin"
    },
    {
      "code": 6025,
      "name": "exceedsMaxTvl",
      "msg": "Deposit would exceed global max TVL"
    },
    {
      "code": 6026,
      "name": "exceedsMaxUserShares",
      "msg": "Deposit would exceed per-user share cap"
    },
    {
      "code": 6027,
      "name": "slippageExceeded",
      "msg": "Slippage: output less than minimum_amount_out"
    },
    {
      "code": 6028,
      "name": "nothingToDistribute",
      "msg": "Nothing to distribute: all fee buckets are zero"
    },
    {
      "code": 6029,
      "name": "belowMinDistribution",
      "msg": "Total accrued fees are below the configured minimum distribution amount"
    }
  ],
  "types": [
    {
      "name": "dlmmAccountMeta",
      "docs": [
        "Compact representation of DLMM AccountMeta for CPI."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "pubkey"
          },
          {
            "name": "isSigner",
            "type": "bool"
          },
          {
            "name": "isWritable",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "dlmmCpiData",
      "docs": [
        "Full DLMM CPI payload (accounts + raw instruction data).",
        "",
        "Built off-chain using Meteora's DLMM SDK and passed in so we can",
        "forward the CPI on-chain."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "accounts",
            "type": {
              "vec": {
                "defined": {
                  "name": "dlmmAccountMeta"
                }
              }
            }
          },
          {
            "name": "data",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "dlmmMode",
      "docs": [
        "DLMM position mode"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "spot"
          },
          {
            "name": "bidAsk"
          },
          {
            "name": "curve"
          }
        ]
      }
    },
    {
      "name": "dlmmPosition",
      "docs": [
        "DLMM Position Account - tracks a single DLMM position"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "positionIndex",
            "type": "u8"
          },
          {
            "name": "dlmmPool",
            "type": "pubkey"
          },
          {
            "name": "positionNft",
            "type": "pubkey"
          },
          {
            "name": "binArrayLower",
            "type": "pubkey"
          },
          {
            "name": "binArrayUpper",
            "type": "pubkey"
          },
          {
            "name": "mode",
            "type": {
              "defined": {
                "name": "dlmmMode"
              }
            }
          },
          {
            "name": "binIdLower",
            "type": "i32"
          },
          {
            "name": "binIdUpper",
            "type": "i32"
          },
          {
            "name": "tokenXAmount",
            "type": "u64"
          },
          {
            "name": "tokenYAmount",
            "type": "u64"
          },
          {
            "name": "ratio",
            "type": "u8"
          },
          {
            "name": "oneSided",
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "globalConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "companyWallet",
            "type": "pubkey"
          },
          {
            "name": "dev1Wallet",
            "type": "pubkey"
          },
          {
            "name": "dev1Authority",
            "type": "pubkey"
          },
          {
            "name": "dev2Wallet",
            "type": "pubkey"
          },
          {
            "name": "dev2Authority",
            "type": "pubkey"
          },
          {
            "name": "dev3Wallet",
            "type": "pubkey"
          },
          {
            "name": "dev3Authority",
            "type": "pubkey"
          },
          {
            "name": "marketer1Wallet",
            "type": "pubkey"
          },
          {
            "name": "marketer1Authority",
            "type": "pubkey"
          },
          {
            "name": "companyFees",
            "type": "u64"
          },
          {
            "name": "dev1Fees",
            "type": "u64"
          },
          {
            "name": "dev2Fees",
            "type": "u64"
          },
          {
            "name": "dev3Fees",
            "type": "u64"
          },
          {
            "name": "marketer1Fees",
            "type": "u64"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "vaultUsdcAccount",
            "type": "pubkey"
          },
          {
            "name": "shareMint",
            "type": "pubkey"
          },
          {
            "name": "tier1Threshold",
            "type": "u64"
          },
          {
            "name": "tier2Threshold",
            "type": "u64"
          },
          {
            "name": "tier1Fee",
            "type": "u8"
          },
          {
            "name": "tier2Fee",
            "type": "u8"
          },
          {
            "name": "tier3Fee",
            "type": "u8"
          },
          {
            "name": "companyShare",
            "type": "u8"
          },
          {
            "name": "dev1Share",
            "type": "u8"
          },
          {
            "name": "dev2Share",
            "type": "u8"
          },
          {
            "name": "dev3Share",
            "type": "u8"
          },
          {
            "name": "marketer1Share",
            "type": "u8"
          },
          {
            "name": "referralPoolShare",
            "type": "u8"
          },
          {
            "name": "referralL1Share",
            "type": "u8"
          },
          {
            "name": "referralL2Share",
            "type": "u8"
          },
          {
            "name": "referralL3Share",
            "type": "u8"
          },
          {
            "name": "referralL4Share",
            "type": "u8"
          },
          {
            "name": "referralL5Share",
            "type": "u8"
          },
          {
            "name": "welcomeBonusUser",
            "type": "u64"
          },
          {
            "name": "welcomeBonusDev",
            "type": "u64"
          },
          {
            "name": "paused",
            "docs": [
              "Emergency pause flag — gates deposit / withdraw / claim_referral_earnings."
            ],
            "type": "bool"
          },
          {
            "name": "pendingAdmin",
            "docs": [
              "Two-step admin rotation: proposed next admin. Cleared on accept."
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "maxTvl",
            "docs": [
              "Soft cap on global TVL (0 = disabled). Deposit reverts if exceeded."
            ],
            "type": "u64"
          },
          {
            "name": "maxUserShares",
            "docs": [
              "Soft cap on per-user shares (0 = disabled). Deposit reverts if exceeded."
            ],
            "type": "u64"
          },
          {
            "name": "minDistributionAmount",
            "docs": [
              "Total accrued-fees threshold below which `distribute_accrued_fees`",
              "reverts (anti-dust for the permissionless sweep). 0 = disabled."
            ],
            "type": "u64"
          },
          {
            "name": "lastDistributionAt",
            "docs": [
              "Unix timestamp of the most recent successful `distribute_accrued_fees`.",
              "0 if never. Surface for off-chain monitoring / staleness alerts."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "initializeParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "companyWallet",
            "type": "pubkey"
          },
          {
            "name": "dev1Wallet",
            "type": "pubkey"
          },
          {
            "name": "dev1Authority",
            "type": "pubkey"
          },
          {
            "name": "dev2Wallet",
            "type": "pubkey"
          },
          {
            "name": "dev2Authority",
            "type": "pubkey"
          },
          {
            "name": "dev3Wallet",
            "type": "pubkey"
          },
          {
            "name": "dev3Authority",
            "type": "pubkey"
          },
          {
            "name": "marketer1Wallet",
            "type": "pubkey"
          },
          {
            "name": "marketer1Authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "jupiterSwapData",
      "docs": [
        "Full Jupiter swap payload (accounts + raw instruction data).",
        "",
        "The client is responsible for:",
        "- Calling Jupiter's quote + swap-instructions APIs",
        "- Converting the returned `Instruction` accounts + data into this struct",
        "- Ensuring that all `pubkey`s here correspond to the accounts passed to",
        "this instruction (explicit accounts + `remaining_accounts`)"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "accounts",
            "type": {
              "vec": {
                "defined": {
                  "name": "swapAccountMeta"
                }
              }
            }
          },
          {
            "name": "data",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "openDlmmPositionParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "positionIndex",
            "type": "u8"
          },
          {
            "name": "dlmmPool",
            "type": "pubkey"
          },
          {
            "name": "positionNft",
            "type": "pubkey"
          },
          {
            "name": "binArrayLower",
            "type": "pubkey"
          },
          {
            "name": "binArrayUpper",
            "type": "pubkey"
          },
          {
            "name": "mode",
            "type": {
              "defined": {
                "name": "dlmmMode"
              }
            }
          },
          {
            "name": "binIdLower",
            "type": "i32"
          },
          {
            "name": "binIdUpper",
            "type": "i32"
          },
          {
            "name": "tokenXAmount",
            "type": "u64"
          },
          {
            "name": "tokenYAmount",
            "type": "u64"
          },
          {
            "name": "ratio",
            "type": "u8"
          },
          {
            "name": "oneSided",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "swapAccountMeta",
      "docs": [
        "Compact representation of Jupiter's required AccountMeta for CPI.",
        "",
        "This is constructed off-chain from Jupiter's `/swap-instructions` response",
        "and passed into the program so we can rebuild the exact `Instruction`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "pubkey"
          },
          {
            "name": "isSigner",
            "type": "bool"
          },
          {
            "name": "isWritable",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "updateConfigParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tier1Threshold",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "tier2Threshold",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "tier1Fee",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "tier2Fee",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "tier3Fee",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "companyShare",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "dev1Share",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "dev2Share",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "dev3Share",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "marketer1Share",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "referralPoolShare",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "referralL1Share",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "referralL2Share",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "referralL3Share",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "referralL4Share",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "referralL5Share",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "welcomeBonusUser",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "welcomeBonusDev",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "paused",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "maxTvl",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "maxUserShares",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "minDistributionAmount",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "userAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "referrer",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "entryPrice",
            "type": "u64"
          },
          {
            "name": "unclaimedReferralEarnings",
            "type": "u64"
          },
          {
            "name": "totalReferralEarnings",
            "type": "u64"
          },
          {
            "name": "isFlagged",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalTvl",
            "type": "u64"
          },
          {
            "name": "totalShares",
            "type": "u64"
          },
          {
            "name": "positionsCount",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
