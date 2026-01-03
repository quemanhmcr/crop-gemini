# CropGemini

🎯 **Quick Screenshot to Gemini** - Ứng dụng desktop siêu nhẹ cho Windows

## Features

- ⌨️ **Hotkey**: `Ctrl+Shift+Q` để bắt đầu crop
- 🖱️ **Drag & Drop**: Kéo thả để chọn vùng màn hình
- 📋 **Auto Copy**: Tự động copy ảnh vào clipboard
- 🌐 **Auto Open**: Mở Gemini trong browser
- ⚡ **Smart Paste**: Tự động paste khi Gemini load xong
- 🪶 **Siêu nhẹ**: Chỉ ~6MB

## Installation

Download installer từ [Releases](./src-tauri/target/release/bundle/nsis/)

Hoặc build từ source:

```powershell
npm install
npm run tauri build
```

## Usage

1. Chạy CropGemini (chạy ngầm trong system tray)
2. Nhấn `Ctrl+Shift+Q`
3. Kéo thả để chọn vùng cần hỏi
4. Gemini sẽ tự mở và paste ảnh!

## Development

```powershell
npm install
npm run tauri dev
```

## Tech Stack

- [Tauri v2](https://tauri.app) - Desktop framework
- [Rust](https://rust-lang.org) - Backend
- [xcap](https://crates.io/crates/xcap) - Screen capture
- [arboard](https://crates.io/crates/arboard) - Clipboard
- [enigo](https://crates.io/crates/enigo) - Keyboard simulation

## License

MIT
