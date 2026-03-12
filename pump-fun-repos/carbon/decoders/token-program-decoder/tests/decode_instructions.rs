use carbon_core::deserialize::ArrangeAccounts;
use carbon_core::instruction::InstructionDecoder;
use carbon_token_program_decoder::instructions::{
    initialize_mint::InitializeMint, transfer::Transfer,
    ui_amount_to_amount::UiAmountToAmount, TokenProgramInstruction,
};
use carbon_token_program_decoder::TokenProgramDecoder;

#[test]
fn test_decode_transfer() {
    let ix = carbon_test_utils::read_instruction("tests/fixtures/transfer_ix.json")
        .expect("failed to read transfer fixture");

    let decoder = TokenProgramDecoder;
    let decoded = decoder
        .decode_instruction(&ix)
        .expect("failed to decode transfer instruction");

    match &decoded.data {
        TokenProgramInstruction::Transfer(transfer) => {
            assert_eq!(transfer.amount, 1_000_000);
        }
        other => panic!("expected Transfer, got {:?}", other),
    }
}

#[test]
fn test_transfer_arrange_accounts() {
    let ix = carbon_test_utils::read_instruction("tests/fixtures/transfer_ix.json")
        .expect("failed to read transfer fixture");

    let accounts =
        Transfer::arrange_accounts(&ix.accounts).expect("failed to arrange transfer accounts");

    assert_eq!(accounts.source, ix.accounts[0].pubkey);
    assert_eq!(accounts.destination, ix.accounts[1].pubkey);
    assert_eq!(accounts.authority, ix.accounts[2].pubkey);
    assert!(accounts.remaining_accounts.is_empty());
}

#[test]
fn test_transfer_arrange_accounts_with_multisig() {
    let ix = carbon_test_utils::read_instruction("tests/fixtures/transfer_ix.json")
        .expect("failed to read transfer fixture");

    // Add extra signer accounts to simulate multisig
    let mut accounts = ix.accounts.clone();
    accounts.push(solana_instruction::AccountMeta {
        pubkey: solana_pubkey::Pubkey::new_unique(),
        is_signer: true,
        is_writable: false,
    });
    accounts.push(solana_instruction::AccountMeta {
        pubkey: solana_pubkey::Pubkey::new_unique(),
        is_signer: true,
        is_writable: false,
    });

    let arranged =
        Transfer::arrange_accounts(&accounts).expect("failed to arrange multisig accounts");

    assert_eq!(arranged.remaining_accounts.len(), 2);
    assert_eq!(arranged.remaining_accounts[0].pubkey, accounts[3].pubkey);
    assert_eq!(arranged.remaining_accounts[1].pubkey, accounts[4].pubkey);
}

#[test]
fn test_transfer_arrange_accounts_too_few() {
    // Only 2 accounts (need at least 3: source, destination, authority)
    let accounts = vec![
        solana_instruction::AccountMeta {
            pubkey: solana_pubkey::Pubkey::new_unique(),
            is_signer: false,
            is_writable: true,
        },
        solana_instruction::AccountMeta {
            pubkey: solana_pubkey::Pubkey::new_unique(),
            is_signer: false,
            is_writable: true,
        },
    ];

    assert!(Transfer::arrange_accounts(&accounts).is_none());
}

#[test]
fn test_decode_initialize_mint() {
    let ix = carbon_test_utils::read_instruction("tests/fixtures/initialize_mint_ix.json")
        .expect("failed to read initialize_mint fixture");

    let decoder = TokenProgramDecoder;
    let decoded = decoder
        .decode_instruction(&ix)
        .expect("failed to decode initialize_mint instruction");

    match &decoded.data {
        TokenProgramInstruction::InitializeMint(init) => {
            assert_eq!(init.decimals, 9);
            assert_eq!(init.mint_authority, solana_pubkey::Pubkey::default());
            // COption<Pubkey> with tag=1 (Some) and zero pubkey
            assert_eq!(
                init.freeze_authority,
                Some(solana_pubkey::Pubkey::default())
            );
        }
        other => panic!("expected InitializeMint, got {:?}", other),
    }
}

#[test]
fn test_initialize_mint_arrange_accounts() {
    let ix = carbon_test_utils::read_instruction("tests/fixtures/initialize_mint_ix.json")
        .expect("failed to read initialize_mint fixture");

    let accounts = InitializeMint::arrange_accounts(&ix.accounts)
        .expect("failed to arrange initialize_mint accounts");

    assert_eq!(accounts.mint, ix.accounts[0].pubkey);
    assert_eq!(accounts.rent, ix.accounts[1].pubkey);
}

#[test]
fn test_initialize_mint_arrange_accounts_too_few() {
    let accounts = vec![solana_instruction::AccountMeta {
        pubkey: solana_pubkey::Pubkey::new_unique(),
        is_signer: false,
        is_writable: true,
    }];

    assert!(InitializeMint::arrange_accounts(&accounts).is_none());
}

#[test]
fn test_decode_ui_amount_to_amount() {
    let ix = carbon_test_utils::read_instruction("tests/fixtures/ui_amount_to_amount_ix.json")
        .expect("failed to read ui_amount_to_amount fixture");

    let decoder = TokenProgramDecoder;
    let decoded = decoder
        .decode_instruction(&ix)
        .expect("failed to decode ui_amount_to_amount instruction");

    match &decoded.data {
        TokenProgramInstruction::UiAmountToAmount(ui) => {
            assert_eq!(ui.ui_amount, "100.50");
        }
        other => panic!("expected UiAmountToAmount, got {:?}", other),
    }
}

#[test]
fn test_ui_amount_to_amount_arrange_accounts() {
    let ix = carbon_test_utils::read_instruction("tests/fixtures/ui_amount_to_amount_ix.json")
        .expect("failed to read ui_amount_to_amount fixture");

    let accounts = UiAmountToAmount::arrange_accounts(&ix.accounts)
        .expect("failed to arrange ui_amount_to_amount accounts");

    assert_eq!(accounts.mint, ix.accounts[0].pubkey);
}

#[test]
fn test_ui_amount_to_amount_arrange_accounts_empty() {
    let accounts: Vec<solana_instruction::AccountMeta> = vec![];
    assert!(UiAmountToAmount::arrange_accounts(&accounts).is_none());
}

#[test]
fn test_wrong_program_id_returns_none() {
    let ix = solana_instruction::Instruction {
        program_id: solana_pubkey::Pubkey::new_unique(), // not the token program
        accounts: vec![],
        data: vec![0x03, 0x40, 0x42, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00],
    };

    let decoder = TokenProgramDecoder;
    assert!(decoder.decode_instruction(&ix).is_none());
}
