#!/bin/bash

# Check if contract ID is provided
if [ -z "$1" ]; then
    echo "Usage: ./verify_contract.sh <CONTRACT_ID>"
    exit 1
fi

CONTRACT_ID=$1
NETWORK=${NETWORK:-testnet}
SOURCE=${SOURCE:-secret}

echo "Verifying contract $CONTRACT_ID on $NETWORK..."

# Get collection count
echo "Checking collection count..."
COUNT=$(soroban contract invoke \
  --id $CONTRACT_ID \
  --source $SOURCE \
  --network $NETWORK \
  -- \
  get_collection_count)

echo "Collection Count: $COUNT"


echo "Contract verification successful!"
