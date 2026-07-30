#[allow(deprecated_usage)]
module t3dcd8b3f::t3dcd8b3f {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url;

    struct T3DCD8B3F has drop {}

    fun init(witness: T3DCD8B3F, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<T3DCD8B3F>(
            witness,
            9,
            b"符号",
            b"名称",
            b"名称",
            option::none(),
            ctx,
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }
    public fun mint(cap: &mut TreasuryCap<T3DCD8B3F>, amount: u64, recipient: address, ctx: &mut TxContext) {
        let coin = coin::mint(cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }
}
