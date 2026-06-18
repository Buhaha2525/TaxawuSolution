const API_URL = '';

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Récupérer les valeurs et les nettoyer
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const phone = document.getElementById('phone').value.trim().replace(/\s+/g, '');
    const companyName = document.getElementById('companyName').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const errorDiv = document.getElementById('errorMsg');
    const spinner = document.getElementById('spinner');
    const button = document.querySelector('button');

    // Cacher l'erreur précédente
    errorDiv.style.display = 'none';

    // Validation
    if (!name || name.length < 2) {
        errorDiv.textContent = 'Le nom doit contenir au moins 2 caractères.';
        errorDiv.style.display = 'block';
        return;
    }

    if (!email || !email.includes('@')) {
        errorDiv.textContent = 'Veuillez entrer un email valide.';
        errorDiv.style.display = 'block';
        return;
    }

    if (!phone || !/^[0-9]{9,13}$/.test(phone)) {
        errorDiv.textContent = 'Numéro de téléphone invalide (9 à 13 chiffres).';
        errorDiv.style.display = 'block';
        return;
    }

    if (!password || password.length < 6) {
        errorDiv.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
        errorDiv.style.display = 'block';
        return;
    }

    if (password !== confirmPassword) {
        errorDiv.textContent = 'Les mots de passe ne correspondent pas.';
        errorDiv.style.display = 'block';
        return;
    }

    // Afficher le spinner
    spinner.style.display = 'block';
    button.disabled = true;
    button.textContent = 'Création en cours...';

    // Construire le body
    const body = {
        name: name,
        email: email,
        phone: phone,
        password: password
    };

    // Ajouter companyName seulement s'il n'est pas vide
    if (companyName) {
        body.companyName = companyName;
    }

    console.log('📤 Envoi inscription:', { ...body, password: '***' });

    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log('📥 Réponse:', data);

        if (data.success) {
            // Sauvegarder le token
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Rediriger vers le dashboard
            window.location.href = '/dashboard';
        } else {
            // Afficher l'erreur
            errorDiv.textContent = data.message || 'Erreur lors de l\'inscription.';
            if (data.errors) {
                errorDiv.textContent = data.errors.map(e => e.msg).join(', ');
            }
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('❌ Erreur réseau:', error);
        errorDiv.textContent = 'Erreur de connexion au serveur. Vérifiez votre connexion internet.';
        errorDiv.style.display = 'block';
    } finally {
        spinner.style.display = 'none';
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-user-plus"></i> Créer mon compte';
    }
});

// Rediriger si déjà connecté
if (localStorage.getItem('token')) {
    window.location.href = '/dashboard';
}