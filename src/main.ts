import { app, BrowserWindow } from 'electron';
import { SerialHandler } from './serial';
import * as path from 'path';

let serialHandler: SerialHandler;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Changed to false for security
      contextIsolation: true, // Changed to true for security
      preload: path.join(__dirname, 'preload.js') // Add preload script
    }
  });

  win.loadFile('index.html');
  win.webContents.openDevTools();
}

app.whenReady().then(() => {
  serialHandler = new SerialHandler();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});