// public/js/dashboard.js

const API_URL = "";

let statsGrid;
let machinesGrid;

let newMachineId;
let newMachineName;
let newMachineLocation;

let editMachineId;
let editMachineName;
let editMachineLocation;
let editMachineStatus;

let currentFilterMachineId = "";

document.addEventListener("DOMContentLoaded", () => {
    statsGrid = document.getElementById("statsGrid");
    machinesGrid = document.getElementById("machinesGrid");

    newMachineId = document.getElementById("newMachineId");
    newMachineName = document.getElementById("newMachineName");
    newMachineLocation = document.getElementById("newMachineLocation");

    editMachineId = document.getElementById("editMachineId");
    editMachineName = document.getElementById("editMachineName");
    editMachineLocation = document.getElementById("editMachineLocation");
    editMachineStatus = document.getElementById("editMachineStatus");

    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/login";
        return;
    }

    loadDashboard();
    loadMainMachineSelector();
    setInterval(() => loadDashboard(false), 10000);
});

function getToken() {
    return localStorage.getItem("token") || "";
}

async function apiFetch(url, options = {}) {
    const token = getToken();
    const response = await fetch(url, {
        ...options,
        cache: "no-store",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "Erreur API");
    return data;
}

// ============================================
// MACHINES
// ============================================

async function loadMyMachines() {
    try {
        const data = await apiFetch('/api/machine/mes-machines');
        return data.success ? data.machines : [];
    } catch (error) {
        return [];
    }
}

async function loadMainMachineSelector() {
    const machines = await loadMyMachines();
    const select = document.getElementById('machineSelector');
    if (select) {
        select.innerHTML = `<option value="">Toutes les machines</option>` +
            machines.map(m => `<option value="${m.machineId}">${escapeHtml(m.name || m.machineId)}</option>`).join('');
    }
}

function onMainMachineChange() {
    currentFilterMachineId = document.getElementById('machineSelector').value;
    loadDashboard();
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard(showError = true) {
    try {
        const data = await apiFetch(`${API_URL}/api/dashboard/stats?_=${Date.now()}`);
        if (data.success) updateUI(data.data);
    } catch (error) {
        console.error("Erreur dashboard:", error);
        if (showError) alert("Erreur: " + error.message);
    }
}

function updateUI(data) {
    document.getElementById("welcomeName").textContent = data.ownerName || "Utilisateur";
    document.getElementById("userName").textContent = data.ownerName || "Utilisateur";

    let machines = data.machines || [];
    if (currentFilterMachineId) {
        machines = machines.filter(m => m.machineId === currentFilterMachineId);
    }

    updateStats(data, machines);
    updateMachinesGrid(machines);
}

function updateStats(data, machines) {
    const stats = data.stats || {};
    statsGrid.innerHTML = `
        <div class="stat-card"><div>💰 Chiffre d'affaires</div><div class="stat-value">${formatMoney(stats.totalRevenue || 0)} FCFA</div></div>
        <div class="stat-card"><div>📝 Transactions</div><div class="stat-value">${stats.totalTransactions || 0}</div></div>
        <div class="stat-card"><div>✅ Succès</div><div class="stat-value">${stats.successTransactions || 0}</div></div>
        <div class="stat-card"><div>🚰 Machines</div><div class="stat-value">${machines.length}</div></div>
        <div class="stat-card"><div>📡 En ligne</div><div class="stat-value">${stats.onlineMachines || 0}/${data.machines?.length || 0}</div></div>
        <div class="stat-card"><div>✅ Disponibles</div><div class="stat-value">${stats.availableMachines || 0}/${data.machines?.length || 0}</div></div>
    `;
}
function updateMachinesGrid(machines) {
    if (!machinesGrid) return;
    if (!machines || machines.length === 0) {
        machinesGrid.innerHTML = `<p>Aucune machine.</p>`;
        return;
    }

    machinesGrid.innerHTML = machines.map(machine => {
        const runtime = machine.machineReady ? "✓ Disponible" : (!machine.mqttOnline ? "🔴 Hors ligne" : "⚠️ Indisponible");
        const runtimeClass = machine.machineReady ? "status-active" : (!machine.mqttOnline ? "status-inactive" : "status-maintenance");

        return `
            <div class="machine-card">
                <div class="machine-header">
                    <div><div class="machine-name">${escapeHtml(machine.name || machine.machineId)}</div><small>${escapeHtml(machine.machineId)}</small></div>
                    <div class="status ${runtimeClass}">${runtime}</div>
                </div>
                <p>📍 ${escapeHtml(machine.location || "Non défini")}</p>

                <!-- 🆕 Revenus par méthode -->
                <div class="revenue-breakdown">
                    <div class="revenue-item coin">
                        <span>🪙 Pièces</span>
                        <strong>${formatMoney(machine.coinRevenue || 0)} FCFA</strong>
                        <small>${machine.coinCount || 0} transactions</small>
                    </div>
                    <div class="revenue-item wave">
                        <span>🌊 Wave</span>
                        <strong>${formatMoney(machine.waveRevenue || 0)} FCFA</strong>
                        <small>${machine.waveCount || 0} transactions</small>
                    </div>
                    <div class="revenue-item om">
                        <span>🍊 Orange</span>
                        <strong>${formatMoney(machine.omRevenue || 0)} FCFA</strong>
                        <small>${machine.omCount || 0} transactions</small>
                    </div>
                </div>

                <!-- Total -->
                <div class="revenue-total">
                    <span>💰 Total</span>
                    <strong>${formatMoney(machine.totalRevenue || 0)} FCFA</strong>
                </div>

                <!-- 🆕 Graphique -->
                <div class="machine-chart">
                    <canvas id="chart-${machine.machineId}" width="300" height="150"></canvas>
                </div>

                <div class="machine-runtime-box">
                    <p><strong>MQTT:</strong> ${machine.mqttOnline ? "En ligne" : "Hors ligne"}</p>
                    <p><strong>Paiements:</strong> ${machine.machineCanAcceptPayment ? "Oui" : "Non"}</p>
                    <p><strong>Distribution:</strong> ${machine.canDispense ? "Oui" : "Non"}</p>
                </div>

                <div class="machine-actions">
                    <button class="edit-btn" onclick="openEditMachineModal('${machine.machineId}')">✏️</button>
                    <button class="delete-btn" onclick="confirmDeleteMachine('${machine.machineId}', '${escapeForJs(machine.name || machine.machineId)}')">🗑️</button>
                </div>
            </div>`;
    }).join('');

    // 🆕 Dessiner les graphiques
    machines.forEach(machine => {
        console.log('📊 Machine:', machine.machineId, 'dailyStats:', machine.dailyStats?.length);
        if (machine.dailyStats && machine.dailyStats.length > 0) {
            drawMachineChart(machine.machineId, machine.dailyStats);
        }
    });
}

// 🆕 Fonction pour dessiner le graphique
function drawMachineChart(machineId, dailyStats) {
    const canvas = document.getElementById(`chart-${machineId}`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dailyStats.map(d => d.date),
            datasets: [
                {
                    label: '🪙 Pièces',
                    data: dailyStats.map(d => d.coin),
                    backgroundColor: '#f39c12'
                },
                {
                    label: '🌊 Wave',
                    data: dailyStats.map(d => d.wave),
                    backgroundColor: '#1DC9A0'
                },
                {
                    label: '🍊 Orange',
                    data: dailyStats.map(d => d.om),
                    backgroundColor: '#f5576c'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } },
            scales: {
                x: { stacked: true, ticks: { font: { size: 8 } } },
                y: { stacked: true, ticks: { callback: v => v.toLocaleString() + ' F' } }
            }
        }
    });
}


