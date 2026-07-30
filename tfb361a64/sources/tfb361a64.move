#[allow(deprecated_usage)]
module tfb361a64::tfb361a64 {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url;

    struct Tfb361a64 has drop {}

    fun init(witness: Tfb361a64, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<Tfb361a64>(
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
    public fun mint(cap: &mut TreasuryCap<Tfb361a64>, amount: u64, recipient: address, ctx: &mut TxContext) {
        let coin = coin::mint(cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }
}
