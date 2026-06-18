function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

function updateUI() {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const navLinks = document.getElementById('navLinks');
    const heroButtons = document.getElementById('heroButtons');

    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            navLinks.innerHTML = `
                <div class="user-info-header">
                    <span class="user-name-header"><i class="fas fa-user"></i> ${user.name || user.email}</span>
                    <a href="/dashboard" class="btn-dashboard"><i class="fas fa-chart-bar"></i> Dashboard</a>
                    <button onclick="logout()" class="btn-logout-header"><i class="fas fa-sign-out-alt"></i> Déco</button>
                </div>
            `;
            heroButtons.innerHTML = `
                <a href="/dashboard" class="btn-primary"><i class="fas fa-chart-bar"></i> Accéder au Dashboard</a>
            `;
        } catch(e) {}
    } else {
        navLinks.innerHTML = `
            <a href="/login" class="btn-login"><i class="fas fa-sign-in-alt"></i> Se connecter</a>
        `;
        heroButtons.innerHTML = `
            <a href="/register" class="btn-primary"><i class="fas fa-rocket"></i> Commencer gratuitement</a>
            <a href="#features" class="btn-secondary"><i class="fas fa-info-circle"></i> En savoir plus</a>
        `;
    }
}

// Animation au scroll
function initScrollAnimation() {
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.15 });

        document.querySelectorAll('.feature-card').forEach(card => {
            observer.observe(card);
        });
    } else {
        // Fallback pour vieux navigateurs
        document.querySelectorAll('.feature-card').forEach(card => {
            card.classList.add('visible');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    initScrollAnimation();
});

// Navbar scroll effect
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
}, { passive: true });