function getRuntimeLabel(machine) {
    if (machine.machineReady) return "✓ Disponible";
    if (!machine.mqttOnline) return "🔴 Hors ligne";
    return "⚠️ Indisponible";
}

function getRuntimeClass(machine) {
    if (machine.machineReady) return "status-active";
    if (!machine.mqttOnline) return "status-inactive";
    return "status-maintenance";
}

// ============================================
// CRUD MACHINES
// ============================================

async function addMachine() {
    const machineId = newMachineId.value.trim().toUpperCase();
    const name = newMachineName.value.trim();
    const location = newMachineLocation.value.trim();
    if (!machineId || !name || !location) return alert("Tous les champs sont requis");

    try {
        const data = await apiFetch('/api/dashboard/add-machine', {
            method: 'POST',
            body: JSON.stringify({ machineId, name, location })
        });
        if (data.success) {
            alert("✅ Machine ajoutée");
            closeAddMachineModal();
            await loadDashboard();
            await loadMainMachineSelector();
        }
    } catch (error) { alert("Erreur: " + error.message); }
}

async function openEditMachineModal(machineId) {
    try {
        const data = await apiFetch(`/api/dashboard/machine/${machineId}?_=${Date.now()}`);
        if (data.success) {
            const m = data.machine;
            editMachineId.value = m.machineId;
            editMachineName.value = m.name || "";
            editMachineLocation.value = m.location || "";
            editMachineStatus.value = m.status || "ACTIVE";
            document.getElementById("editMachineModal").style.display = "flex";
        }
    } catch (error) { alert("Erreur: " + error.message); }
}

async function updateMachine() {
    const machineId = editMachineId.value;
    const name = editMachineName.value.trim();
    const location = editMachineLocation.value.trim();
    const status = editMachineStatus.value;
    if (!machineId || !name || !location) return alert("Tous les champs sont requis");

    try {
        const data = await apiFetch(`/api/dashboard/machine/${machineId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, location, status })
        });
        if (data.success) {
            alert("✅ Machine modifiée");
            closeEditMachineModal();
            await loadDashboard();
            await loadMainMachineSelector();
        }
    } catch (error) { alert("Erreur: " + error.message); }
}

function confirmDeleteMachine(machineId, machineName) {
    if (confirm(`⚠️ Supprimer "${machineName}" ?`)) deleteMachine(machineId);
}

async function deleteMachine(machineId) {
    try {
        const data = await apiFetch(`/api/dashboard/machine/${machineId}`, { method: 'DELETE' });
        if (data.success) {
            alert("✅ " + data.message);
            await loadDashboard();
            await loadMainMachineSelector();
        }
    } catch (error) { alert("Erreur: " + error.message); }
}

// ============================================
// UTILITAIRES
// ============================================

function formatMoney(amount) { return Number(amount || 0).toLocaleString("fr-FR"); }
function formatDate(date) { return date ? new Date(date).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "N/A"; }
function escapeHtml(v) { return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function escapeForJs(v) { return String(v ?? "").replaceAll("\\","\\\\").replaceAll("'","\\'"); }
function logout() { localStorage.removeItem("token"); localStorage.removeItem("user"); window.location.href = "/login"; }

function openAddMachineModal() { document.getElementById("addMachineModal").style.display = "flex"; }
function closeAddMachineModal() { document.getElementById("addMachineModal").style.display = "none"; }
function closeEditMachineModal() { document.getElementById("editMachineModal").style.display = "none"; }

window.loadDashboard = loadDashboard;
window.onMainMachineChange = onMainMachineChange;
window.addMachine = addMachine;
window.openEditMachineModal = openEditMachineModal;
window.updateMachine = updateMachine;
window.confirmDeleteMachine = confirmDeleteMachine;
window.deleteMachine = deleteMachine;
window.logout = logout;