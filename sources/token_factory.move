/// Sui Token Factory - 一键发币
/// 部署这个合约一次，之后任何人都可以调用它创建代币
module token_factory::token_factory {
    use std::string;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::coin_registry;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url;

    /// 创建新代币
    /// 调用一次就创建一个新代币，TreasuryCap 发给调用者
    public fun create_token(
        decimals: u8,
        symbol: vector<u8>,
        name: vector<u8>,
        description: vector<u8>,
        icon_url: vector<u8>,
        ctx: &mut TxContext,
    ): TreasuryCap<CoinRegistryToken> {
        let url_obj = url::new_unsafe_from_bytes(icon_url);
        let (initializer, cap) = coin_registry::create_currency_with_registry<CoinRegistryToken>(
            string::utf8(symbol),
            string::utf8(name),
            string::utf8(description),
            option::some(url_obj),
            ctx,
        );
        coin_registry::add_currency(initializer, ctx);
        cap
    }

    /// 铸币
    public fun mint_token(
        cap: &mut TreasuryCap<CoinRegistryToken>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ): Coin<CoinRegistryToken> {
        coin::mint(cap, amount, ctx)
    }

    struct CoinRegistryToken has key, store {
        id: sui::object::UID,
    }
}
