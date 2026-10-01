//! Installs the locally bundled, complete Node package tree. Never downloads code.
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};

pub fn install(resources: &Path, data: &Path) -> Result<PathBuf, String> {
    install_inner(resources, data)
        .map_err(|e| format!("Bundled AI runtime could not be prepared: {e}"))
}

fn install_inner(resources: &Path, data: &Path) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let manifest: serde_json::Value =
        serde_json::from_slice(&fs::read(resources.join("runtime-manifest.json"))?)?;
    let expected = manifest["sha256"]
        .as_str()
        .ok_or("Missing archive checksum")?;
    if expected.len() != 64 || !expected.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid archive checksum".into());
    }
    let archive_path = resources.join("runtime.tar.zst");
    let mut file = fs::File::open(&archive_path)?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    if format!("{:x}", digest.finalize()) != expected {
        return Err("Archive checksum mismatch".into());
    }
    let engines = data.join("engines");
    fs::create_dir_all(&engines)?;
    fs::set_permissions(&engines, fs::Permissions::from_mode(0o700))?;
    let destination = engines.join(expected);
    if destination.join(".complete").is_file() && destination.join("bin/node").is_file() {
        return Ok(destination);
    }
    let staging = engines.join(format!(".staging-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&staging)?;
    fs::set_permissions(&staging, fs::Permissions::from_mode(0o700))?;
    let result = (|| -> Result<(), Box<dyn std::error::Error>> {
        let decoder = zstd::Decoder::new(fs::File::open(archive_path)?)?;
        let mut archive = tar::Archive::new(decoder);
        archive.set_preserve_permissions(false);
        // tar's unpack_in refuses paths and symlink traversals outside this root.
        for entry in archive.entries()? {
            if !entry?.unpack_in(&staging)? {
                return Err("Unsafe runtime archive path".into());
            }
        }
        if !staging.join("bin/node").is_file()
            || !staging.join("packages/runtime-bridge/index.mjs").is_file()
        {
            return Err("Incomplete runtime archive".into());
        }
        fs::write(staging.join(".complete"), expected)?;
        // Only this content-addressed application directory is replaced after an interrupted install.
        if destination.exists() {
            fs::remove_dir_all(&destination)?;
        }
        fs::rename(&staging, &destination)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    result?;
    Ok(destination)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn verifies_extracts_and_reuses_complete_bundled_runtime() {
        let root = std::env::temp_dir().join(format!("duby-archive-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let compressed = zstd::Encoder::new(Vec::new(), 1).unwrap();
        let mut tar = tar::Builder::new(compressed);
        for path in ["bin/node", "packages/runtime-bridge/index.mjs"] {
            let bytes = b"fixture";
            let mut header = tar::Header::new_gnu();
            header.set_size(bytes.len() as u64);
            header.set_mode(0o755);
            header.set_cksum();
            tar.append_data(&mut header, path, &bytes[..]).unwrap();
        }
        let bytes = tar.into_inner().unwrap().finish().unwrap();
        let hash = format!("{:x}", Sha256::digest(&bytes));
        fs::write(root.join("runtime.tar.zst"), &bytes).unwrap();
        fs::write(
            root.join("runtime-manifest.json"),
            serde_json::json!({"sha256": hash}).to_string(),
        )
        .unwrap();
        let target = install(&root, &root.join("state")).unwrap();
        assert_eq!(fs::read(target.join("bin/node")).unwrap(), b"fixture");
        assert_ne!(
            fs::metadata(target.join("bin/node"))
                .unwrap()
                .permissions()
                .mode()
                & 0o111,
            0
        );
        assert_eq!(install(&root, &root.join("state")).unwrap(), target);
        fs::write(root.join("runtime.tar.zst"), b"corrupt").unwrap();
        assert!(install(&root, &root.join("state"))
            .unwrap_err()
            .contains("checksum mismatch"));
        fs::remove_dir_all(root).unwrap();
    }
}
