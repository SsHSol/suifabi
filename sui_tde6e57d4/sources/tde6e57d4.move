#[allow(deprecated_usage)]
module tde6e57d4::tde6e57d4 {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url;

    struct MTK has drop {}

    fun init(witness: MTK, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<MTK>(
            witness, 9, b"MTK", b"MyToken", b"MyToken", option::none(), ctx,
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }
    public fun mint(cap: &mut TreasuryCap<MTK>, amount: u64, recipient: address, ctx: &mut TxContext) {
        let coin = coin::mint(cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }
}
