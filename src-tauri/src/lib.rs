use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;
use tauri::Manager;

#[cfg(windows)]
use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW};

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

/// Wait for ChatGPT window to be in focus, then paste
fn wait_and_paste() {
    thread::spawn(|| {
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(15); // Max 15 seconds timeout
        let poll_interval = Duration::from_millis(100); // Check every 100ms

        // Wait for browser to start opening
        thread::sleep(Duration::from_millis(500));

        loop {
            // Check timeout
            if start.elapsed() > timeout {
                // Fallback: paste anyway after timeout
                do_paste();
                break;
            }

            // Check if ChatGPT window is in focus
            #[cfg(windows)]
            if let Some(title) = get_foreground_window_title() {
                // Check for ChatGPT in window title (works for most browsers)
                if title.contains("ChatGPT") || title.contains("chat.openai.com") {
                    // Small delay to ensure page is interactive
                    thread::sleep(Duration::from_millis(300));
                    do_paste();
                    break;
                }
            }

            thread::sleep(poll_interval);
        }
    });
}

/// Simulate Ctrl+V to paste from clipboard
fn do_paste() {
    if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
        let _ = enigo.key(Key::Control, Direction::Press);
        let _ = enigo.key(Key::Unicode('v'), Direction::Click);
        let _ = enigo.key(Key::Control, Direction::Release);
    }
}

#[tauri::command]
fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<String, String> {
    // Capture primary monitor
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors.first().ok_or("No monitor found")?;

    let screenshot = monitor.capture_image().map_err(|e| e.to_string())?;

    // Crop to selected region
    let x = x.max(0) as u32;
    let y = y.max(0) as u32;
    let width = width.min(screenshot.width().saturating_sub(x));
    let height = height.min(screenshot.height().saturating_sub(y));

    if width == 0 || height == 0 {
        return Err("Invalid selection region".to_string());
    }

    let cropped = image::imageops::crop_imm(&screenshot, x, y, width, height).to_image();

    // Copy to clipboard
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;

    let img_data = arboard::ImageData {
        width: cropped.width() as usize,
        height: cropped.height() as usize,
        bytes: std::borrow::Cow::Owned(cropped.into_raw()),
    };

    clipboard.set_image(img_data).map_err(|e| e.to_string())?;

    // Open ChatGPT
    let _ = open::that("https://chat.openai.com");

    // Smart wait and paste when ChatGPT window is focused
    wait_and_paste();

    Ok("Screenshot captured! Waiting for ChatGPT...".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if shortcut.key == tauri_plugin_global_shortcut::Code::KeyQ {
                            // Show the overlay window
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            use tauri_plugin_global_shortcut::GlobalShortcutExt;

            // Register Ctrl+Shift+Q
            let shortcut = tauri_plugin_global_shortcut::Shortcut::new(
                Some(
                    tauri_plugin_global_shortcut::Modifiers::CONTROL
                        | tauri_plugin_global_shortcut::Modifiers::SHIFT,
                ),
                tauri_plugin_global_shortcut::Code::KeyQ,
            );

            app.global_shortcut().register(shortcut)?;

            // Hide window on startup
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![capture_region])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
