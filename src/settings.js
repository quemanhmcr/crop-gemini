// Settings page logic - Production-ready version
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
const { load } = window.__TAURI_PLUGIN_STORE__;

// Default settings
const DEFAULT_SETTINGS = {
    aiUrl: 'https://gemini.google.com/app',
    shortcut: { modifiers: ['Control', 'Shift'], key: 'Q' },
    quickOpenShortcut: { modifiers: ['Control', 'Shift'], key: 'W' },
    autoUpdate: true
};

let currentSettings = { ...DEFAULT_SETTINGS };
let originalSettings = null;
let isRecordingShortcut = false;
let isRecordingQuickOpenShortcut = false;
let isSaving = false;
let store = null;

// DOM Elements
let aiServiceSelect, customUrlGroup, customUrlInput, urlHint;
let shortcutBtn, shortcutDisplay;
let quickOpenShortcutBtn, quickOpenShortcutDisplay;
let autoUpdateToggle;
let snackbar, saveBtn, cancelBtn, versionSpan, unsavedBadge;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    initDOMReferences();
    await initStore();
    await Promise.all([loadSettings(), loadVersion()]);
    setupEventListeners();
});

function initDOMReferences() {
    aiServiceSelect = document.getElementById('ai-service');
    customUrlGroup = document.getElementById('custom-url-group');
    customUrlInput = document.getElementById('custom-url');
    urlHint = document.getElementById('url-hint');
    shortcutBtn = document.getElementById('shortcut-input');
    shortcutDisplay = document.getElementById('shortcut-display');
    quickOpenShortcutBtn = document.getElementById('quick-open-shortcut-input');
    quickOpenShortcutDisplay = document.getElementById('quick-open-shortcut-display');
    autoUpdateToggle = document.getElementById('auto-update');
    snackbar = document.getElementById('snackbar');
    saveBtn = document.getElementById('save-btn');
    cancelBtn = document.getElementById('cancel-btn');
    versionSpan = document.getElementById('version-display');
    unsavedBadge = document.getElementById('unsaved-badge');
}

async function initStore() {
    try {
        store = await load('settings.json', { autoSave: true });
    } catch (e) {
        console.error('Failed to load store:', e);
    }
}

async function loadVersion() {
    try {
        const version = await invoke('plugin:app|version');
        if (versionSpan && version) {
            versionSpan.textContent = `v${version}`;
        }
    } catch (error) {
        console.log('Could not load version:', error);
    }
}

async function loadSettings() {
    try {
        if (store) {
            const settings = await store.get('settings');
            if (settings) {
                currentSettings = { ...DEFAULT_SETTINGS, ...settings };
            }
        }
    } catch (error) {
        console.log('Using default settings:', error);
    }

    // Store original settings for change detection
    originalSettings = JSON.stringify(currentSettings);
    applySettingsToUI();
}

function applySettingsToUI() {
    // AI Service
    const aiUrl = currentSettings.aiUrl;
    const matchingOption = Array.from(aiServiceSelect.options).find(opt => opt.value === aiUrl);

    if (matchingOption) {
        aiServiceSelect.value = aiUrl;
        customUrlGroup.style.display = 'none';
    } else {
        aiServiceSelect.value = 'custom';
        customUrlGroup.style.display = 'flex';
        customUrlInput.value = aiUrl;
        validateCustomUrl(aiUrl);
    }

    // Shortcut
    updateShortcutDisplay();
    updateQuickOpenShortcutDisplay();

    // Auto-update
    autoUpdateToggle.checked = currentSettings.autoUpdate;
}

function updateShortcutDisplay() {
    const { modifiers, key } = currentSettings.shortcut;
    const parts = [...modifiers.map(m => m === 'Control' ? 'Ctrl' : m), key];
    shortcutDisplay.textContent = parts.join(' + ');
}

function updateQuickOpenShortcutDisplay() {
    const { modifiers, key } = currentSettings.quickOpenShortcut;
    const parts = [...modifiers.map(m => m === 'Control' ? 'Ctrl' : m), key];
    quickOpenShortcutDisplay.textContent = parts.join(' + ');
}

function hasUnsavedChanges() {
    return JSON.stringify(currentSettings) !== originalSettings;
}

function updateUnsavedIndicator() {
    if (hasUnsavedChanges()) {
        unsavedBadge.classList.add('visible');
    } else {
        unsavedBadge.classList.remove('visible');
    }
}

function validateCustomUrl(url) {
    if (!url) {
        urlHint.textContent = '';
        urlHint.className = 'field-hint';
        customUrlInput.classList.remove('error');
        return false;
    }

    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            urlHint.textContent = 'URL hợp lệ';
            urlHint.className = 'field-hint success';
            customUrlInput.classList.remove('error');
            return true;
        }
    } catch (e) {
        // Invalid URL
    }

    urlHint.textContent = 'URL không hợp lệ - phải bắt đầu bằng http:// hoặc https://';
    urlHint.className = 'field-hint error';
    customUrlInput.classList.add('error');
    return false;
}

