const API_URL = '';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    document.getElementById('errorMsg').style.display = 'none';
    document.getElementById('spinner').style.display = 'block';
    document.querySelector('button').disabled = true;

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/dashboard';
        } else {
            const errorDiv = document.getElementById('errorMsg');
            errorDiv.textContent = data.message;
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        const errorDiv = document.getElementById('errorMsg');
        errorDiv.textContent = 'Erreur de connexion au serveur';
        errorDiv.style.display = 'block';
    } finally {
        document.getElementById('spinner').style.display = 'none';
        document.querySelector('button').disabled = false;
    }
});

// Vérifier si déjà connecté
if (localStorage.getItem('token')) {
    window.location.href = '/dashboard';
}