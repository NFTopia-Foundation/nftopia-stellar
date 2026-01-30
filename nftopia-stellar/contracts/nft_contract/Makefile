.PHONY: build test clean

build:
	cargo build --release --target wasm32-unknown-unknown
	soroban contract optimize --wasm target/wasm32-unknown-unknown/release/nft_contract.wasm -o target/nft_contract.optimized.wasm

test:
	cargo test

clean:
	cargo clean
