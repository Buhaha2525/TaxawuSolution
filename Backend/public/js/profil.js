const API_URL = '';

// ============================================
// CHARGER LE PROFIL
// ============================================
async function loadProfile() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('profileInfo').innerHTML = `
                    <div class="profile-info-item">
                        <div class="label">Nom</div>
                        <div class="value">${data.user.name || 'N/A'}</div>
                    </div>
                    <div class="profile-info-item">
                        <div class="label">Email</div>
                        <div class="value">${data.user.email || 'N/A'}</div>
                    </div>
                    <div class="profile-info-item">
                        <div class="label">Téléphone</div>
                        <div class="value">${data.user.phone || 'N/A'}</div>
                    </div>
                    <div class="profile-info-item">
                        <div class="label">Entreprise</div>
                        <div class="value">${data.user.companyName || 'N/A'}</div>
                    </div>
                    <div class="profile-info-item">
                        <div class="label">Rôle</div>
                        <div class="value">${data.user.role || 'N/A'}</div>
                    </div>
                    <div class="profile-info-item">
                        <div class="label">Machines</div>
                        <div class="value">${data.machineCount || 0}</div>
                    </div>
                    <div class="profile-info-item full-width">
                        <div class="label">Dernière connexion</div>
                        <div class="value">${data.user.lastLogin ? new Date(data.user.lastLogin).toLocaleString('fr-FR') : 'N/A'}</div>
                    </div>
                `;
        }
    } catch (error) {
        console.error('Erreur chargement profil:', error);
    }
}

// ============================================
// CHANGER LE MOT DE PASSE
// ============================================
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const msg = document.getElementById('passwordMsg');

    // Réinitialiser le message
    msg.className = 'msg';
    msg.style.display = 'none';

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        msg.className = 'msg msg-error';
        msg.textContent = 'Veuillez remplir tous les champs.';
        msg.style.display = 'block';
        return;
    }

    if (newPassword.length < 6) {
        msg.className = 'msg msg-error';
        msg.textContent = 'Le nouveau mot de passe doit contenir au moins 6 caractères.';
        msg.style.display = 'block';
        return;
    }

    if (newPassword !== confirmPassword) {
        msg.className = 'msg msg-error';
        msg.textContent = 'Les mots de passe ne correspondent pas.';
        msg.style.display = 'block';
        return;
    }

    // Appel API
    const token = localStorage.getItem('token');
    msg.className = 'msg msg-info';
    msg.textContent = '⏳ Changement en cours...';
    msg.style.display = 'block';

    try {
        const res = await fetch(`${API_URL}/api/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();

        if (data.success) {
            msg.className = 'msg msg-success';
            msg.textContent = '✅ Mot de passe changé avec succès !';
            msg.style.display = 'block';
            // Vider les champs
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            msg.className = 'msg msg-error';
            msg.textContent = data.message || 'Erreur lors du changement de mot de passe.';
            msg.style.display = 'block';
        }
    } catch (error) {
        msg.className = 'msg msg-error';
        msg.textContent = 'Erreur de connexion au serveur.';
        msg.style.display = 'block';
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

// Charger le profil au démarrage
loadProfile();