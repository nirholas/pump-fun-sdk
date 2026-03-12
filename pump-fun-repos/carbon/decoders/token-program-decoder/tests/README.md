# Token Program Decoder

## Instructions

- Transfer: discriminator `0x03`, amount u64
- InitializeMint: discriminator `0x00`, decimals u8, mint_authority Pubkey, freeze_authority COption<Pubkey>
- UiAmountToAmount: discriminator `0x18`, ui_amount String

## Test Fixtures

- `transfer_ix.json` — Transfer of 1,000,000 lamports
- `initialize_mint_ix.json` — InitializeMint with 9 decimals and freeze authority
- `ui_amount_to_amount_ix.json` — UiAmountToAmount with "100.50"
