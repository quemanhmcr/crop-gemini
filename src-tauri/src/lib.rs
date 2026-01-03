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

/// Check if window title indicates Gemini is ready
fn is_gemini_window(title: &str) -> bool {
    let title_lower = title.to_lowercase();
    
    // Match various forms of Gemini title in different browsers
    title_lower.contains("gemini") 
        || title_lower.contains("google ai")
        || title_lower.contains("bard")  // Old name, might still appear
}

/// Wait for Gemini window to be in focus, then paste
fn wait_and_paste() {
    thread::spawn(|| {
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(10); // 10 seconds timeout
        let poll_interval = Duration::from_millis(150); // Check every 150ms
        
        // Initial wait for browser to start
        thread::sleep(Duration::from_millis(800));
        
        let mut gemini_detected = false;
        
        loop {
            // Check timeout - paste anyway after timeout
            if start.elapsed() > timeout {
                do_paste();
                break;
            }
            
            // Check if Gemini window is in focus
            #[cfg(windows)]
            if let Some(title) = get_foreground_window_title() {
                if is_gemini_window(&title) {
                    if !gemini_detected {
                        gemini_detected = true;
                        // Wait a bit more for page to be fully interactive
                        thread::sleep(Duration::from_millis(500));
                    }
                    
                    // Double-check still on Gemini, then paste
                    if let Some(title2) = get_foreground_window_title() {
                        if is_gemini_window(&title2) {
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
        // Small delay before paste
        thread::sleep(Duration::from_millis(100));
        
        // Press and hold Ctrl
        let _ = enigo.key(Key::Control, Direction::Press);
        thread::sleep(Duration::from_millis(50));
        
        // Press V
        let _ = enigo.key(Key::Unicode('v'), Direction::Click);
        thread::sleep(Duration::from_millis(50));
        
        // Release Ctrl
        let _ = enigo.key(Key::Control, Direction::Release);
    }
}

#[tauri::command]
fn capture_region(x: i32, y: i32, width: u32, height: u32) -> Result<String, String> {
    // Capture primary monitor
    let monitors = xcap::Monitor::all().map_err(|e| format!("Monitor error: {}", e))?;
    let monitor = monitors.first().ok_or("No monitor found")?;

    let screenshot = monitor.capture_image().map_err(|e| format!("Capture error: {}", e))?;

    // Crop to selected region with bounds checking
    let img_width = screenshot.width();
    let img_height = screenshot.height();
    
    let x = (x.max(0) as u32).min(img_width.saturating_sub(1));
    let y = (y.max(0) as u32).min(img_height.saturating_sub(1));
    let width = width.min(img_width.saturating_sub(x));
    let height = height.min(img_height.saturating_sub(y));

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

    clipboard.set_image(img_data).map_err(|e| format!("Clipboard set error: {}", e))?;

    // Open Gemini using the opener plugin (no need for separate 'open' crate)
    let _ = tauri_plugin_opener::open_url("https://gemini.google.com/app", None::<&str>);

    // Smart wait and paste when Gemini window is focused
    wait_and_paste();

    Ok("Screenshot captured!".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed
                        && shortcut.key == tauri_plugin_global_shortcut::Code::KeyQ
                    {
                        // Show the overlay window
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
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

            // Hide window on startup - app runs in background
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![capture_region])
        .run(tauri::generate_context!())
        .expect("Error running CropGemini");
}
