const API_URL = '';

// Attendre que le DOM soit prêt
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    if (!form) return;

    // Rediriger si déjà connecté
    if (localStorage.getItem('token')) {
        window.location.href = '/dashboard';
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const phone = document.getElementById('phone').value.trim().replace(/[\s\+\-\.\(\)]/g, '');
        const companyName = document.getElementById('companyName').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        const errorDiv = document.getElementById('errorMsg');
        const spinner = document.getElementById('spinner');
        const button = form.querySelector('button');

        errorDiv.style.display = 'none';

        if (!name || name.length < 2) return showError(errorDiv, 'Le nom doit contenir au moins 2 caractères.');
        if (!email || !email.includes('@')) return showError(errorDiv, 'Email invalide.');
        if (!/^[0-9]{9,13}$/.test(phone)) return showError(errorDiv, 'Téléphone invalide (9-13 chiffres).');
        if (!password || password.length < 6) return showError(errorDiv, 'Mot de passe : 6 caractères minimum.');
        if (password !== confirmPassword) return showError(errorDiv, 'Les mots de passe ne correspondent pas.');

        spinner.style.display = 'block';
        button.disabled = true;

        const body = { name, email, phone, password };
        if (companyName) body.companyName = companyName;

        try {
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/dashboard';
            } else {
                showError(errorDiv, data.errors ? data.errors.map(e => e.msg).join(', ') : data.message);
            }
        } catch (error) {
            showError(errorDiv, 'Erreur de connexion au serveur.');
        } finally {
            spinner.style.display = 'none';
            button.disabled = false;
        }
    });
});

function showError(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
}