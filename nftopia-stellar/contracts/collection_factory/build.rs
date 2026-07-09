fn main() {
    // Git commit hash — fallback to "unknown" if git is unavailable
    let git_hash = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string());

    println!("cargo:rustc-env=GIT_COMMIT_HASH={git_hash}");

    // Unix timestamp at build time
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string());

    println!("cargo:rustc-env=BUILD_TIMESTAMP={timestamp}");

    // Rustc version string
    let rustc_version = std::process::Command::new("rustc")
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string());

    println!("cargo:rustc-env=RUSTC_VERSION={rustc_version}");

    // Re-run when git state changes
    println!("cargo:rerun-if-changed=../../../.git/HEAD");
    println!("cargo:rerun-if-changed=../../../.git/refs/heads/");
    // Allow CI to override via environment
    println!("cargo:rerun-if-env-changed=GIT_COMMIT_HASH");
    println!("cargo:rerun-if-env-changed=BUILD_TIMESTAMP");
}
