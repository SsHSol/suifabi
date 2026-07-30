#[allow(deprecated_usage)]
module t9414f8c8::t9414f8c8 {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url;

    struct t9414f8c8 has drop {}

    fun init(witness: t9414f8c8, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<t9414f8c8>(
            witness,
            9,
            b"LQB",
            b"路桥币",
            b"路桥币",
            option::none(),
            ctx,
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }
    public fun mint(cap: &mut TreasuryCap<t9414f8c8>, amount: u64, recipient: address, ctx: &mut TxContext) {
        let coin = coin::mint(cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }
}
