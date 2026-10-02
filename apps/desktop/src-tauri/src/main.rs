#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod bundled_runtime;
mod companion;
mod preferences;
mod session;
use duby_broker::{Broker, Request};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    os::unix::{fs::PermissionsExt, net::UnixListener},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;
type Reply = Result<Value, String>;
struct Bridge {
    child: Child,
    input: ChildStdin,
}
struct AppState {
    broker: Arc<Mutex<Broker>>,
    bridge: Mutex<Option<Bridge>>,
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<Reply>>>>,
    data: PathBuf,
    socket: PathBuf,
    token: String,
    session_connections: Mutex<Vec<gio::DBusConnection>>,
}
fn rpc(app: &tauri::AppHandle, s: &AppState, method: &str, args: Value) -> Reply {
    let mut guard = s.bridge.lock().map_err(|e| e.to_string())?;
    if guard
        .as_mut()
        .and_then(|b| b.child.try_wait().ok().flatten())
        .is_some()
    {
        *guard = None;
    }
    if guard.is_none() {
        let (node, entry) = if cfg!(debug_assertions) {
            (
                PathBuf::from("node"),
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../../../packages/runtime-bridge/index.mjs"),
            )
        } else {
            let resources = app.path().resource_dir().map_err(|e| e.to_string())?;
            let root = bundled_runtime::install(&resources, &s.data)?;
            (
                root.join("bin/node"),
                root.join("packages/runtime-bridge/index.mjs"),
            )
        };
        let mut child = Command::new(node)
            .arg(entry)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Could not start the bundled AI bridge: {e}"))?;
        let input = child.stdin.take().ok_or("Bridge stdin unavailable")?;
        let output = child.stdout.take().ok_or("Bridge output unavailable")?;
        let pending = s.pending.clone();
        let handle = app.clone();
        let broker = s.broker.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(output).lines().map_while(Result::ok) {
                if let Ok(v) = serde_json::from_str::<Value>(&line) {
                    if let Some(id) = v["id"].as_str() {
                        if let Some(tx) = pending.lock().unwrap().remove(id) {
                            let _ = tx.send(if let Some(e) = v["error"].as_str() {
                                Err(e.into())
                            } else {
                                Ok(v["result"].clone())
                            });
                        }
                    } else if v["event"] == "task" {
                        if v["data"]["state"] == "offline" {
                            broker.lock().unwrap().pause_all();
                        }
                        if let (Some(task), Some(status)) =
                            (v["data"]["taskId"].as_str(), v["data"]["state"].as_str())
                        {
                            let _ = broker.lock().unwrap().observe_task(task, status);
                            if status == "paused" {
                                let _ = broker.lock().unwrap().control(task, "paused");
                            }
                            if ["completed", "cancelled", "error"].contains(&status) {
                                let _ = broker.lock().unwrap().control(
                                    task,
                                    if status == "completed" {
                                        "completed"
                                    } else {
                                        "cancelled"
                                    },
                                );
                            }
                        }
                        let _ = handle.emit("duby-event", v["data"].clone());
                    }
                }
            }
            broker.lock().unwrap().pause_all();
            for (_, tx) in pending.lock().unwrap().drain() {
                let _ = tx.send(Err("AI bridge disconnected; no task was replayed".into()));
            }
            let _=handle.emit("duby-event",json!({"state":"offline","summary":"AI bridge disconnected. Check task outcomes before retrying."}));
        });
        *guard = Some(Bridge { child, input });
        let init = json!({"id":"init","method":"init","args":{"data":s.data.join("runtime"),"socket":s.socket,"token":s.token}});
        writeln!(guard.as_mut().unwrap().input, "{init}").map_err(|e| e.to_string())?;
    }
    let id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = mpsc::channel();
    s.pending.lock().unwrap().insert(id.clone(), tx);
    writeln!(
        guard.as_mut().unwrap().input,
        "{}",
        json!({"id":id,"method":method,"args":args})
    )
    .map_err(|e| e.to_string())?;
    drop(guard);
    let result = rx.recv_timeout(Duration::from_secs(100));
    s.pending.lock().unwrap().remove(&id);
    result
        .map_err(|_| "AI runtime timed out; no operation was automatically retried".to_string())?
}
#[tauri::command]
async fn snapshot(app: tauri::AppHandle, state: State<'_, AppState>) -> Reply {
    let s = state.broker.lock().unwrap();
    Ok(
        json!({"grants":s.grants(),"journal":s.journal()?,"memories":s.memories()?,"tasks":s.task_index()?,"autostart":preferences::autostart_enabled(&app.path().config_dir().map_err(|e| e.to_string())?),"capabilities":duby_platform::capabilities()}),
    )
}
#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    preferences::autostart(
        &app.path().config_dir().map_err(|e| e.to_string())?,
        &preferences::launch_executable()?,
        enabled,
    )
}
#[tauri::command]
fn companion_mode(app: tauri::AppHandle, window: tauri::WebviewWindow, mode: String) -> Reply {
    if window.label() != "main" {
        return Err("Open Settings to change companion mode".into());
    }
    companion::set_mode(&app, &mode)
}
#[tauri::command]
fn show_main(app: tauri::AppHandle) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or("Main window unavailable")?;
    main.show().map_err(|e| e.to_string())?;
    main.unminimize().map_err(|e| e.to_string())?;
    main.set_focus().map_err(|e| e.to_string())
}
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
fn grant_duration(seconds: u64) -> Result<&'static str, String> {
    match seconds {
        300 => Ok("five minutes"),
        3600 => Ok("one hour"),
        28800 => Ok("eight hours"),
        _ => Err("Choose a supported access duration".into()),
    }
}
#[tauri::command]
async fn choose_folder(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    write: bool,
    seconds: u64,
) -> Reply {
    let duration = grant_duration(seconds)?;
    let selected = app
        .dialog()
        .file()
        .set_title(format!(
            "Allow Duby to {} in this folder for {duration}",
            if write {
                "read and create files"
            } else {
                "read files"
            }
        ))
        .blocking_pick_folder()
        .ok_or("Folder selection cancelled")?;
    let path = selected.into_path().map_err(|e| e.to_string())?;
    let g = state.broker.lock().unwrap().grant(&path, write, seconds)?;
    Ok(serde_json::to_value(g).unwrap())
}
#[tauri::command]
async fn confirm_folder(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
    write: bool,
    seconds: u64,
) -> Reply {
    let duration = grant_duration(seconds)?;
    if path.len() > 4096 || !std::path::Path::new(&path).is_absolute() {
        return Err("Enter an absolute folder path".into());
    }
    let scope = if write {
        "read files and create new files"
    } else {
        "read files"
    };
    let approved=app.dialog().message(format!("Allow Duby to {scope} in this folder for {duration}?\n\n{path}\n\nExisting files are not overwritten. Access ends when Duby closes and can be revoked from Access & privacy.")).title("Share this folder with Duby?").buttons(tauri_plugin_dialog::MessageDialogButtons::OkCancel).blocking_show();
    if !approved {
        return Err("Folder access was not granted".into());
    }
    let g = state
        .broker
        .lock()
        .unwrap()
        .grant(std::path::Path::new(&path), write, seconds)?;
    Ok(serde_json::to_value(g).unwrap())
}
#[tauri::command]
fn revoke(state: State<AppState>, id: String) {
    state.broker.lock().unwrap().revoke(&id);
}
#[tauri::command]
fn local_files(state: State<AppState>, grant: String) -> Reply {
    let mut b = state.broker.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    b.task(&id, &grant)?;
    let result = b.execute(Request {
        task: id.clone(),
        id: "list".into(),
        tool: "duby_find".into(),
        path: ".".into(),
        content: String::new(),
    });
    let _ = b.control(&id, "completed");
    result
}
#[tauri::command]
fn save_result(state: State<AppState>, grant: String, path: String, content: String) -> Reply {
    let mut b = state.broker.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    b.task(&id, &grant)?;
    let result = b.execute(Request {
        task: id.clone(),
        id: "save".into(),
        tool: "duby_save".into(),
        path,
        content,
    });
    let _ = b.control(&id, "completed");
    result
}
#[tauri::command]
async fn ai_connect(app: tauri::AppHandle, config: Value) -> Reply {
    tauri::async_runtime::spawn_blocking(move || {
        let s = app.state::<AppState>();
        rpc(&app, &s, "connect", config)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn ai_history(app: tauri::AppHandle, task: String) -> Reply {
    tauri::async_runtime::spawn_blocking(move || {
        let s = app.state::<AppState>();
        if !s.broker.lock().unwrap().known_task(&task)? {
            return Err("No Duby conversation with that identity".into());
        }
        rpc(&app, &s, "history", json!({"task":task}))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn ai_preferences(app: tauri::AppHandle) -> Reply {
    tauri::async_runtime::spawn_blocking(move || {
        let s = app.state::<AppState>();
        rpc(&app, &s, "preferences", json!({}))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn session_credential(app: tauri::AppHandle, provider: String) -> Reply {
    if !["openai", "anthropic", "google", "custom"].contains(&provider.as_str()) {
        return Err("Choose a provider that uses a key".into());
    }
    let (tx, rx) = mpsc::channel();
    let handle = app.clone();
    let label = provider.clone();
    app.run_on_main_thread(move || {
        use gtk::prelude::*;
        let parent = handle.get_webview_window("main").and_then(|w| w.gtk_window().ok());
        let dialog = gtk::Dialog::with_buttons(Some("Duby · session credential"), parent.as_ref(), gtk::DialogFlags::MODAL,
            &[("Cancel", gtk::ResponseType::Cancel), ("Use for this session", gtk::ResponseType::Accept)]);
        dialog.set_default_size(440, 170);
        let body = dialog.content_area();
        body.set_spacing(14);
        body.set_margin_start(20); body.set_margin_end(20); body.set_margin_top(20); body.set_margin_bottom(20);
        let description = gtk::Label::new(Some(&format!("{label} API key\nKept in memory until Duby closes or you forget it.\nThis native dialog sends no key to the web interface.")));
        let entry = gtk::Entry::new();
        entry.set_visibility(false);
        entry.set_input_purpose(gtk::InputPurpose::Password);
        entry.set_max_length(8192);
        body.pack_start(&description, false, false, 0);
        body.pack_start(&entry, false, false, 0);
        dialog.show_all();
        entry.grab_focus();
        let accepted = dialog.run() == gtk::ResponseType::Accept;
        let value = if accepted { Some(entry.text().to_string()) } else { None };
        entry.set_text("");
        dialog.close();
        let _ = tx.send(value);
    }).map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let value = rx
            .recv()
            .map_err(|_| "Credential dialog closed")?
            .ok_or("Credential entry cancelled")?;
        let s = app.state::<AppState>();
        rpc(
            &app,
            &s,
            "credential",
            json!({"provider":provider,"value":value}),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn forget_session_credentials(app: tauri::AppHandle) -> Reply {
    tauri::async_runtime::spawn_blocking(move || {
        let s = app.state::<AppState>();
        s.broker.lock().unwrap().pause_all();
        rpc(&app, &s, "forgetCredentials", json!({}))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn ai_task(app: tauri::AppHandle, grant: String, prompt: String) -> Reply {
    if prompt.trim().is_empty() || prompt.len() > 16000 {
        return Err("Enter a task of up to 16,000 characters".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let s = app.state::<AppState>();
        let task = format!("agent:duby:duby:{}", uuid::Uuid::new_v4());
        s.broker.lock().unwrap().task(&task, &grant)?;
        s.broker.lock().unwrap().record_task(&task, &prompt)?;
        let result = rpc(&app, &s, "send", json!({"task":task,"prompt":prompt}));
        if let Ok(value) = &result {
            if let Some(run) = value["runId"].as_str() {
                s.broker.lock().unwrap().bind_run(&task, run)?;
            }
        } else {
            let _ = s.broker.lock().unwrap().observe_task(&task, "error");
            let _ = s.broker.lock().unwrap().control(&task, "cancelled");
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn task_control(app: tauri::AppHandle, task: String, action: String) -> Reply {
    {
        let s = app.state::<AppState>();
        s.broker.lock().unwrap().control(
            &task,
            match action.as_str() {
                "pause" => "paused",
                "resume" => "active",
                "stop" => "cancelled",
                _ => return Err("Invalid action".into()),
            },
        )?;
    }
    if action == "stop" {
        tauri::async_runtime::spawn_blocking(move || {
            let s = app.state::<AppState>();
            rpc(&app, &s, "abort", json!({"task":task}))
        })
        .await
        .map_err(|e| e.to_string())?
    } else {
        Ok(
            json!({"state":action,"note":"Admission of new file operations changed. A model response may still arrive."}),
        )
    }
}
#[tauri::command]
fn remember(state: State<AppState>, id: Option<String>, text: String) -> Result<(), String> {
    state.broker.lock().unwrap().remember(id, text)
}
#[tauri::command]
fn forget(state: State<AppState>, id: String) -> Result<(), String> {
    state.broker.lock().unwrap().forget(&id)
}
#[tauri::command]
fn clear_journal(state: State<AppState>) -> Result<(), String> {
    state.broker.lock().unwrap().clear_journal()
}
fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("credentials") {
        let provider = args.get(2).map(String::as_str).unwrap_or("");
        if !["openai", "anthropic", "google", "custom"].contains(&provider) {
            eprintln!("Usage: duby credentials <openai|anthropic|google|custom>\nUses Secret Service. Enter the API key through secret-tool's terminal prompt.");
            std::process::exit(2);
        }
        let status = Command::new("secret-tool")
            .args([
                "store",
                "--label=Duby AI credential",
                "application",
                "duby",
                "provider",
                provider,
            ])
            .status();
        std::process::exit(if status.map(|s| s.success()).unwrap_or(false) {
            0
        } else {
            1
        });
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(setup)
        .invoke_handler(tauri::generate_handler![
            snapshot,
            set_autostart,
            companion_mode,
            show_main,
            quit_app,
            choose_folder,
            confirm_folder,
            revoke,
            local_files,
            save_result,
            ai_connect,
            ai_history,
            ai_preferences,
            session_credential,
            forget_session_credentials,
            ai_task,
            task_control,
            remember,
            forget,
            clear_journal
        ])
        .build(tauri::generate_context!())
        .expect("Duby could not initialize the desktop")
        .run(shutdown);
}
fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let data = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data)?;
    std::fs::set_permissions(&data, std::fs::Permissions::from_mode(0o700))?;
    let broker = Arc::new(Mutex::new(
        Broker::new(&data.join("duby.sqlite")).map_err(std::io::Error::other)?,
    ));
    // Unix socket paths are limited to 108 bytes on Linux. Keep them independent
    // of a potentially long XDG data path; the fresh parent is private (0700).
    let socket_dir = PathBuf::from("/tmp").join(format!("duby-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&socket_dir)?;
    std::fs::set_permissions(&socket_dir, std::fs::Permissions::from_mode(0o700))?;
    let socket = socket_dir.join("broker.sock");
    let listener = UnixListener::bind(&socket)?;
    std::fs::set_permissions(&socket, std::fs::Permissions::from_mode(0o600))?;
    let token = format!("{}{}", uuid::Uuid::new_v4(), uuid::Uuid::new_v4());
    let key = token.clone();
    let b = broker.clone();
    let handle = app.handle().clone();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { break };
            let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
            let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
            let result = (|| -> Reply {
                use std::io::Read;
                let mut line = String::new();
                BufReader::new(&stream)
                    .take(300000)
                    .read_line(&mut line)
                    .map_err(|e| e.to_string())?;
                let v: Value = serde_json::from_str(&line).map_err(|e| e.to_string())?;
                if v["token"].as_str() != Some(key.as_str()) {
                    return Err("Broker authentication failed".into());
                }
                let req: Request =
                    serde_json::from_value(v["request"].clone()).map_err(|e| e.to_string())?;
                let task = req.task.clone();
                let tool = req.tool.clone();
                let out = b.lock().unwrap().execute(req);
                let _=handle.emit("duby-event",json!({"taskId":task,"state":"working","summary":format!("{}: {}",tool,if out.is_ok(){"succeeded"}else{"denied or failed"})}));
                out
            })();
            let response = match result {
                Ok(v) => json!({"result":v}),
                Err(e) => json!({"error":e}),
            };
            let _ = writeln!(stream, "{response}");
        }
    });
    app.manage(AppState {
        broker,
        bridge: Mutex::new(None),
        pending: Arc::new(Mutex::new(HashMap::new())),
        data,
        socket,
        token,
        session_connections: Mutex::new(Vec::new()),
    });
    *app.state::<AppState>().session_connections.lock().unwrap() = session::watch(app.handle());
    if let Some(main) = app.get_webview_window("main") {
        let handle = app.handle().clone();
        main.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if handle.get_webview_window("companion").is_some() {
                    api.prevent_close();
                    if let Some(panel) = handle.get_webview_window("main") {
                        let _ = panel.hide();
                    }
                }
            }
        });
    }
    Ok(())
}
fn shutdown(app: &tauri::AppHandle, event: tauri::RunEvent) {
    if let tauri::RunEvent::Exit = event {
        let s = app.state::<AppState>();
        if let Some(mut b) = s.bridge.lock().unwrap().take() {
            let _ = writeln!(
                b.input,
                "{}",
                json!({"id":"shutdown","method":"shutdown","args":{}})
            );
            let mut exited = false;
            for _ in 0..60 {
                if b.child.try_wait().ok().flatten().is_some() {
                    exited = true;
                    break;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            if !exited {
                let _ = b.child.kill();
                let _ = b.child.wait();
            }
        }
        let _ = std::fs::remove_file(&s.socket);
        if let Some(dir) = s.socket.parent() {
            let _ = std::fs::remove_dir(dir);
        }
    }
}
