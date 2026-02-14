const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || 'Aldesplume10#';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Archivos de datos
const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');
const COSTS_FILE = path.join(DATA_DIR, 'costs.json');
const TOTP_FILE = path.join(DATA_DIR, '2fa-secret.json');

// Middleware de autenticación
function authMiddleware(req, res, next) {
  const authHeader = req.headers['x-access-password'];
  if (authHeader === ACCESS_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Inicializar archivos de datos
async function initData() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Tasks
    try {
      await fs.access(TASKS_FILE);
    } catch {
      await fs.writeFile(TASKS_FILE, JSON.stringify([], null, 2));
    }
    
    // Status
    try {
      await fs.access(STATUS_FILE);
    } catch {
      const initialStatus = {
        active: true,
        currentTask: 'Iniciando Lentejo Control',
        nextHeartbeat: Date.now() + 600000, // 10 min
        bandwidth: 20,
        lastUpdate: new Date().toISOString()
      };
      await fs.writeFile(STATUS_FILE, JSON.stringify(initialStatus, null, 2));
    }
    
    // Costs
    try {
      await fs.access(COSTS_FILE);
    } catch {
      const initialCosts = {
        today: 0,
        month: 0,
        apiCalls: [],
        lastUpdate: new Date().toISOString()
      };
      await fs.writeFile(COSTS_FILE, JSON.stringify(initialCosts, null, 2));
    }
    
    // 2FA Secret (no se crea automáticamente, se genera en setup)
    try {
      await fs.access(TOTP_FILE);
    } catch {
      // No existe, se creará en el primer setup
    }
  } catch (err) {
    console.error('Error inicializando datos:', err);
  }
}

// Helper: leer 2FA secret
async function get2FASecret() {
  try {
    const data = await fs.readFile(TOTP_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Helper: guardar 2FA secret
async function save2FASecret(secret, backup) {
  await fs.writeFile(TOTP_FILE, JSON.stringify({ secret, backup, createdAt: new Date().toISOString() }, null, 2));
}

// === ENDPOINTS ===

// Status del agente
app.get('/api/status', authMiddleware, async (req, res) => {
  try {
    const data = await fs.readFile(STATUS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/status', authMiddleware, async (req, res) => {
  try {
    const data = await fs.readFile(STATUS_FILE, 'utf8');
    const status = JSON.parse(data);
    Object.assign(status, req.body, { lastUpdate: new Date().toISOString() });
    await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tasks (Kanban)
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const { title, description, priority, momentum } = req.body;
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    const tasks = JSON.parse(data);
    
    const newTask = {
      id: Date.now().toString(),
      title,
      description: description || '',
      status: 'queue', // queue, in_progress, done
      priority: priority || 'medium',
      momentum: momentum || 50,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null
    };
    
    tasks.push(newTask);
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
    res.json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    const tasks = JSON.parse(data);
    const task = tasks.find(t => t.id === req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    Object.assign(task, req.body, { updatedAt: new Date().toISOString() });
    
    if (req.body.status === 'done' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
      task.progress = 100;
    }
    
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    let tasks = JSON.parse(data);
    tasks = tasks.filter(t => t.id !== req.params.id);
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Costs
app.get('/api/costs', authMiddleware, async (req, res) => {
  try {
    const data = await fs.readFile(COSTS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/costs', authMiddleware, async (req, res) => {
  try {
    const { api, cost, description } = req.body;
    const data = await fs.readFile(COSTS_FILE, 'utf8');
    const costs = JSON.parse(data);
    
    const newCall = {
      id: Date.now().toString(),
      api,
      cost: parseFloat(cost),
      description: description || '',
      timestamp: new Date().toISOString()
    };
    
    costs.apiCalls.unshift(newCall);
    costs.today += newCall.cost;
    costs.month += newCall.cost;
    costs.lastUpdate = new Date().toISOString();
    
    // Mantener solo últimas 100 llamadas
    if (costs.apiCalls.length > 100) {
      costs.apiCalls = costs.apiCalls.slice(0, 100);
    }
    
    await fs.writeFile(COSTS_FILE, JSON.stringify(costs, null, 2));
    res.json(newCall);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats generales
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const [tasksData, costsData, statusData] = await Promise.all([
      fs.readFile(TASKS_FILE, 'utf8'),
      fs.readFile(COSTS_FILE, 'utf8'),
      fs.readFile(STATUS_FILE, 'utf8')
    ]);
    
    const tasks = JSON.parse(tasksData);
    const costs = JSON.parse(costsData);
    const status = JSON.parse(statusData);
    
    const stats = {
      tasks: {
        total: tasks.length,
        queue: tasks.filter(t => t.status === 'queue').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        done: tasks.filter(t => t.status === 'done').length
      },
      costs: {
        today: costs.today.toFixed(2),
        month: costs.month.toFixed(2),
        callsToday: costs.apiCalls.filter(c => {
          const callDate = new Date(c.timestamp).toDateString();
          const today = new Date().toDateString();
          return callDate === today;
        }).length
      },
      status: {
        active: status.active,
        bandwidth: status.bandwidth
      }
    };
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === 2FA ENDPOINTS ===

// Check si 2FA está configurado
app.get('/api/2fa/status', async (req, res) => {
  const secret = await get2FASecret();
  res.json({ configured: !!secret });
});

// Setup inicial de 2FA (genera QR)
app.post('/api/2fa/setup', async (req, res) => {
  const { password } = req.body;
  
  // Verificar password primero
  if (password !== ACCESS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  // Verificar si ya está configurado
  const existing = await get2FASecret();
  if (existing) {
    return res.status(400).json({ error: '2FA already configured' });
  }
  
  try {
    // Generar secret
    const secret = speakeasy.generateSecret({
      name: 'Lentejo Control',
      issuer: 'Lentejo'
    });
    
    // Generar códigos de backup (10)
    const backupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );
    
    // Guardar secret y backups
    await save2FASecret(secret.base32, backupCodes);
    
    // Generar QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    
    res.json({
      ok: true,
      qrCode,
      secret: secret.base32,
      backupCodes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth (login con password + 2FA)
app.post('/api/auth', async (req, res) => {
  const { password, token } = req.body;
  
  // Verificar password
  if (password !== ACCESS_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Invalid password' });
  }
  
  // Verificar si 2FA está configurado
  const secretData = await get2FASecret();
  
  if (!secretData) {
    // 2FA no configurado, permitir login solo con password
    return res.json({ ok: true, requires2FA: false });
  }
  
  // 2FA configurado, verificar token
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Token required', requires2FA: true });
  }
  
  // Verificar TOTP
  const verified = speakeasy.totp.verify({
    secret: secretData.secret,
    encoding: 'base32',
    token: token,
    window: 2 // Permitir 2 ventanas de tiempo (±60s)
  });
  
  if (verified) {
    return res.json({ ok: true, requires2FA: true });
  }
  
  // Si no es TOTP válido, verificar códigos de backup
  if (secretData.backup && secretData.backup.includes(token.toUpperCase())) {
    // Código de backup válido, removerlo
    secretData.backup = secretData.backup.filter(code => code !== token.toUpperCase());
    await save2FASecret(secretData.secret, secretData.backup);
    
    return res.json({ ok: true, requires2FA: true, usedBackup: true });
  }
  
  return res.status(401).json({ ok: false, error: 'Invalid token' });
});

// Iniciar servidor
initData().then(() => {
  app.listen(PORT, () => {
    console.log(`🐕 Lentejo Control running on port ${PORT}`);
  });
});
