const API_URL = '';
const ITEMS_PER_PAGE = 10;

// State pour la pagination
let usersPage = 1;
let machinesPage = 1;
let transactionsPage = 1;
let allUsers = [];
let allMachines = [];
let allTransactions = [];

async function apiFetch(url) {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login'; return null; }
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
}

function formatMoney(v) { return Number(v || 0).toLocaleString("fr-FR"); }

// ============================================
// CHARGEMENT
// ============================================
async function loadAll() {
    await Promise.all([loadStats(), loadUsers(), loadMachines(), loadTransactions()]);
}

async function loadStats() {
    const stats = await apiFetch('/api/admin/stats');
    if (!stats || !stats.success) return;

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card"><div>👥 Utilisateurs</div><div class="stat-value">${stats.stats.totalUsers}</div></div>
        <div class="stat-card"><div>🚰 Machines</div><div class="stat-value">${stats.stats.totalMachines}</div></div>
        <div class="stat-card"><div>📝 Transactions</div><div class="stat-value">${stats.stats.totalTransactions}</div></div>
        <div class="stat-card"><div>💰 CA Total</div><div class="stat-value">${formatMoney(stats.stats.totalRevenue)} FCFA</div></div>
        <div class="stat-card"><div>📡 En ligne</div><div class="stat-value">${stats.stats.onlineMachines}</div></div>
        <div class="stat-card"><div>🟢 Actifs aujourd'hui</div><div class="stat-value">${stats.stats.activeToday}</div></div>
    `;

    // Graphique revenus
    const ctx = document.getElementById('revenueChart')?.getContext('2d');
    if (ctx && stats.stats.revenueByMethod && stats.stats.revenueByMethod.length > 0) {
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: stats.stats.revenueByMethod.map(m => {
                    const labels = { 'PHYSICAL_COIN': 'Pièces', 'WAVE': 'Wave', 'ORANGE_MONEY': 'Orange', 'BACKEND_TEST': 'Test' };
                    return labels[m._id] || m._id || 'Autre';
                }),
                datasets: [{
                    data: stats.stats.revenueByMethod.map(m => m.total),
                    backgroundColor: ['#f39c12', '#1DC9A0', '#f5576c', '#667eea', '#999']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    }
                }
            }
        });
    }
}

// ============================================
// UTILISATEURS (avec pagination)
// ============================================
async function loadUsers() {
    const data = await apiFetch('/api/admin/users');
    if (!data || !data.success) return;
    allUsers = data.users || [];
    usersPage = 1;
    renderUsers();
}

function renderUsers() {
    const tbody = document.getElementById('usersBody');
    const pageUsers = allUsers.slice(0, usersPage * ITEMS_PER_PAGE);
    const hasMore = allUsers.length > pageUsers.length;

    tbody.innerHTML = pageUsers.map(u => `
        <tr>
            <td>${u.name || 'N/A'}</td>
            <td>${u.email || 'N/A'}</td>
            <td><span class="badge-mqtt badge-${u.role === 'ADMIN' ? 'connected' : 'unknown'}">${u.role}</span></td>
            <td>${u.machineCount || 0}</td>
            <td>${u.transactionCount || 0}</td>
            <td>${u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : 'Jamais'}</td>
        </tr>
    `).join('');

    // Bouton "Voir plus"
    if (hasMore) {
        const remaining = allUsers.length - pageUsers.length;
        tbody.innerHTML += `<tr><td colspan="6" style="text-align:center;padding:10px;">
            <button class="btn-load-more" onclick="usersPage++;renderUsers();">
                Voir plus (${remaining} restants)
            </button>
        </td></tr>`;
    }
}

// ============================================
// MACHINES (avec pagination)
// ============================================
async function loadMachines() {
    const data = await apiFetch('/api/admin/machines');
    if (!data || !data.success) return;
    allMachines = data.machines || [];
    machinesPage = 1;
    renderMachines();
}

function renderMachines() {
    const tbody = document.getElementById('machinesBody');
    const pageMachines = allMachines.slice(0, machinesPage * ITEMS_PER_PAGE);
    const hasMore = allMachines.length > pageMachines.length;

    tbody.innerHTML = pageMachines.map(m => `
        <tr>
            <td>${m.machineId || 'N/A'}</td>
            <td>${m.name || 'N/A'}</td>
            <td>${m.owner?.name || 'N/A'}</td>
            <td>${m.mqttOnline ? '🟢' : '🔴'}</td>
            <td>${m.transactionCount || 0}</td>
            <td>${m.status || 'N/A'}</td>
        </tr>
    `).join('');

    if (hasMore) {
        const remaining = allMachines.length - pageMachines.length;
        tbody.innerHTML += `<tr><td colspan="6" style="text-align:center;padding:10px;">
            <button class="btn-load-more" onclick="machinesPage++;renderMachines();">
                Voir plus (${remaining} restantes)
            </button>
        </td></tr>`;
    }
}

// ============================================
// TRANSACTIONS (avec pagination)
// ============================================
async function loadTransactions() {
    const data = await apiFetch('/api/admin/transactions');
    if (!data || !data.success) return;
    allTransactions = data.transactions || [];
    transactionsPage = 1;
    renderTransactions();
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    const pageTx = allTransactions.slice(0, transactionsPage * ITEMS_PER_PAGE);
    const hasMore = allTransactions.length > pageTx.length;

    tbody.innerHTML = pageTx.map(t => `
        <tr>
            <td>#${(t._id || '').slice(-6)}</td>
            <td>${formatMoney(t.amountFcfa || t.montant || 0)} F</td>
            <td>${t.paymentMethod || 'N/A'}</td>
            <td>${t.machineId || 'N/A'}</td>
            <td>${t.status || 'N/A'}</td>
            <td>${t.createdAt ? new Date(t.createdAt).toLocaleString('fr-FR') : 'N/A'}</td>
        </tr>
    `).join('');

    if (hasMore) {
        const remaining = allTransactions.length - pageTx.length;
        tbody.innerHTML += `<tr><td colspan="6" style="text-align:center;padding:10px;">
            <button class="btn-load-more" onclick="transactionsPage++;renderTransactions();">
                Voir plus (${remaining} restantes)
            </button>
        </td></tr>`;
    }
}

// ============================================
// DÉCONNEXION
// ============================================
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Initialisation
loadAll();