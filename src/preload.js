const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFastq: () => ipcRenderer.invoke('select-fastq'),
  selectFasta: () => ipcRenderer.invoke('select-fasta'),
  selectReference: () => ipcRenderer.invoke('select-reference'),
  selectOutdir: () => ipcRenderer.invoke('select-outdir'),
  runWorkflow: (params) => ipcRenderer.invoke('run-workflow', params),
  onLog: (callback) => ipcRenderer.on('workflow-log', (e, data) => callback(data)),
  openFolder: () => ipcRenderer.invoke("open-folder-dialog")
});