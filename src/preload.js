const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize:          () => ipcRenderer.send('win-minimize'),
  maximize:          () => ipcRenderer.send('win-maximize'),
  close:             () => ipcRenderer.send('win-close'),
  splashSkip:        () => ipcRenderer.send('splash-skip'),
  openUrl:           (url) => ipcRenderer.send('open-url', url),
  pickImage:         () => ipcRenderer.invoke('pick-image'),
  applySystemCursor: (d) => ipcRenderer.invoke('apply-system-cursor', d),
  restoreCursors:    () => ipcRenderer.invoke('restore-cursors'),
  onAdConfig:        (cb) => ipcRenderer.on('ad-config', (_, cfg) => cb(cfg)),
});
