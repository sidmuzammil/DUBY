//! All model file access crosses this boundary. No shell or ambient-path tool exists.
use cap_fs_ext::{DirExt, FollowSymlinks, OpenOptionsFollowExt};
use cap_std::{
    ambient_authority,
    fs::{Dir, OpenOptions},
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::{Component, Path},
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_BYTES: usize = 256 * 1024;
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub task: String,
    pub id: String,
    pub tool: String,
    pub path: String,
    #[serde(default)]
    pub content: String,
}
#[derive(Clone, Serialize)]
pub struct GrantInfo {
    pub id: String,
    pub folder: String,
    pub write: bool,
    pub expires: u64,
}
struct Grant {
    info: GrantInfo,
    dir: Dir,
}
struct Task {
    grant: String,
    state: String,
}
pub struct Broker {
    grants: HashMap<String, Grant>,
    tasks: HashMap<String, Task>,
    db: Connection,
}
impl Broker {
    pub fn new(db: &Path) -> Result<Self, String> {
        let db = Connection::open(db).map_err(err)?;
        let version: u32 = db
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(err)?;
        if version > 2 {
            return Err(
                "This database was created by a newer Duby version; refusing to modify it".into(),
            );
        }
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA user_version=2; CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY,text TEXT NOT NULL,updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS operations(task TEXT,id TEXT,hash TEXT,status TEXT,result TEXT,at INTEGER,PRIMARY KEY(task,id)); UPDATE operations SET status='unknown' WHERE status='running';").map_err(err)?;
        Ok(Self {
            grants: HashMap::new(),
            tasks: HashMap::new(),
            db,
        })
    }
    pub fn grant(&mut self, path: &Path, write: bool, seconds: u64) -> Result<GrantInfo, String> {
        let path = path.canonicalize().map_err(err)?;
        if !path.is_dir()
            || path.parent().is_none()
            || std::env::var_os("HOME")
                .map(|h| path == Path::new(&h))
                .unwrap_or(false)
        {
            return Err(
                "Choose a specific project folder, not the filesystem root or your entire home."
                    .into(),
            );
        }
        let info = GrantInfo {
            id: uuid::Uuid::new_v4().to_string(),
            folder: path.to_string_lossy().into(),
            write,
            expires: now() + seconds.clamp(1, 86400),
        };
        self.grants.insert(
            info.id.clone(),
            Grant {
                info: info.clone(),
                dir: Dir::open_ambient_dir(path, ambient_authority()).map_err(err)?,
            },
        );
        Ok(info)
    }
    pub fn grants(&self) -> Vec<GrantInfo> {
        self.grants
            .values()
            .filter(|g| g.info.expires > now())
            .map(|g| g.info.clone())
            .collect()
    }
    pub fn revoke(&mut self, id: &str) {
        self.grants.remove(id);
    }
    pub fn task(&mut self, id: &str, grant: &str) -> Result<(), String> {
        if self.tasks.contains_key(id) {
            return Err("Task already exists".into());
        }
        if !grant.is_empty() && !self.grants.contains_key(grant) {
            return Err("Folder permission is missing or revoked".into());
        }
        self.tasks.insert(
            id.into(),
            Task {
                grant: grant.into(),
                state: "active".into(),
            },
        );
        Ok(())
    }
    pub fn control(&mut self, id: &str, state: &str) -> Result<(), String> {
        if !["active", "paused", "cancelled", "completed"].contains(&state) {
            return Err("Invalid task state".into());
        }
        let task = self.tasks.get_mut(id).ok_or("Unknown task")?;
        if ["cancelled", "completed"].contains(&task.state.as_str()) {
            return Err("Task is already terminal".into());
        }
        task.state = state.into();
        Ok(())
    }
    pub fn pause_all(&mut self) {
        for task in self.tasks.values_mut() {
            if task.state == "active" {
                task.state = "paused".into();
            }
        }
    }
    pub fn execute(&mut self, req: Request) -> Result<Value, String> {
        if req.id.is_empty() || req.id.len() > 200 || req.content.len() > MAX_BYTES {
            return Err("Operation size limit exceeded".into());
        }
        let task = self
            .tasks
            .get(&req.task)
            .ok_or("Unbound task: no authority")?;
        if task.state != "active" {
            return Err(format!("Task is {}", task.state));
        }
        let grant = self.grants.get(&task.grant).ok_or("Permission revoked")?;
        if grant.info.expires <= now() {
            return Err("Permission expired".into());
        }
        let hash = format!(
            "{:x}",
            Sha256::digest(
                [
                    grant.info.folder.as_bytes(),
                    &serde_json::to_vec(&req).map_err(err)?
                ]
                .concat()
            )
        );
        let existing: Option<(String, String, Option<String>)> = self
            .db
            .query_row(
                "SELECT hash,status,result FROM operations WHERE task=? AND id=?",
                params![req.task, req.id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()
            .map_err(err)?;
        if let Some((h, status, result)) = existing {
            if h != hash {
                return Err("Operation identity reused with different arguments".into());
            }
            return if status == "succeeded" {
                serde_json::from_str(&result.unwrap_or_default()).map_err(err)
            } else {
                Err(format!("Previous operation is {status}; inspect its outcome before retrying with a new identity"))
            };
        }
        validate_path(&req.path, req.tool == "duby_find")?;
        if !["duby_read", "duby_find", "duby_save"].contains(&req.tool.as_str()) {
            return Err("Tool is not allowed".into());
        }
        if req.tool == "duby_save" && !grant.info.write {
            return Err("Write permission required".into());
        }
        self.db
            .execute(
                "INSERT INTO operations VALUES(?,?,?,'running',NULL,?)",
                params![req.task, req.id, hash, now()],
            )
            .map_err(err)?;
        let result = reject_symlinks(&grant.dir, &req.path).and_then(|_| perform(&grant.dir, &req));
        let (status, value) = match &result {
            Ok(v) => ("succeeded", Some(v.to_string())),
            Err(_) => ("failed", None),
        };
        self.db
            .execute(
                "UPDATE operations SET status=?,result=? WHERE task=? AND id=?",
                params![status, value, req.task, req.id],
            )
            .map_err(err)?;
        result
    }
    pub fn journal(&self) -> Result<Value, String> {
        let mut statement = self
            .db
            .prepare("SELECT task,id,status,at FROM operations ORDER BY at DESC LIMIT 100")
            .map_err(err)?;
        let rows=statement.query_map([],|r|Ok(json!({"task":r.get::<_,String>(0)?,"id":r.get::<_,String>(1)?,"status":r.get::<_,String>(2)?,"at":r.get::<_,u64>(3)?}))).map_err(err)?;
        Ok(Value::Array(
            rows.collect::<Result<Vec<_>, _>>().map_err(err)?,
        ))
    }
    pub fn memories(&self) -> Result<Value, String> {
        let mut q = self
            .db
            .prepare("SELECT id,text,updated FROM memories ORDER BY updated DESC")
            .map_err(err)?;
        let rows=q.query_map([],|r|Ok(json!({"id":r.get::<_,String>(0)?,"text":r.get::<_,String>(1)?,"updated":r.get::<_,u64>(2)?}))).map_err(err)?;
        Ok(Value::Array(
            rows.collect::<Result<Vec<_>, _>>().map_err(err)?,
        ))
    }
    pub fn remember(&mut self, id: Option<String>, text: String) -> Result<(), String> {
        if text.trim().is_empty() || text.len() > 5000 {
            return Err("A memory must contain 1–5,000 characters".into());
        }
        let id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        self.db.execute("INSERT INTO memories VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET text=excluded.text,updated=excluded.updated",params![id,text,now()]).map_err(err)?;
        Ok(())
    }
    pub fn forget(&mut self, id: &str) -> Result<(), String> {
        self.db
            .execute("DELETE FROM memories WHERE id=?", params![id])
            .map_err(err)?;
        Ok(())
    }
    pub fn clear_journal(&mut self) -> Result<(), String> {
        if self
            .tasks
            .values()
            .any(|t| t.state == "active" || t.state == "paused")
        {
            return Err("Finish or stop active tasks before deleting the journal".into());
        }
        self.db.execute("DELETE FROM operations", []).map_err(err)?;
        Ok(())
    }
}
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn validate_path(path: &str, allow_root: bool) -> Result<(), String> {
    if allow_root && path == "." {
        return Ok(());
    }
    if path.is_empty() || path.len() > 4096 {
        return Err("Invalid relative path".into());
    }
    for part in Path::new(path).components() {
        match part {
            Component::Normal(p) if !p.to_string_lossy().starts_with('.') => {}
            _ => {
                return Err(
                    "Only visible relative paths inside the granted folder are allowed".into(),
                )
            }
        }
    }
    Ok(())
}
fn open_folder(dir: &Dir, path: &Path) -> Result<Dir, String> {
    let mut current = dir.try_clone().map_err(err)?;
    for part in path.components() {
        match part {
            Component::Normal(name) => current = current.open_dir_nofollow(name).map_err(err)?,
            Component::CurDir => {}
            _ => return Err("Invalid directory component".into()),
        }
    }
    Ok(current)
}
fn reject_symlinks(dir: &Dir, path: &str) -> Result<(), String> {
    let mut part = std::path::PathBuf::new();
    for component in Path::new(path).components() {
        part.push(component);
        match dir.symlink_metadata(&part) {
            Ok(m) if m.is_symlink() => return Err("Symlink paths are not allowed".into()),
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}
fn perform(dir: &Dir, r: &Request) -> Result<Value, String> {
    match r.tool.as_str() {
        "duby_read" => {
            let path = Path::new(&r.path);
            let folder = open_folder(dir, path.parent().unwrap_or(Path::new(".")))?;
            let mut options = OpenOptions::new();
            options.read(true).follow(FollowSymlinks::No);
            let mut file = folder
                .open_with(path.file_name().ok_or("Invalid filename")?, &options)
                .map_err(err)?;
            let meta = file.metadata().map_err(err)?;
            if !meta.is_file() || meta.len() > MAX_BYTES as u64 {
                return Err("Choose a text file smaller than 256 KiB".into());
            }
            let mut bytes = Vec::new();
            Read::by_ref(&mut file)
                .take((MAX_BYTES + 1) as u64)
                .read_to_end(&mut bytes)
                .map_err(err)?;
            if bytes.len() > MAX_BYTES {
                return Err("File grew beyond the size limit".into());
            }
            let text = String::from_utf8(bytes).map_err(|_| "This file is not UTF-8 text")?;
            Ok(json!({"path":r.path,"text":text}))
        }
        "duby_find" => {
            let mut found = vec![];
            let mut budget = 2000;
            find(dir, &r.path, 0, &mut budget, &mut found)?;
            Ok(json!({"files":found,"truncated":budget==0}))
        }
        "duby_save" => {
            // Create-only atomic publish: never overwrite an existing file or follow its symlink.
            let target = Path::new(&r.path);
            let parent = target
                .parent()
                .filter(|p| !p.as_os_str().is_empty())
                .unwrap_or(Path::new("."));
            let folder = open_folder(dir, parent)?;
            let name = target.file_name().ok_or("Invalid name")?;
            let tmp = format!(".duby-{}.tmp", uuid::Uuid::new_v4());
            let mut options = OpenOptions::new();
            options.write(true).create_new(true);
            let mut f = folder.open_with(&tmp, &options).map_err(err)?;
            let result = (|| {
                f.write_all(r.content.as_bytes()).map_err(err)?;
                f.sync_all().map_err(err)?;
                folder.hard_link(&tmp, &folder, name).map_err(err)?;
                Ok(
                    json!({"path":r.path,"bytes":r.content.len(),"sha256":format!("{:x}",Sha256::digest(r.content.as_bytes()))}),
                )
            })();
            let _ = folder.remove_file(tmp);
            result
        }
        _ => Err("Tool denied".into()),
    }
}
fn find(
    dir: &Dir,
    path: &str,
    depth: usize,
    budget: &mut usize,
    out: &mut Vec<String>,
) -> Result<(), String> {
    if depth > 8 || *budget == 0 {
        return Ok(());
    }
    let directory = open_folder(dir, Path::new(path))?;
    for entry in directory.entries().map_err(err)? {
        if *budget == 0 {
            break;
        }
        *budget -= 1;
        let entry = entry.map_err(err)?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let child = if path == "." {
            name
        } else {
            format!("{path}/{name}")
        };
        let ft = entry.file_type().map_err(err)?;
        if ft.is_symlink() {
            continue;
        }
        if ft.is_file() {
            out.push(child);
        } else if ft.is_dir() {
            find(dir, &child, depth + 1, budget, out)?;
        }
    }
    out.sort();
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    fn setup(write: bool) -> (TempDir, Broker, String) {
        let t = TempDir::new().unwrap();
        let mut b = Broker::new(&t.path().join("journal.sqlite")).unwrap();
        let g = b.grant(t.path(), write, 60).unwrap();
        b.task("task", &g.id).unwrap();
        (t, b, g.id)
    }
    fn req(id: &str, tool: &str, path: &str) -> Request {
        Request {
            task: "task".into(),
            id: id.into(),
            tool: tool.into(),
            path: path.into(),
            content: "original evidence".into(),
        }
    }
    #[test]
    fn saves_reads_and_deduplicates() {
        let (t, mut b, _) = setup(true);
        let r = req("one", "duby_save", "summary.md");
        b.execute(r.clone()).unwrap();
        b.execute(r.clone()).unwrap();
        assert_eq!(
            std::fs::read_to_string(t.path().join("summary.md")).unwrap(),
            "original evidence"
        );
        assert!(b
            .execute(Request {
                content: "changed".into(),
                ..r
            })
            .is_err());
        assert_eq!(
            b.execute(req("two", "duby_read", "summary.md")).unwrap()["text"],
            "original evidence"
        );
    }
    #[test]
    fn denies_scope_and_symlink_escape() {
        let (t, mut b, _) = setup(true);
        let outside = TempDir::new().unwrap();
        std::fs::write(outside.path().join("secret"), "secret").unwrap();
        std::os::unix::fs::symlink(outside.path(), t.path().join("escape")).unwrap();
        for path in ["../secret", "/etc/passwd", "escape/secret", ".ssh/key"] {
            assert!(b.execute(req(path, "duby_read", path)).is_err());
        }
        assert!(b.execute(req("write", "duby_save", "escape/new")).is_err());
        assert!(!outside.path().join("new").exists());
    }
    #[test]
    fn revocation_pause_stop_and_read_only() {
        let (_, mut b, g) = setup(false);
        assert!(b.execute(req("1", "duby_save", "a")).is_err());
        b.control("task", "paused").unwrap();
        assert!(b.execute(req("2", "duby_find", ".")).is_err());
        b.control("task", "active").unwrap();
        b.revoke(&g);
        assert!(b.execute(req("3", "duby_find", ".")).is_err());
        b.control("task", "cancelled").unwrap();
        assert!(b.control("task", "active").is_err());
    }
    #[test]
    fn no_overwrite_no_unknown_authority_or_shell() {
        let (t, mut b, _) = setup(true);
        std::fs::write(t.path().join("a"), "keep").unwrap();
        assert!(b.execute(req("1", "duby_save", "a")).is_err());
        assert!(b.execute(req("2", "exec", "a")).is_err());
        assert!(b
            .execute(Request {
                task: "stolen".into(),
                ..req("3", "duby_read", "a")
            })
            .is_err());
        assert_eq!(std::fs::read_to_string(t.path().join("a")).unwrap(), "keep");
    }
    #[test]
    fn blocks_internal_symlinks_and_admission_after_disconnect() {
        let (t, mut b, _) = setup(true);
        std::fs::create_dir(t.path().join(".private")).unwrap();
        std::fs::write(t.path().join(".private/secret"), "private").unwrap();
        std::os::unix::fs::symlink(".private", t.path().join("visible")).unwrap();
        assert!(b
            .execute(req("read", "duby_read", "visible/secret"))
            .is_err());
        assert!(b
            .execute(req("save", "duby_save", "visible/output"))
            .is_err());
        b.pause_all();
        assert!(b.execute(req("find", "duby_find", ".")).is_err());
    }
    #[test]
    fn chat_without_a_folder_has_no_file_authority() {
        let (_, mut b, _) = setup(false);
        b.task("chat", "").unwrap();
        assert!(b
            .execute(Request {
                task: "chat".into(),
                ..req("read", "duby_find", ".")
            })
            .is_err());
    }
    #[test]
    fn approved_memory_is_editable_exportable_and_deletable() {
        let (_, mut b, _) = setup(false);
        b.remember(Some("preference".into()), "Use short summaries".into())
            .unwrap();
        b.remember(Some("preference".into()), "Use bullet lists".into())
            .unwrap();
        let all = b.memories().unwrap();
        assert_eq!(all.as_array().unwrap().len(), 1);
        assert_eq!(all[0]["text"], "Use bullet lists");
        b.forget("preference").unwrap();
        assert!(b.memories().unwrap().as_array().unwrap().is_empty());
    }
    #[test]
    fn restart_does_not_restore_authority() {
        let (t, mut b, _) = setup(true);
        b.execute(req("1", "duby_save", "a")).unwrap();
        drop(b);
        let mut b = Broker::new(&t.path().join("journal.sqlite")).unwrap();
        assert!(b.execute(req("1", "duby_save", "a")).is_err());
    }
    #[test]
    fn refuses_future_schema_without_mutating_it() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("future.sqlite");
        let db = Connection::open(&path).unwrap();
        db.execute_batch("PRAGMA user_version=99; CREATE TABLE future(value TEXT); INSERT INTO future VALUES('keep');").unwrap();
        assert!(Broker::new(&path).is_err());
        assert_eq!(
            db.query_row("PRAGMA user_version", [], |r| r.get::<_, u32>(0))
                .unwrap(),
            99
        );
        assert_eq!(
            db.query_row("SELECT value FROM future", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "keep"
        );
    }
}
