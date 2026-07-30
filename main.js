const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

// Maintain data persistence by hardcoding the userData folder to the original name
const userDataPath = path.join(app.getPath('appData'), 'khyber-charsi-tikka-karahi-restaurant');
app.setPath('userData', userDataPath);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets', 'logo.jpg')
  });

  mainWindow.maximize();
  mainWindow.show();

  mainWindow.loadFile('login.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Prevent closing if there are hold orders pending
  mainWindow.on('close', async (e) => {
    // If we've already approved closing, let it proceed
    if (mainWindow && mainWindow.__allowClose) return;

    // Avoid re-entrancy / multiple dialogs
    if (mainWindow && mainWindow.__closeCheckInProgress) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    if (!mainWindow) return;
    mainWindow.__closeCheckInProgress = true;

    let holdCount = 0;
    try {
      holdCount = await mainWindow.webContents.executeJavaScript(
        `(() => {
          try {
            const raw = localStorage.getItem('holdOrders');
            if (!raw) return 0;
            const orders = JSON.parse(raw);
            if (!Array.isArray(orders)) return 0;
            return orders.filter(o => o && ((o.status ?? 'pending') === 'pending')).length;
          } catch (e) {
            return 0;
          }
        })()`,
        true
      );
    } catch (err) {
      holdCount = 0;
    }

    if (holdCount > 0) {
      await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['OK'],
        defaultId: 0,
        title: 'Hold Orders Pending',
        message: 'Please complete Hold Orders before closing the application.',
        detail: `You have ${holdCount} order(s) still in Hold Orders.`
      });
      mainWindow.__closeCheckInProgress = false;
      return;
    }

    // No hold orders, allow closing
    mainWindow.__allowClose = true;
    mainWindow.__closeCheckInProgress = false;
    mainWindow.close();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

