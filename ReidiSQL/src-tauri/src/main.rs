#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use rand::Rng;
use serde::{Deserialize, Serialize};

/// 后端进程信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendInfo {
    pub port: u16,
    pub token: String,
    pub pid: Option<u32>,
}

/// 全局状态：存储 Node.js 子进程
pub struct AppState {
    child: Arc<Mutex<Option<Child>>>,
    info: Arc<Mutex<Option<BackendInfo>>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            child: Arc::new(Mutex::new(None)),
            info: Arc::new(Mutex::new(None)),
        }
    }
}

/// 生成随机安全 Token（32 字节 hex）
fn generate_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// 查找可用端口（尝试绑定 0 端口由 OS 分配）
async fn find_free_port() -> Result<u16, String> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind free port: {}", e))?;
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get local addr: {}", e))?
        .port();
    // 立即释放端口供 Node.js 使用
    drop(listener);
    Ok(port)
}

/// 等待 Node.js 就绪（检测 stdout 中的 READY 信号）
async fn wait_for_ready(child: &mut Child, timeout_ms: u64) -> Result<(), String> {
    use tokio::time::Duration;
    use tokio::io::{AsyncBufReadExt, BufReader};

    let stdout = child.stdout.take().ok_or("No stdout on child")?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();

    let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);

    loop {
        line.clear();
        let read_future = reader.read_line(&mut line);
        
        match tokio::time::timeout_at(deadline, read_future).await {
            Ok(Ok(0)) => return Err("Child process exited before ready".to_string()),
            Ok(Ok(_)) => {
                if line.contains("READY:") {
                    return Ok(());
                }
                // 继续读取下一行
            }
            Ok(Err(e)) => return Err(format!("Read error: {}", e)),
            Err(_) => return Err("Timeout waiting for backend to start".to_string()),
        }
    }
}

#[tauri::command]
async fn start_node_backend(state: tauri::State<'_, AppState>) -> Result<BackendInfo, String> {
    // 检查是否已经启动
    {
        let info = state.info.lock().await;
        if let Some(ref existing) = *info {
            return Ok(existing.clone());
        }
    }

    let port = find_free_port().await?;
    let token = generate_token();

    // 获取 node-backend 目录路径（相对于 src-tauri）
    let manifest_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current dir: {}", e))?;
    let backend_dir = manifest_dir.parent()
        .ok_or("No parent dir")?
        .join("node-backend");

    let mut child = Command::new("npx")
        .args(["tsx", "src/index.ts"])
        .current_dir(&backend_dir)
        .env("REIDISQL_PORT", port.to_string())
        .env("REIDISQL_TOKEN", &token)
        .env("NODE_ENV", "production")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn Node.js: {}", e))?;

    let pid = child.id();

    // 等待 READY 信号（最多 30 秒）
    wait_for_ready(&mut child, 30000).await?;

    let info = BackendInfo { port, token, pid };

    // 存储进程句柄和信息
    {
        let mut child_guard = state.child.lock().await;
        *child_guard = Some(child);
    }
    {
        let mut info_guard = state.info.lock().await;
        *info_guard = Some(info.clone());
    }

    println!("[Tauri] Node.js backend started on port {} (pid: {:?})", port, pid);
    Ok(info)
}

#[tauri::command]
async fn get_backend_info(state: tauri::State<'_, AppState>) -> Result<Option<BackendInfo>, String> {
    let info = state.info.lock().await;
    Ok(info.clone())
}

#[tauri::command]
async fn stop_node_backend(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut child_guard = state.child.lock().await;
    if let Some(mut child) = child_guard.take() {
        child.kill().await.map_err(|e| format!("Failed to kill: {}", e))?;
        println!("[Tauri] Node.js backend stopped");
    }
    let mut info_guard = state.info.lock().await;
    *info_guard = None;
    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to ReidiSQL!", name)
}

fn main() {
    let state = AppState::new();

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            greet,
            start_node_backend,
            get_backend_info,
            stop_node_backend,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
