/// Interface IDs for ERC-165 equivalent interface detection.
/// Callers can use `supports_interface` on the main contract to verify capability.
pub const INTERFACE_NFT: u32 = 0x01;
pub const INTERFACE_ROYALTY: u32 = 0x02;
pub const INTERFACE_METADATA: u32 = 0x03;
pub const INTERFACE_BATCH: u32 = 0x04;
pub const INTERFACE_ACCESS_CONTROL: u32 = 0x05;

pub fn supports_interface(interface_id: u32) -> bool {
    matches!(
        interface_id,
        INTERFACE_NFT
            | INTERFACE_ROYALTY
            | INTERFACE_METADATA
            | INTERFACE_BATCH
            | INTERFACE_ACCESS_CONTROL
    )
}
