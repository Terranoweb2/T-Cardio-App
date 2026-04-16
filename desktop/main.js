const { app, BrowserWindow, Menu, Tray, shell, ipcMain, nativeImage, Notification, session } = require('electron');
const path = require('path');
const Store = require('electron-store');

// ==================== CONFIG ====================
const APP_URL = 'https://t-cardio.org';
const LOGIN_URL = `${APP_URL}/login`;
const DOCTOR_DASHBOARD = `${APP_URL}/doctor/dashboard`;
const APP_NAME = 'T-Cardio Medecin';

const store = new Store({
  defaults: {
    windowBounds: { width: 1280, height: 800 },
    windowPosition: null,
    isMaximized: false,
  },
});

let mainWindow = null;
let tray = null;
let splashWindow = null;
let isQuitting = false;

// ==================== SINGLE INSTANCE ====================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ==================== SPLASH SCREEN ====================
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

// ==================== MAIN WINDOW ====================
function createMainWindow() {
  const { width, height } = store.get('windowBounds');
  const position = store.get('windowPosition');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 900,
    minHeight: 600,
    x: position?.x,
    y: position?.y,
    show: false,
    title: APP_NAME,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#0a1628',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: true,
      // Allow notifications, media (webcam/mic for teleconsultation)
      webSecurity: true,
    },
  });

  // Remove default menu (cleaner for doctors)
  Menu.setApplicationMenu(buildAppMenu());

  // Allow webcam/mic for teleconsultation
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'];
    callback(allowedPermissions.includes(permission));
  });

  // Load the app
  mainWindow.loadURL(LOGIN_URL);

  // Show window when page is ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }

    mainWindow.show();

    if (store.get('isMaximized')) {
      mainWindow.maximize();
    }
  });

  // Handle navigation — redirect to doctor dashboard after login
  mainWindow.webContents.on('did-navigate', (event, url) => {
    // If user lands on /dashboard (patient), redirect to doctor dashboard
    if (url === `${APP_URL}/dashboard`) {
      mainWindow.loadURL(DOCTOR_DASHBOARD);
    }
  });

  mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
    if (url === `${APP_URL}/dashboard`) {
      mainWindow.loadURL(DOCTOR_DASHBOARD);
    }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Save window size/position on close
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  mainWindow.on('maximize', () => {
    store.set('isMaximized', true);
  });

  mainWindow.on('unmaximize', () => {
    store.set('isMaximized', false);
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      showTrayNotification('T-Cardio est toujours actif', 'L\'application continue en arriere-plan. Cliquez sur l\'icone pour la rouvrir.');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==================== TRAY ====================
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip(APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Ouvrir T-Cardio',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Mon Tableau de bord',
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL(DOCTOR_DASHBOARD);
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Mes Patients',
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL(`${APP_URL}/doctor/patients`);
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Messagerie',
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL(`${APP_URL}/messaging`);
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Teleconsultations',
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL(`${APP_URL}/doctor/teleconsultations`);
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ==================== APP MENU ====================
function buildAppMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Tableau de bord',
          accelerator: 'CmdOrCtrl+D',
          click: () => mainWindow?.loadURL(DOCTOR_DASHBOARD),
        },
        {
          label: 'Mes Patients',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow?.loadURL(`${APP_URL}/doctor/patients`),
        },
        {
          label: 'Messagerie',
          accelerator: 'CmdOrCtrl+M',
          click: () => mainWindow?.loadURL(`${APP_URL}/messaging`),
        },
        { type: 'separator' },
        {
          label: 'Recharger',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.reload(),
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Retablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout selectionner' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'resetZoom', label: 'Taille normale' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arriere' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein ecran' },
      ],
    },
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Tableau de bord',
          accelerator: 'Alt+1',
          click: () => mainWindow?.loadURL(DOCTOR_DASHBOARD),
        },
        {
          label: 'Patients',
          accelerator: 'Alt+2',
          click: () => mainWindow?.loadURL(`${APP_URL}/doctor/patients`),
        },
        {
          label: 'Agenda',
          accelerator: 'Alt+3',
          click: () => mainWindow?.loadURL(`${APP_URL}/doctor/agenda`),
        },
        {
          label: 'Teleconsultations',
          accelerator: 'Alt+4',
          click: () => mainWindow?.loadURL(`${APP_URL}/doctor/teleconsultations`),
        },
        {
          label: 'Messagerie',
          accelerator: 'Alt+5',
          click: () => mainWindow?.loadURL(`${APP_URL}/messaging`),
        },
        {
          label: 'Portefeuille',
          accelerator: 'Alt+6',
          click: () => mainWindow?.loadURL(`${APP_URL}/doctor/wallet`),
        },
        {
          label: 'Mes Tarifs',
          accelerator: 'Alt+7',
          click: () => mainWindow?.loadURL(`${APP_URL}/doctor/pricing`),
        },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'A propos de T-Cardio',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'A propos',
              message: 'T-Cardio Medecin',
              detail: 'Version 1.0.0\nPlateforme intelligente de suivi cardiovasculaire\n\n(c) 2026 T-Cardio',
            });
          },
        },
      ],
    },
  ]);
}

// ==================== HELPERS ====================
function saveWindowState() {
  if (!mainWindow || mainWindow.isMaximized()) return;

  const bounds = mainWindow.getBounds();
  store.set('windowBounds', { width: bounds.width, height: bounds.height });
  store.set('windowPosition', { x: bounds.x, y: bounds.y });
}

function showTrayNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body, icon: path.join(__dirname, 'assets', 'icon.png') }).show();
  }
}

// ==================== APP LIFECYCLE ====================
app.whenReady().then(() => {
  createSplashWindow();
  createTray();
  createMainWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  } else {
    mainWindow.show();
  }
});

// ==================== IPC ====================
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-name', () => APP_NAME);
