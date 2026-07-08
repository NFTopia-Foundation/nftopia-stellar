use soroban_sdk::{Env, String};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const GIT_COMMIT_HASH: &str = env!("GIT_COMMIT_HASH");
pub const BUILD_TIMESTAMP: &str = env!("BUILD_TIMESTAMP");
pub const RUSTC_VERSION: &str = env!("RUSTC_VERSION");

/// Semver string with short git commit appended: "0.1.0+abc1234"
pub const VERSION_FULL: &str = concat!(env!("CARGO_PKG_VERSION"), "+", env!("GIT_COMMIT_HASH"));

/// Full build metadata: "version=0.1.0;git=abc1234;ts=1700000000;rustc=rustc 1.x.y"
pub const BUILD_METADATA: &str = concat!(
    "version=",
    env!("CARGO_PKG_VERSION"),
    ";git=",
    env!("GIT_COMMIT_HASH"),
    ";ts=",
    env!("BUILD_TIMESTAMP"),
    ";rustc=",
    env!("RUSTC_VERSION")
);

pub fn version(env: &Env) -> String {
    String::from_str(env, VERSION_FULL)
}

pub fn get_version(env: &Env) -> String {
    String::from_str(env, BUILD_METADATA)
}
