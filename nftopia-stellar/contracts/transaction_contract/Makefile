CARGO ?= cargo
CONTRACT_NAME = transaction_contract
WASM_TARGET = wasm32-unknown-unknown
RELEASE_DIR = ../../target/$(WASM_TARGET)/release
WASM_OUT = $(RELEASE_DIR)/$(CONTRACT_NAME).wasm

.PHONY: all build test clean fmt lint optimize

all: build

build:
	$(CARGO) build --target $(WASM_TARGET) --release

test:
	$(CARGO) test

fmt:
	$(CARGO) fmt --all

lint:
	$(CARGO) clippy --target $(WASM_TARGET) --release -- -D warnings

optimize: build
	@command -v wasm-opt >/dev/null 2>&1 || { echo "wasm-opt not found (install binaryen)"; exit 1; }
	wasm-opt -Oz $(WASM_OUT) -o $(WASM_OUT)

clean:
	$(CARGO) clean
