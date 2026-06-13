const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Load the compiled React app
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Basic native menu for Mac
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Automatically save downloads to the Downloads folder without prompting
  const { session } = require('electron');
  session.defaultSession.on('will-download', (event, item, webContents) => {
    // Generate a unique timestamp: e.g. 2026-06-08T20-35-04
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const originalName = item.getFilename();
    const ext = path.extname(originalName) || '.ics';
    const base = path.basename(originalName, ext);
    
    // Create a conflict-free filename
    const uniqueName = `${base}-${timestamp}${ext}`;
    
    // Set the path to bypass the "Save As" dialog completely
    const downloadPath = path.join(app.getPath('downloads'), uniqueName);
    item.setSavePath(downloadPath);
  });
});

// AppleScript bridge for native Reminders integration
const { ipcMain } = require('electron');
const { execFile } = require('child_process');

ipcMain.handle('add-reminders', async (event, todos) => {
  return new Promise((resolve, reject) => {
    let script = 'tell application "Reminders"\n';
    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];
      const priorityNum = todo.priority === 'high' ? 1 : todo.priority === 'medium' ? 5 : 9;
      // Escape backslashes and double quotes for AppleScript string literals
      const name = todo.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const body = todo.description ? todo.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim() : "";
      
      let dateScript = "";
      let dueDateProp = "";
      
      if (todo.dueDate && todo.dueDate !== 'null') {
        const [year, month, day] = todo.dueDate.split('-');
        let hour = 9; // Default 9 AM
        let minute = 0;
        if (todo.dueTime && todo.dueTime !== 'null') {
          const [h, m] = todo.dueTime.split(':');
          hour = parseInt(h, 10);
          minute = parseInt(m, 10);
        }
        
        dateScript = `
  set _dueDate${i} to current date
  set year of _dueDate${i} to ${parseInt(year, 10)}
  set month of _dueDate${i} to ${parseInt(month, 10)}
  set day of _dueDate${i} to ${parseInt(day, 10)}
  set hours of _dueDate${i} to ${hour}
  set minutes of _dueDate${i} to ${minute}
  set seconds of _dueDate${i} to 0`;
        dueDateProp = `, due date:_dueDate${i}`;
      }
      
      script += dateScript;
      script += `\n  make new reminder with properties {name:"${name}", body:"${body}", priority:${priorityNum}${dueDateProp}}\n`;
    }
    script += 'end tell';

    // Using execFile cleanly bypasses shell escaping issues with single quotes in titles
    execFile('osascript', ['-e', script], (error, stdout, stderr) => {
      if (error) {
        console.error('AppleScript error:', stderr);
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

