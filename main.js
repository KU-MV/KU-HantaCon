const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { Worker } = require('worker_threads');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// main.js 상단
if (process.platform === 'darwin') {
  process.env.PATH = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    process.env.PATH
  ].filter(Boolean).join(':');
}

const userDesktop = path.join(os.homedir(), 'Desktop');
const HantaConBase = path.join(userDesktop, 'HantaCon');
const workspaceDir = path.join(HantaConBase, 'workspace');
const auspiceDir = path.join(workspaceDir, 'auspice');
const composeFile = path.join(HantaConBase, "docker-compose.yml")
const resultDir = path.join(workspaceDir, 'result');

if (!fs.existsSync(HantaConBase)) fs.mkdirSync(HantaConBase);
if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir);
if (!fs.existsSync(auspiceDir)) fs.mkdirSync(auspiceDir);
if (!fs.existsSync(resultDir)) fs.mkdirSync(resultDir);


console.log('Workspace ready at:', HantaConBase);

const dockerSourceDir = path.join(__dirname, 'resources', 'docker');
const dockerFiles = ['.env','docker-compose.yml','dockerfile','env.yml','scripts/filter_indel_with_sr.py'];

// 선택적 복사
dockerFiles.forEach(file => {
  const srcPath = path.join(dockerSourceDir, file);
  const destPath = path.join(HantaConBase, file);

  // 하위 폴더가 있는 경우 폴더 생성
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  // 파일이 없으면 복사
  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} to workspace`);
  }
});


let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile('./src/index.html');

  // 🔹 개발용 디버그 콘솔 항상 열기
  //mainWindow.webContents.openDevTools();
});

ipcMain.handle("open-folder-dialog", async () => {
    if (os.platform() === "win32") {
        exec(`explorer "${resultDir}"`);
    } else if (os.platform() === "darwin") {
        exec(`open "${resultDir}"`);
    } else {
        exec(`xdg-open "${resultDir}"`);
    }
});

// ---------------- File/Folder Selection ----------------
ipcMain.handle('select-fastq', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'FASTQ', extensions: ['fastq', 'fq'] }]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-fasta', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    defaultPath: workspaceDir, // 기본 경로 지정
    filters: [{ name: 'FASTA', extensions: ['fasta', 'fa'] }]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-reference', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled) return null;

  const refDir = result.filePaths[0];
  const files = fs.readdirSync(refDir);
  const refFiles = {
    L: files.find(f => f.endsWith('_L.fasta')),
    M: files.find(f => f.endsWith('_M.fasta')),
    S: files.find(f => f.endsWith('_S.fasta'))
  };

  if (!refFiles.L || !refFiles.M || !refFiles.S) {
    throw new Error('Reference 폴더에 _L, _M, _S 파일이 모두 있어야 합니다.');
  }

  return {
    dir: refDir,
    L: path.join(refDir, refFiles.L),
    M: path.join(refDir, refFiles.M),
    S: path.join(refDir, refFiles.S)
  };
});

ipcMain.handle('select-outdir', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// ---------------- Workflow 실행 ----------------
let workflowRunning = false;

ipcMain.handle('run-workflow', (event, params) => {

  if (workflowRunning) {

    mainWindow.webContents.send('workflow-log', {
      type: "toast",
      data: "Workflow already running."
    });

    return;
  }

  workflowRunning = true;

  return new Promise((resolve, reject) => {

    const worker = new Worker(path.join(__dirname, 'workerWorkflow.js'), {
      workerData: {
        ...params,
        HantaConBase,
        workspaceDir,
        composeFile
      }
    });

    worker.on('message', (data) => {
      mainWindow.webContents.send('workflow-log', data);
    });

    worker.on('error', (err) => {
      workflowRunning = false;
      mainWindow.webContents.send('workflow-log', {"type": "work end", "data": "error"});
      reject(err);
    });

    worker.on('exit', (code) => {

      workflowRunning = false;
      mainWindow.webContents.send('workflow-log', {"type": "work end", "data": "COMPLETE"});
      if (code === 0) {
        
        resolve();
      } else {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }

    });

  });
});