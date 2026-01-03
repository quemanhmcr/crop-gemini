# CropGPT

🎯 **Quick Screenshot to ChatGPT** - Ứng dụng desktop siêu nhẹ cho Windows

## Features

- ⌨️ **Hotkey**: `Ctrl+Shift+Q` để bắt đầu crop
- 🖱️ **Drag & Drop**: Kéo thả để chọn vùng màn hình
- 📋 **Auto Copy**: Tự động copy ảnh vào clipboard
- 🌐 **Auto Open**: Mở ChatGPT trong browser
- ⚡ **Siêu nhẹ**: Chỉ ~6MB

## Installation

Download installer từ [Releases](./src-tauri/target/release/bundle/nsis/CropGPT_0.1.0_x64-setup.exe)

Hoặc build từ source:

```powershell
npm install
npm run tauri build
```

## Usage

1. Chạy CropGPT (chạy ngầm trong system tray)
2. Nhấn `Ctrl+Shift+Q`
3. Kéo thả để chọn vùng cần hỏi
4. ChatGPT sẽ tự mở
5. Nhấn `Ctrl+V` để paste ảnh và hỏi!

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

## License

MIT
