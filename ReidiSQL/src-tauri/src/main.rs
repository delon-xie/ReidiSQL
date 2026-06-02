#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to ReidiSQL!", name)
}

#[tauri::command]
async fn start_node_backend() -> Result<String, String> {
    // TODO: 启动 Node.js 后端进程
    Ok("Node.js backend started".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, start_node_backend])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
