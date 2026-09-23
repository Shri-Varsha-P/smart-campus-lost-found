function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function getToken() {
    return localStorage.getItem('token');
}

function isAuthenticated() {
    return !!getToken();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

function requireRole(allowedRoles) {
    if (!requireAuth()) {
        return false;
    }
    
    const user = getCurrentUser();
    if (!allowedRoles.includes(user.role)) {
        window.location.href = '/';
        return false;
    }
    return true;
}

function updateAuthUI() {
    const user = getCurrentUser();
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    const logoutLink = document.getElementById('logoutLink');
    const userInfo = document.getElementById('userInfo');
    
    if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (signupLink) signupLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'inline';
        if (userInfo) {
            userInfo.style.display = 'inline';
            userInfo.textContent = `Welcome, ${user.name} (${user.role})`;
        }
    } else {
        if (loginLink) loginLink.style.display = 'inline';
        if (signupLink) signupLink.style.display = 'inline';
        if (logoutLink) logoutLink.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
    }
}

function makeAuthenticatedRequest(url, options = {}) {
    const token = getToken();
    if (!token) {
        window.location.href = '/login.html';
        return Promise.reject(new Error('Not authenticated'));
    }
    
    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${token}`;
    
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    options.headers = headers;
    
    return fetch(url, options);
}

document.addEventListener('DOMContentLoaded', function() {
    updateAuthUI();
    
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
});
