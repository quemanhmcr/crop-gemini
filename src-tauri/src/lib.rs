use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use serde::{Deserialize, Serialize};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_store::StoreExt;

#[cfg(windows)]
use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW};

// Default AI URL
const DEFAULT_AI_URL: &str = "https://gemini.google.com/app";

// Settings structure matching frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ShortcutConfig {
    modifiers: Vec<String>,
    key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppSettings {
    #[serde(rename = "aiUrl")]
    ai_url: Option<String>,
    shortcut: Option<ShortcutConfig>,
    #[serde(rename = "autoUpdate")]
    auto_update: Option<bool>,
}

/// Get the title of the currently focused window
#[cfg(windows)]
fn get_foreground_window_title() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }

        let mut title: [u16; 512] = [0; 512];
        let len = GetWindowTextW(hwnd, title.as_mut_ptr(), title.len() as i32);

        if len > 0 {
            Some(String::from_utf16_lossy(&title[..len as usize]))
        } else {
            None
        }
    }
}

/// Check if window title indicates an AI chat is ready
fn is_ai_window(title: &str, ai_url: &str) -> bool {
    let title_lower = title.to_lowercase();

    // Match based on the AI service URL
    if ai_url.contains("gemini.google.com") {
        title_lower.contains("gemini") || title_lower.contains("google ai")
    } else if ai_url.contains("chatgpt.com") {
        title_lower.contains("chatgpt")
    } else if ai_url.contains("claude.ai") {
        title_lower.contains("claude")
    } else if ai_url.contains("grok.com") {
        title_lower.contains("grok")
    } else if ai_url.contains("deepseek.com") {
        title_lower.contains("deepseek")
    } else if ai_url.contains("aistudio.google.com") {
        // AI Studio shows titles like "Prompt Design - Google AI Studio" or just "Google AI Studio"
        title_lower.contains("ai studio") 
            || title_lower.contains("aistudio") 
            || title_lower.contains("makersuite")
            || (title_lower.contains("prompt") && title_lower.contains("google"))
    } else {
        // For custom URLs, just wait for timeout
        false
    }
}

/// Wait for AI window to be in focus, then paste
fn wait_and_paste(ai_url: String) {
    thread::spawn(move || {
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(10);
        let poll_interval = Duration::from_millis(150);

        // Initial wait for browser to start
        thread::sleep(Duration::from_millis(800));

        let mut ai_detected = false;

        loop {
            if start.elapsed() > timeout {
                do_paste();
                break;
            }

            #[cfg(windows)]
            if let Some(title) = get_foreground_window_title() {
                if is_ai_window(&title, &ai_url) {
                if !ai_detected {
                        ai_detected = true;
                        // AI Studio loads slower, give it more time
                        let wait_time = if ai_url.contains("aistudio.google.com") {
                            Duration::from_millis(1500)
                        } else {
                            Duration::from_millis(500)
                        };
                        thread::sleep(wait_time);
                    }

                    if let Some(title2) = get_foreground_window_title() {
                        if is_ai_window(&title2, &ai_url) {
                            do_paste();
                            break;
                        }
                    }
                }
            }

            thread::sleep(poll_interval);
        }
    });
}

/// Simulate Ctrl+V to paste from clipboard
fn do_paste() {
    if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
        thread::sleep(Duration::from_millis(100));
        let _ = enigo.key(Key::Control, Direction::Press);
        thread::sleep(Duration::from_millis(50));
        let _ = enigo.key(Key::Unicode('v'), Direction::Click);
        thread::sleep(Duration::from_millis(50));
        let _ = enigo.key(Key::Control, Direction::Release);
    }
}

/// Read settings from store
fn get_settings(app: &AppHandle) -> AppSettings {
    if let Ok(store) = app.store("settings.json") {
        if let Some(value) = store.get("settings") {
            if let Ok(settings) = serde_json::from_value::<AppSettings>(value.clone()) {
                return settings;
            }
        }
    }
    
    // Return defaults
    AppSettings {
        ai_url: Some(DEFAULT_AI_URL.to_string()),
        shortcut: Some(ShortcutConfig {
            modifiers: vec!["Control".to_string(), "Shift".to_string()],
            key: "Q".to_string(),
        }),
        auto_update: Some(true),
    }
}