function setupEventListeners() {
    // Close button
    document.getElementById('close-btn').addEventListener('click', handleClose);
    cancelBtn.addEventListener('click', handleClose);

    // AI Service dropdown
    aiServiceSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customUrlGroup.style.display = 'flex';
            customUrlInput.focus();
            currentSettings.aiUrl = customUrlInput.value;
        } else {
            customUrlGroup.style.display = 'none';
            currentSettings.aiUrl = e.target.value;
        }
        updateUnsavedIndicator();
    });

    // Custom URL input with inline validation
    customUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        validateCustomUrl(url);
        currentSettings.aiUrl = url;
        updateUnsavedIndicator();
    });

    // Shortcut recorders
    shortcutBtn.addEventListener('click', startShortcutRecording);
    quickOpenShortcutBtn.addEventListener('click', startQuickOpenShortcutRecording);
    document.addEventListener('keydown', handleShortcutKeydown);

    // Auto-update toggle
    autoUpdateToggle.addEventListener('change', (e) => {
        currentSettings.autoUpdate = e.target.checked;
        updateUnsavedIndicator();
    });

    // Save button
    saveBtn.addEventListener('click', saveSettings);

    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !isRecordingShortcut && !isRecordingQuickOpenShortcut) {
            handleClose();
        }
    });
}

async function handleClose() {
    if (hasUnsavedChanges()) {
        const confirmed = confirm('Bạn có thay đổi chưa lưu. Đóng mà không lưu?');
        if (!confirmed) return;
    }
    await closeWindow();
}

function startShortcutRecording() {
    isRecordingShortcut = true;
    isRecordingQuickOpenShortcut = false;
    shortcutBtn.classList.add('recording');
    quickOpenShortcutBtn.classList.remove('recording');
    shortcutDisplay.textContent = 'Nhấn tổ hợp phím...';
}

function startQuickOpenShortcutRecording() {
    isRecordingQuickOpenShortcut = true;
    isRecordingShortcut = false;
    quickOpenShortcutBtn.classList.add('recording');
    shortcutBtn.classList.remove('recording');
    quickOpenShortcutDisplay.textContent = 'Nhấn tổ hợp phím...';
}

function handleShortcutKeydown(e) {
    if (!isRecordingShortcut && !isRecordingQuickOpenShortcut) return;

    // Ignore modifier-only presses
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    e.preventDefault();

    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Control');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.altKey) modifiers.push('Alt');

    // Require at least one modifier
    if (modifiers.length === 0) {
        showSnackbar('Vui lòng sử dụng ít nhất một phím Ctrl, Shift hoặc Alt', 'error');
        if (isRecordingShortcut) {
            isRecordingShortcut = false;
            shortcutBtn.classList.remove('recording');
            updateShortcutDisplay();
        }
        if (isRecordingQuickOpenShortcut) {
            isRecordingQuickOpenShortcut = false;
            quickOpenShortcutBtn.classList.remove('recording');
            updateQuickOpenShortcutDisplay();
        }
        return;
    }

    // Get the key
    let key = e.key.toUpperCase();
    if (key === ' ') key = 'Space';

    if (isRecordingShortcut) {
        currentSettings.shortcut = { modifiers, key };
        isRecordingShortcut = false;
        shortcutBtn.classList.remove('recording');
        updateShortcutDisplay();
    } else if (isRecordingQuickOpenShortcut) {
        currentSettings.quickOpenShortcut = { modifiers, key };
        isRecordingQuickOpenShortcut = false;
        quickOpenShortcutBtn.classList.remove('recording');
        updateQuickOpenShortcutDisplay();
    }
    updateUnsavedIndicator();
}

async function saveSettings() {
    if (isSaving) return;

    // Validate custom URL before saving
    if (aiServiceSelect.value === 'custom') {
        const url = customUrlInput.value.trim();
        if (!validateCustomUrl(url)) {
            showSnackbar('Vui lòng nhập URL hợp lệ', 'error');
            customUrlInput.focus();
            return;
        }
        currentSettings.aiUrl = url;
    }

    try {
        isSaving = true;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang lưu...';

        // Save to store using the Store API
        if (store) {
            await store.set('settings', currentSettings);
            await store.save();
        }

        // Reload shortcut in the backend
        try {
            await invoke('reload_shortcut');
        } catch (e) {
            console.error('Failed to reload shortcut:', e);
        }

        // Update original settings to mark as saved
        originalSettings = JSON.stringify(currentSettings);
        updateUnsavedIndicator();

        showSnackbar('Đã lưu cài đặt', 'success');

        // Close after a short delay
        setTimeout(closeWindow, 600);
    } catch (error) {
        console.error('Failed to save settings:', error);
        showSnackbar('Lỗi khi lưu: ' + error, 'error');
    } finally {
        isSaving = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu thay đổi';
    }
}

function showSnackbar(message, type = '') {
    snackbar.textContent = message;
    snackbar.className = 'snackbar show';
    if (type) snackbar.classList.add(type);

    setTimeout(() => {
        snackbar.classList.remove('show');
    }, 3000);
}

async function closeWindow() {
    try {
        const appWindow = getCurrentWindow();
        await appWindow.hide();
    } catch (e) {
        console.error('Failed to close window:', e);
    }
}
