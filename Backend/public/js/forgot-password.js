const API_URL = '';

async function sendResetLink() {
    const email = document.getElementById('email').value;
    const msg = document.getElementById('msg1');

    if (!email) {
        msg.innerHTML = '<p style="color:red;">Veuillez entrer votre email</p>';
        return;
    }

    msg.innerHTML = '<p style="color:#666;">⏳ Envoi en cours...</p>';

    try {
        const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (data.success) {
            if (data.debugToken) {
                document.getElementById('token').value = data.debugToken;
            }
            document.getElementById('step1').style.display = 'none';
            document.getElementById('step2').style.display = 'block';
        } else {
            msg.innerHTML = `<p style="color:red;">${data.message}</p>`;
        }
    } catch (error) {
        msg.innerHTML = '<p style="color:red;">Erreur de connexion</p>';
    }
}

async function resetPassword() {
    const token = document.getElementById('token').value;
    const newPassword = document.getElementById('newPassword').value;
    const msg = document.getElementById('msg2');

    if (!token || !newPassword || newPassword.length < 6) {
        msg.innerHTML = '<p style="color:red;">Mot de passe minimum 6 caractères</p>';
        return;
    }

    msg.innerHTML = '<p style="color:#666;">⏳ Réinitialisation...</p>';

    try {
        const res = await fetch(`${API_URL}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('step2').style.display = 'none';
            document.getElementById('step3').style.display = 'block';
        } else {
            msg.innerHTML = `<p style="color:red;">${data.message}</p>`;
        }
    } catch (error) {
        msg.innerHTML = '<p style="color:red;">Erreur de connexion</p>';
    }
}