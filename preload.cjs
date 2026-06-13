const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  addReminders: (todos) => ipcRenderer.invoke('add-reminders', todos)
});
