// Configuración
const API_URL = window.location.origin;
let accessPassword = '';

// Elementos DOM
const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');

// Botones
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const newTaskBtn = document.getElementById('newTaskBtn');
const newTaskBtn2 = document.getElementById('newTaskBtn2');
const addCostBtn = document.getElementById('addCostBtn');

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Modales
const taskModal = document.getElementById('taskModal');
const costModal = document.getElementById('costModal');
const taskForm = document.getElementById('taskForm');
const costForm = document.getElementById('costForm');

// === LOGIN ===
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = passwordInput.value;
  
  try {
    const res = await fetch(`${API_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    const data = await res.json();
    
    if (data.ok) {
      accessPassword = password;
      localStorage.setItem('lentejoControl_password', password);
      loginScreen.style.display = 'none';
      dashboard.style.display = 'block';
      loadDashboard();
    } else {
      showLoginError('Contraseña incorrecta');
    }
  } catch (err) {
    showLoginError('Error de conexión');
  }
});

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
  setTimeout(() => {
    loginError.style.display = 'none';
  }, 3000);
}

// Auto-login si hay password guardado
const savedPassword = localStorage.getItem('lentejoControl_password');
if (savedPassword) {
  passwordInput.value = savedPassword;
  loginForm.dispatchEvent(new Event('submit'));
}

// Logout
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('lentejoControl_password');
  location.reload();
});

// === TABS ===
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    // Activar tab
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Mostrar contenido
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
  });
});

// === API HELPERS ===
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-access-password': accessPassword,
    ...options.headers
  };
  
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });
  
  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }
  
  return res.json();
}

// === DASHBOARD ===
async function loadDashboard() {
  try {
    await Promise.all([
      loadStatus(),
      loadTasks(),
      loadCosts(),
      loadStats()
    ]);
    
    // Auto-refresh cada 30 segundos
    setInterval(() => {
      loadStatus();
      loadStats();
    }, 30000);
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// Refresh manual
refreshBtn.addEventListener('click', loadDashboard);

// === STATUS ===
async function loadStatus() {
  try {
    const status = await apiRequest('/api/status');
    
    document.getElementById('statusIndicator').className = 
      `status-dot ${status.active ? 'active' : ''}`;
    document.getElementById('statusText').textContent = 
      status.active ? 'Active' : 'Inactive';
    document.getElementById('currentTask').textContent = 
      status.currentTask || '-';
    
    // Heartbeat
    const nextHB = new Date(status.nextHeartbeat);
    const now = new Date();
    const diff = Math.max(0, Math.floor((nextHB - now) / 60000));
    document.getElementById('nextHeartbeat').textContent = `${diff} min`;
    
    // Bandwidth
    document.getElementById('bandwidthFill').style.width = `${status.bandwidth}%`;
    document.getElementById('bandwidthText').textContent = `${status.bandwidth}%`;
  } catch (err) {
    console.error('Error loading status:', err);
  }
}

// === TASKS ===
let allTasks = [];

async function loadTasks() {
  try {
    allTasks = await apiRequest('/api/tasks');
    renderKanban();
    renderAllTasks();
  } catch (err) {
    console.error('Error loading tasks:', err);
  }
}

function renderKanban() {
  const queueTasks = allTasks.filter(t => t.status === 'queue');
  const progressTasks = allTasks.filter(t => t.status === 'in_progress');
  const doneTasks = allTasks.filter(t => t.status === 'done');
  
  document.getElementById('queueCount').textContent = queueTasks.length;
  document.getElementById('progressCount').textContent = progressTasks.length;
  document.getElementById('doneCount').textContent = doneTasks.length;
  
  document.getElementById('queueTasks').innerHTML = 
    queueTasks.sort((a, b) => b.momentum - a.momentum).map(renderTaskCard).join('');
  document.getElementById('progressTasks').innerHTML = 
    progressTasks.map(renderTaskCard).join('');
  document.getElementById('doneTasks').innerHTML = 
    doneTasks.slice(0, 5).map(renderTaskCard).join('');
}

function renderTaskCard(task) {
  const momentumEmoji = task.momentum >= 80 ? '⭐' : '';
  return `
    <div class="task-card" data-id="${task.id}">
      <div class="task-title">${task.title} ${momentumEmoji}</div>
      <div class="task-meta">
        <span class="task-momentum">${task.momentum}% fit</span>
        <span>${task.priority}</span>
      </div>
      ${task.status === 'in_progress' ? `
        <div class="task-meta">
          <span>${task.progress}% complete</span>
        </div>
      ` : ''}
      <div class="task-actions">
        ${renderTaskActions(task)}
      </div>
    </div>
  `;
}

function renderTaskActions(task) {
  const actions = [];
  
  if (task.status === 'queue') {
    actions.push(`<button class="task-btn" onclick="moveTask('${task.id}', 'in_progress')">▶ Start</button>`);
  }
  
  if (task.status === 'in_progress') {
    actions.push(`<button class="task-btn" onclick="moveTask('${task.id}', 'done')">✓ Done</button>`);
  }
  
  actions.push(`<button class="task-btn" onclick="deleteTask('${task.id}')">🗑</button>`);
  
  return actions.join('');
}

function renderAllTasks() {
  const html = allTasks.map(task => `
    <div class="all-task-card">
      <div class="all-task-header">
        <div class="all-task-title">${task.title}</div>
        <span class="all-task-status ${task.status}">${task.status.replace('_', ' ')}</span>
      </div>
      ${task.description ? `<p style="font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 8px;">${task.description}</p>` : ''}
      <div style="display: flex; gap: 12px; margin-top: 12px; font-size: 12px; color: rgba(255,255,255,0.6);">
        <span>Priority: ${task.priority}</span>
        <span>Momentum: ${task.momentum}%</span>
        ${task.completedAt ? `<span>✓ ${new Date(task.completedAt).toLocaleDateString()}</span>` : ''}
      </div>
    </div>
  `).join('');
  
  document.getElementById('allTasksList').innerHTML = html || '<p style="color: rgba(255,255,255,0.6);">No hay tareas</p>';
}

window.moveTask = async function(id, newStatus) {
  try {
    await apiRequest(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    });
    await loadTasks();
  } catch (err) {
    alert('Error moviendo tarea');
  }
};

window.deleteTask = async function(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  
  try {
    await apiRequest(`/api/tasks/${id}`, { method: 'DELETE' });
    await loadTasks();
  } catch (err) {
    alert('Error eliminando tarea');
  }
};

// Modal Nueva Tarea
newTaskBtn.addEventListener('click', () => {
  taskModal.style.display = 'flex';
});

newTaskBtn2.addEventListener('click', () => {
  taskModal.style.display = 'flex';
});

document.getElementById('cancelTask').addEventListener('click', () => {
  taskModal.style.display = 'none';
  taskForm.reset();
});

taskModal.querySelector('.modal-close').addEventListener('click', () => {
  taskModal.style.display = 'none';
  taskForm.reset();
});

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('taskTitle').value;
  const description = document.getElementById('taskDescription').value;
  const priority = document.getElementById('taskPriority').value;
  
  try {
    await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, description, priority, momentum: 50 })
    });
    
    taskModal.style.display = 'none';
    taskForm.reset();
    await loadTasks();
  } catch (err) {
    alert('Error creando tarea');
  }
});

// === COSTS ===
async function loadCosts() {
  try {
    const costs = await apiRequest('/api/costs');
    
    document.getElementById('costToday').textContent = `${costs.today.toFixed(2)}€`;
    document.getElementById('costMonth').textContent = `${costs.month.toFixed(2)}€`;
    document.getElementById('costTodayLarge').textContent = `${costs.today.toFixed(2)}€`;
    document.getElementById('costMonthLarge').textContent = `${costs.month.toFixed(2)}€`;
    
    // Calls count
    const today = new Date().toDateString();
    const callsToday = costs.apiCalls.filter(c => 
      new Date(c.timestamp).toDateString() === today
    ).length;
    document.getElementById('apiCallsCount').textContent = callsToday;
    
    // History
    const historyHTML = costs.apiCalls.map(call => `
      <div class="cost-entry">
        <div class="cost-entry-left">
          <div class="cost-entry-api">${call.api}</div>
          ${call.description ? `<div class="cost-entry-desc">${call.description}</div>` : ''}
          <div class="cost-entry-desc">${new Date(call.timestamp).toLocaleString()}</div>
        </div>
        <div class="cost-entry-amount">${call.cost.toFixed(2)}€</div>
      </div>
    `).join('');
    
    document.getElementById('costsHistory').innerHTML = historyHTML || 
      '<p style="color: rgba(255,255,255,0.6); text-align: center;">No hay registros</p>';
  } catch (err) {
    console.error('Error loading costs:', err);
  }
}

// Modal Añadir Coste
addCostBtn.addEventListener('click', () => {
  costModal.style.display = 'flex';
});

document.getElementById('cancelCost').addEventListener('click', () => {
  costModal.style.display = 'none';
  costForm.reset();
});

costModal.querySelector('.modal-close').addEventListener('click', () => {
  costModal.style.display = 'none';
  costForm.reset();
});

costForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const api = document.getElementById('costApi').value;
  const cost = document.getElementById('costAmount').value;
  const description = document.getElementById('costDescription').value;
  
  try {
    await apiRequest('/api/costs', {
      method: 'POST',
      body: JSON.stringify({ api, cost, description })
    });
    
    costModal.style.display = 'none';
    costForm.reset();
    await loadCosts();
    await loadStats();
  } catch (err) {
    alert('Error registrando coste');
  }
});

// === STATS ===
async function loadStats() {
  try {
    const stats = await apiRequest('/api/stats');
    
    document.getElementById('tasksCount').textContent = stats.tasks.total;
    document.getElementById('tasksBadge').textContent = stats.tasks.inProgress;
    document.getElementById('costsBadge').textContent = `${stats.costs.today}€`;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Cerrar modales al hacer click fuera
window.addEventListener('click', (e) => {
  if (e.target === taskModal) {
    taskModal.style.display = 'none';
    taskForm.reset();
  }
  if (e.target === costModal) {
    costModal.style.display = 'none';
    costForm.reset();
  }
});
