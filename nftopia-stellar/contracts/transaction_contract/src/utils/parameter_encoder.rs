//! Parameter encoder — helpers for packing and unpacking typed values into
//! the raw `Bytes` payload stored in each `Parameter`.

use crate::error::TransactionError;
use crate::types::{ParamType, Parameter};
use soroban_sdk::{Bytes, Env};

/// Encode a u64 into a Parameter.
pub fn encode_u64(env: &Env, value: u64) -> Parameter {
    Parameter {
        param_type: ParamType::Uint64,
        value: Bytes::from_slice(env, &value.to_be_bytes()),
    }
}

/// Decode a u64 from a Parameter.  Returns an error when the byte length is
/// not exactly 8 or the param_type doesn't match.
pub fn decode_u64(param: &Parameter) -> Result<u64, TransactionError> {
    if param.param_type != ParamType::Uint64 {
        return Err(TransactionError::InvalidOperation);
    }
    if param.value.len() != 8 {
        return Err(TransactionError::InvalidOperation);
    }
    let mut buf = [0u8; 8];
    for (i, b) in param.value.iter().enumerate() {
        buf[i] = b;
    }
    Ok(u64::from_be_bytes(buf))
}

/// Encode a bool into a Parameter (1 byte: 0x01 / 0x00).
pub fn encode_bool(env: &Env, value: bool) -> Parameter {
    Parameter {
        param_type: ParamType::Bool,
        value: Bytes::from_slice(env, &[if value { 1u8 } else { 0u8 }]),
    }
}

/// Decode a bool from a Parameter.
pub fn decode_bool(param: &Parameter) -> Result<bool, TransactionError> {
    if param.param_type != ParamType::Bool {
        return Err(TransactionError::InvalidOperation);
    }
    if param.value.len() != 1 {
        return Err(TransactionError::InvalidOperation);
    }
    Ok(param.value.get(0).unwrap_or(0) != 0)
}
