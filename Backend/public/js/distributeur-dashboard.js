const API_URL = '';
const REFRESH_INTERVAL = 15000;
const ITEMS_PER_PAGE = 5;

let state = {
    transactions: [],
    events: [],
    mqttConnected: false,
    machineState: null,
    currentFilter: 'all',
    refreshTimer: null,
};
let transactionsPage = 1, eventsPage = 1;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard Distributeur initialisé');
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login'; return; }
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            document.getElementById('userName').textContent = user.name || user.email;
            document.getElementById('welcomeName').textContent = user.name || user.email;

            // 🆕 Afficher le lien Admin si ADMIN
            const adminLink = document.getElementById('adminLink');
            if (adminLink) {
                adminLink.style.display = user.role === 'ADMIN' ? 'flex' : 'none';
            }
        } catch (e) {}
    }

    loadAllData();
    state.refreshTimer = setInterval(loadAllData, REFRESH_INTERVAL);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            transactionsPage = 1;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            state.currentFilter = this.dataset.filter;
            renderTransactions();
        });
    });
    // 🆕 Enregistrer le Service Worker pour la PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('✅ Service Worker enregistré:', reg.scope))
                .catch(err => console.log('❌ Service Worker erreur:', err));
        });
    }
});

async function loadAllData() {
    console.log('🔄 Chargement des données...');
    try {
        const token = localStorage.getItem('token');
        const [txRes, mqttRes, evRes] = await Promise.all([
            fetch(`${API_URL}/api/payments`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/api/machine/mqtt-status`),
            fetch(`${API_URL}/api/machine/events`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const txData = await txRes.json();
        const mqttData = await mqttRes.json();
        const evData = await evRes.json();

        console.log('📊 Transactions:', txData.count, '| MQTT:', mqttData.mqttConnected, '| Events:', evData.count);

        if (txData.success) state.transactions = txData.transactions || [];
        if (mqttData.success) {
            state.mqttConnected = mqttData.mqttConnected || false;
            state.machineState = mqttData.machineState || null;
        }
        if (evData.success) state.events = evData.events || [];
        transactionsPage = 1; eventsPage = 1;
        updateUI();
    } catch (error) { console.error('❌ Erreur chargement:', error); }
}

function updateUI() { updateStatusBadges(); updateStats(); renderTransactions(); renderEvents(); }

function updateStatusBadges() {
    const mqttBadge = document.getElementById('mqttStatus');
    if (!mqttBadge) return;

    mqttBadge.className = 'badge-mqtt';
    if (state.mqttConnected) {
        mqttBadge.classList.add('badge-connected');
        mqttBadge.innerHTML = '<i class="fas fa-circle"></i> MQTT Connecté';
    } else {
        mqttBadge.classList.add('badge-disconnected');
        mqttBadge.innerHTML = '<i class="fas fa-circle"></i> MQTT Déconnecté';
    }
}

function updateStats() {
    const transactions = state.transactions;
    document.getElementById('totalTransactions').textContent = transactions.length;

    const totalRevenue = transactions
        .filter(t => ['SUCCESS','SENT','DISPENSE_SENT','PAID','COMPLETED'].includes(t.status))
        .reduce((sum, t) => sum + (t.amountFcfa || t.montant || 0), 0);
    document.getElementById('totalRevenue').textContent = formatMoney(totalRevenue) + ' FCFA';

    const successCount = transactions.filter(t => ['SUCCESS','SUCCES','COMPLETED'].includes(t.status)).length;
    const rate = transactions.length > 0 ? Math.round((successCount / transactions.length) * 100) : 0;
    document.getElementById('successRate').textContent = rate + '%';

    const machineStateEl = document.getElementById('machineState');
    if (!state.machineState) {
        machineStateEl.textContent = 'Inconnu';
        machineStateEl.style.color = '#ff9800';
    } else if (state.machineState.canDispense) {
        machineStateEl.textContent = 'Disponible';
        machineStateEl.style.color = '#4CAF50';
    } else {
        machineStateEl.textContent = 'Indisponible';
        machineStateEl.style.color = '#f44336';
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;
    let transactions = state.transactions;
    if (state.currentFilter === 'COMPLETED') transactions = transactions.filter(t => ['SUCCESS','SUCCES','COMPLETED','DISPENSE_SENT'].includes(t.status));
    else if (state.currentFilter === 'FAILED') transactions = transactions.filter(t => ['FAILED','PAYMENT_FAILED','REFUND_REQUIRED'].includes(t.status));
    else if (state.currentFilter === 'PENDING') transactions = transactions.filter(t => ['PENDING','PENDING_PAYMENT','SENT','DETECTED'].includes(t.status));
    tbody.innerHTML = '';
    if (transactions.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#999;"><i class="fas fa-inbox"></i> Aucune transaction</td></tr>`; return; }
    const pageTransactions = transactions.slice(0, transactionsPage * ITEMS_PER_PAGE);
    const hasMore = transactions.length > pageTransactions.length;
    pageTransactions.forEach(t => {
        const shortId = (t._id || t.transactionId || 'N/A').slice(-8);
        const amount = t.amountFcfa || t.montant || 0;
        const method = t.paymentMethod || 'UNKNOWN';
        const status = t.status || 'PENDING';
        const date = t.createdAt ? new Date(t.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'N/A';
        const row = document.createElement('tr');
        row.innerHTML = `<td title="${t._id || ''}">#${shortId}</td><td><strong>${formatMoney(amount)}</strong></td><td><span class="method-${method}">${getMethodLabel(method)}</span></td><td><span class="status-${status}">${getStatusLabel(status)}</span></td><td>${date}</td><td><button class="btn-view" data-id="${t._id || t.transactionId}"><i class="fas fa-eye"></i></button></td>`;
        row.querySelector('.btn-view').addEventListener('click', function() { viewTransaction(this.dataset.id); });
        tbody.appendChild(row);
    });
    if (hasMore) { const remaining = transactions.length - pageTransactions.length; const row = document.createElement('tr'); row.innerHTML = `<td colspan="6" style="text-align:center;padding:12px;"><button onclick="transactionsPage++;renderTransactions();" style="background:#667eea;color:white;border:none;padding:10px 24px;border-radius:20px;cursor:pointer;">Voir plus (${remaining} restantes)</button></td>`; tbody.appendChild(row); }
}

function renderEvents() {
    const tbody = document.getElementById('eventsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!state.events || state.events.length === 0) { tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:30px;color:#999;"><i class="fas fa-inbox"></i> Aucun événement</td></tr>`; return; }
    const pageEvents = state.events.slice(0, eventsPage * ITEMS_PER_PAGE);
    const hasMore = state.events.length > pageEvents.length;
    pageEvents.forEach(e => {
        const type = e.type || e.eventType || 'UNKNOWN';
        const details = getEventDetails(e);
        const date = e.createdAt ? new Date(e.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) : 'N/A';
        const row = document.createElement('tr');
        row.innerHTML = `<td><span class="badge badge-unknown">${type}</span></td><td style="font-size:12px;">${details}</td><td style="font-size:11px;">${date}</td>`;
        tbody.appendChild(row);
    });
    if (hasMore) { const remaining = state.events.length - pageEvents.length; const row = document.createElement('tr'); row.innerHTML = `<td colspan="3" style="text-align:center;padding:12px;"><button onclick="eventsPage++;renderEvents();" style="background:#667eea;color:white;border:none;padding:10px 24px;border-radius:20px;cursor:pointer;">Voir plus (${remaining} restants)</button></td>`; tbody.appendChild(row); }
}

function getMethodLabel(method) {
    const labels = { 'PHYSICAL_COIN':'Pièce', 'WAVE':'Wave', 'ORANGE_MONEY':'Orange', 'BACKEND_TEST':'Test' };
    return labels[method] || method || 'Inconnu';
}

function getStatusLabel(status) {
    const labels = {
        'SUCCESS':'Succès','SUCCES':'Succès','COMPLETED':'Terminé','DISPENSE_SENT':'Distribué','PAID':'Payé',
        'FAILED':'Échec','PAYMENT_FAILED':'Échec','REFUND_REQUIRED':'Remboursement',
        'PENDING':'En attente','PENDING_PAYMENT':'Attente','SENT':'Envoyé','DETECTED':'Détecté'
    };
    return labels[status] || status || 'Inconnu';
}

function getEventDetails(event) {
    if (event.amountFcfa) return `💰 ${event.amountFcfa} FCFA | ⚡ ${event.pulseCount || 0} imp.`;
    if (event.state) return `État: ${event.state}`;
    if (event.message) return event.message;
    return JSON.stringify(event).substring(0, 80);
}

function formatMoney(amount) { return amount ? amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '0'; }

async function viewTransaction(id) {
    if (!id) return;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/payments/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success && data.transaction) {
            const t = data.transaction;
            const amount = t.amountFcfa || t.montant || 0;
            document.getElementById('transactionDetails').innerHTML = `
                <p><strong>ID:</strong> ${t._id || t.transactionId || 'N/A'}</p>
                <p><strong>Montant:</strong> ${formatMoney(amount)} FCFA</p>
                <p><strong>Statut:</strong> <span class="status-${t.status || 'PENDING'}">${getStatusLabel(t.status)}</span></p>
                <p><strong>Méthode:</strong> ${getMethodLabel(t.paymentMethod)}</p>
                <p><strong>Machine:</strong> ${t.machineId || 'N/A'}</p>
                <p><strong>Date:</strong> ${t.createdAt ? new Date(t.createdAt).toLocaleString('fr-FR') : 'N/A'}</p>`;
            document.getElementById('transactionModal').style.display = 'flex';
        }
    } catch (error) { showToast('Erreur chargement détails', 'error'); }
}

function closeTransactionModal() { document.getElementById('transactionModal').style.display = 'none'; }
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.className = 'toast';
    toast.classList.add(`toast-${type}`, 'show');
    toast.textContent = message;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 4000);
}
function refreshAllData() { showToast('Actualisation...', 'info'); loadAllData(); }
function logout() { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; }
window.addEventListener('beforeunload', () => { if (state.refreshTimer) clearInterval(state.refreshTimer); });