/// Convert string key to Code
fn string_to_code(key: &str) -> Option<Code> {
    match key.to_uppercase().as_str() {
        "A" => Some(Code::KeyA),
        "B" => Some(Code::KeyB),
        "C" => Some(Code::KeyC),
        "D" => Some(Code::KeyD),
        "E" => Some(Code::KeyE),
        "F" => Some(Code::KeyF),
        "G" => Some(Code::KeyG),
        "H" => Some(Code::KeyH),
        "I" => Some(Code::KeyI),
        "J" => Some(Code::KeyJ),
        "K" => Some(Code::KeyK),
        "L" => Some(Code::KeyL),
        "M" => Some(Code::KeyM),
        "N" => Some(Code::KeyN),
        "O" => Some(Code::KeyO),
        "P" => Some(Code::KeyP),
        "Q" => Some(Code::KeyQ),
        "R" => Some(Code::KeyR),
        "S" => Some(Code::KeyS),
        "T" => Some(Code::KeyT),
        "U" => Some(Code::KeyU),
        "V" => Some(Code::KeyV),
        "W" => Some(Code::KeyW),
        "X" => Some(Code::KeyX),
        "Y" => Some(Code::KeyY),
        "Z" => Some(Code::KeyZ),
        "1" => Some(Code::Digit1),
        "2" => Some(Code::Digit2),
        "3" => Some(Code::Digit3),
        "4" => Some(Code::Digit4),
        "5" => Some(Code::Digit5),
        "6" => Some(Code::Digit6),
        "7" => Some(Code::Digit7),
        "8" => Some(Code::Digit8),
        "9" => Some(Code::Digit9),
        "0" => Some(Code::Digit0),
        "F1" => Some(Code::F1),
        "F2" => Some(Code::F2),
        "F3" => Some(Code::F3),
        "F4" => Some(Code::F4),
        "F5" => Some(Code::F5),
        "F6" => Some(Code::F6),
        "F7" => Some(Code::F7),
        "F8" => Some(Code::F8),
        "F9" => Some(Code::F9),
        "F10" => Some(Code::F10),
        "F11" => Some(Code::F11),
        "F12" => Some(Code::F12),
        "SPACE" => Some(Code::Space),
        _ => None,
    }
}

/// Convert string modifiers to Modifiers
fn strings_to_modifiers(mods: &[String]) -> Option<Modifiers> {
    let mut result = Modifiers::empty();
    for m in mods {
        match m.as_str() {
            "Control" => result |= Modifiers::CONTROL,
            "Shift" => result |= Modifiers::SHIFT,
            "Alt" => result |= Modifiers::ALT,
            "Meta" | "Super" => result |= Modifiers::META,
            _ => {}
        }
    }
    if result.is_empty() {
        None
    } else {
        Some(result)
    }
}

/// Build shortcut from settings
fn build_shortcut_from_settings(settings: &AppSettings) -> Option<Shortcut> {
    if let Some(ref shortcut_config) = settings.shortcut {
        let code = string_to_code(&shortcut_config.key)?;
        let modifiers = strings_to_modifiers(&shortcut_config.modifiers);
        Some(Shortcut::new(modifiers, code))
    } else {
        // Default: Ctrl+Shift+Q
        Some(Shortcut::new(
            Some(Modifiers::CONTROL | Modifiers::SHIFT),
            Code::KeyQ,
        ))
    }
}

#[tauri::command]
fn capture_region(
    app: AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale_factor: f64,
) -> Result<String, String> {
    // Get AI URL from settings
    let settings = get_settings(&app);
    let ai_url = settings.ai_url.unwrap_or_else(|| DEFAULT_AI_URL.to_string());

    // Capture primary monitor
    let monitors = xcap::Monitor::all().map_err(|e| format!("Monitor error: {}", e))?;
    let monitor = monitors.first().ok_or("No monitor found")?;
    let screenshot = monitor
        .capture_image()
        .map_err(|e| format!("Capture error: {}", e))?;

    // Crop to selected region with bounds checking
    let img_width = screenshot.width();
    let img_height = screenshot.height();

    let x = ((x as f64 * scale_factor).round() as u32).min(img_width.saturating_sub(1));
    let y = ((y as f64 * scale_factor).round() as u32).min(img_height.saturating_sub(1));
    let width = ((width as f64 * scale_factor).round() as u32).min(img_width.saturating_sub(x));
    let height = ((height as f64 * scale_factor).round() as u32).min(img_height.saturating_sub(y));

    if width == 0 || height == 0 {
        return Err("Invalid selection region".to_string());
    }

    let cropped = image::imageops::crop_imm(&screenshot, x, y, width, height).to_image();

    // Copy to clipboard
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;
    let img_data = arboard::ImageData {
        width: cropped.width() as usize,
        height: cropped.height() as usize,
        bytes: std::borrow::Cow::Owned(cropped.into_raw()),
    };
    clipboard
        .set_image(img_data)
        .map_err(|e| format!("Clipboard set error: {}", e))?;

    // Open the configured AI URL
    let _ = tauri_plugin_opener::open_url(&ai_url, None::<&str>);

    // Smart wait and paste when AI window is focused
    wait_and_paste(ai_url);

    Ok("Screenshot captured!".to_string())
}

#[tauri::command]
fn reload_shortcut(app: AppHandle) -> Result<String, String> {
    let settings = get_settings(&app);

    // Build new shortcut from settings
    let new_shortcut = build_shortcut_from_settings(&settings)
        .ok_or_else(|| "Invalid shortcut configuration".to_string())?;

    // Unregister all shortcuts and register the new one
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| format!("Failed to unregister shortcuts: {}", e))?;

    app.global_shortcut()
        .on_shortcut(new_shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;

    Ok("Shortcut reloaded successfully".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Load settings and register shortcut
            let settings = get_settings(&app.handle());
            let shortcut = build_shortcut_from_settings(&settings).unwrap_or_else(|| {
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyQ)
            });

            app.global_shortcut()
                .on_shortcut(shortcut, |app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })?;

            // Hide window on startup
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![capture_region, reload_shortcut])
        .run(tauri::generate_context!())
        .expect("Error running CropGemini");
}
