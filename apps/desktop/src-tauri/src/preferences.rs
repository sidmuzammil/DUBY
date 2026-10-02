use std::{
    fs,
    path::{Path, PathBuf},
};
const MARKER: &str = "# Managed by Duby\n";

/// AppImage mounts disappear at exit; retain the user's portable launcher path.
pub fn launch_executable() -> Result<PathBuf, String> {
    let executable = std::env::current_exe().map_err(|e| e.to_string())?;
    if let (Some(image), Some(directory)) =
        (std::env::var_os("APPIMAGE"), std::env::var_os("APPDIR"))
    {
        let image = PathBuf::from(image);
        let directory = PathBuf::from(directory);
        if image.is_absolute() && image.is_file() && executable.starts_with(directory) {
            return Ok(image);
        }
    }
    Ok(executable)
}

pub fn autostart_enabled(config: &Path) -> bool {
    fs::read_to_string(config.join("autostart/io.github.sidmuzammil.duby.desktop"))
        .map(|s| s.starts_with(MARKER))
        .unwrap_or(false)
}
pub fn autostart(config: &Path, executable: &Path, enabled: bool) -> Result<(), String> {
    let folder = config.join("autostart");
    let file = folder.join("io.github.sidmuzammil.duby.desktop");
    match fs::read_to_string(&file) {
        Ok(content) if !content.starts_with(MARKER) => {
            return Err("An unmanaged autostart entry already exists; it was left unchanged".into())
        }
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(e.to_string()),
        _ => {}
    }
    if !enabled {
        if file.exists() {
            fs::remove_file(file).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    let path = executable.to_str().ok_or("Executable path is not UTF-8")?;
    if !executable.is_absolute() || path.chars().any(char::is_control) {
        return Err("Unsupported executable path".into());
    }
    let escaped = path
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('`', "\\`")
        .replace('$', "\\$")
        .replace('%', "%%")
        // Desktop Entry unescaping happens before Exec argument unquoting.
        // Escape the quoting backslashes for both layers (not shell execution).
        .replace('\\', "\\\\");
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let content = format!("{MARKER}[Desktop Entry]\nType=Application\nName=Duby\nComment=Your desktop companion\nExec=\"{escaped}\"\nIcon=Duby\nTerminal=false\nX-GNOME-Autostart-enabled=true\n");
    let temp = folder.join(format!(".duby-{}.tmp", uuid::Uuid::new_v4()));
    fs::write(&temp, content).map_err(|e| e.to_string())?;
    fs::rename(&temp, &file).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn autostart_preserves_quoted_paths_and_refuses_unmanaged_entries() {
        let folder = std::env::temp_dir().join(format!("duby-autostart-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&folder).unwrap();
        let executable =
            Path::new("/tmp/Duby $HOME `name` \\\"quoted\\\" \\path %desktop.AppImage");
        autostart(&folder, executable, true).unwrap();
        let file = folder.join("autostart/io.github.sidmuzammil.duby.desktop");
        let keyfile = gio::glib::KeyFile::new();
        keyfile
            .load_from_file(&file, gio::glib::KeyFileFlags::NONE)
            .unwrap();
        let command = keyfile.string("Desktop Entry", "Exec").unwrap();
        let arguments = gio::glib::shell_parse_argv(command).unwrap();
        assert_eq!(
            arguments,
            [std::ffi::OsString::from(
                executable.to_str().unwrap().replace('%', "%%")
            )]
        );
        autostart(&folder, executable, false).unwrap();
        fs::write(&file, "[Desktop Entry]\nName=User's entry\n").unwrap();
        assert!(autostart(&folder, executable, true).is_err());
        assert!(autostart(&folder, executable, false).is_err());
        assert!(fs::read_to_string(file).unwrap().contains("User's entry"));
        fs::remove_dir_all(folder).unwrap();
    }
}
