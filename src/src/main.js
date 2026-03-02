const { app, BrowserWindow, ipcMain, dialog, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

nativeTheme.themeSource = 'dark';

let mainWindow, splashWindow;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Ad config — just change the URLs below
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const AD_CONFIG = {
  // Splash ad page URL — your site with AdSense
  splashAdUrl: 'https://YOUR-SITE.com/ad-splash',
  // Main bottom banner ad URL
  bannerAdUrl: 'https://YOUR-SITE.com/ad-banner',
  // Splash display duration (ms)
  splashDuration: 4000,
};

// ── SPLASH ────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 520, height: 340,
    frame: false, alwaysOnTop: true,
    skipTaskbar: true, resizable: false,
    backgroundColor: '#050505',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // webview 태그 허용
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
  // AD URL을 splash에 전달
  splashWindow.webContents.on('did-finish-load', () => {
    splashWindow.webContents.send('ad-config', AD_CONFIG);
  });
}

// ── MAIN ──────────────────────────────────────────
function createMain() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 760,
    minWidth: 820, minHeight: 600,
    frame: false, backgroundColor: '#050505',
    icon: path.join(__dirname, '../assets/icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('ad-config', AD_CONFIG);
  });
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      mainWindow.show();
    }, AD_CONFIG.splashDuration);
  });
}

app.whenReady().then(() => { createSplash(); createMain(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── IPC: Window controls ──────────────────────────
ipcMain.on('win-minimize', () => mainWindow.minimize());
ipcMain.on('win-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('win-close',    () => mainWindow.close());
ipcMain.on('open-url',    (_, url) => shell.openExternal(url));
ipcMain.on('splash-skip',  () => {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  mainWindow.show();
});

// ── IPC: Pick image ───────────────────────────────
ipcMain.handle('pick-image', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Select cursor image',
    filters: [{ name: '이미지', extensions: ['png','jpg','jpeg','gif','webp','bmp'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths.length) return null;
  const fp = r.filePaths[0];
  const buf = fs.readFileSync(fp);
  const ext = path.extname(fp).slice(1).toLowerCase();
  const mime = ext==='png'?'image/png': ext==='gif'?'image/gif': ext==='webp'?'image/webp':'image/jpeg';
  return { dataUrl: `data:${mime};base64,${buf.toString('base64')}`, name: path.basename(fp) };
});

// ── IPC: Apply system cursor (Windows, registry) ──
ipcMain.handle('apply-system-cursor', async (_, { pngBase64, hotX, hotY }) => {
  if (process.platform !== 'win32') return { ok: false, msg: 'This feature is Windows only.' };
  try {
    const tmpDir = path.join(os.tmpdir(), 'cursorforge');
    fs.mkdirSync(tmpDir, { recursive: true });
    const pngPath = path.join(tmpDir, 'cur.png');
    fs.writeFileSync(pngPath, Buffer.from(pngBase64, 'base64'));
    const curPath = path.join(tmpDir, 'cursor.cur');
    const pyScript = path.join(__dirname, 'make_cur.py');
    execSync(`python "${pyScript}" "${pngPath}" "${curPath}" ${hotX||0} ${hotY||0}`, { timeout: 10000, windowsHide: true });
    if (!fs.existsSync(curPath)) return { ok: false, msg: '.cur file creation failed' };

    const regKey = 'HKEY_CURRENT_USER\\Control Panel\\Cursors';
    const types = ['Arrow','Hand','Crosshair','IBeam','Wait','AppStarting','SizeAll','SizeNESW','SizeNS','SizeNWSE','SizeWE','No','UpArrow'];
    for (const t of types) {
      execSync(`reg add "${regKey}" /v ${t} /t REG_EXPAND_SZ /d "${curPath}" /f`, { windowsHide: true });
    }
    const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class CU{[DllImport("user32.dll")]public static extern bool SystemParametersInfo(uint a,uint b,IntPtr c,uint d);}';[CU]::SystemParametersInfo(0x0057,0,[IntPtr]::Zero,0x03)`;
    execSync(`powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "${ps}"`, { timeout: 8000, windowsHide: true });
    return { ok: true, msg: '✓ 시스템 커서 적용 완료!' };
  } catch (e) {
    return { ok: false, msg: '오류: ' + e.message.slice(0, 120) };
  }
});

// ── IPC: Restore default cursors ──────────────────
ipcMain.handle('restore-cursors', async () => {
  if (process.platform !== 'win32') return { ok: false };
  try {
    const types = ['Arrow','Hand','Crosshair','IBeam','Wait','AppStarting','SizeAll','SizeNESW','SizeNS','SizeNWSE','SizeWE','No','UpArrow'];
    const regKey = 'HKEY_CURRENT_USER\\Control Panel\\Cursors';
    for (const t of types) {
      try { execSync(`reg delete "${regKey}" /v ${t} /f`, { windowsHide: true }); } catch(_){}
    }
    const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class CU3{[DllImport("user32.dll")]public static extern bool SystemParametersInfo(uint a,uint b,IntPtr c,uint d);}';[CU3]::SystemParametersInfo(0x0057,0,[IntPtr]::Zero,0x03)`;
    execSync(`powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "${ps}"`, { timeout: 8000, windowsHide: true });
    return { ok: true };
  } catch (e) { return { ok: false, msg: e.message }; }
});
