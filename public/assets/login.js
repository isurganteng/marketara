const TOKEN_KEY = 'marketara.token';
const PROFILE_KEY = 'marketara.profile';
const API_BASE = '/api/v1';

const form = document.querySelector('#login-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const rememberInput = document.querySelector('#remember');
const submitButton = document.querySelector('#submit-button');
const alertBox = document.querySelector('#alert');
const alertMessage = document.querySelector('#alert-message');
const togglePassword = document.querySelector('#toggle-password');
const fillDemoButton = document.querySelector('#fill-demo');
const emailError = document.querySelector('#email-error');
const passwordError = document.querySelector('#password-error');

function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
}

function saveSession(token, profile, remember) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function isAdminProfile(profile) {
  const permissions = Array.isArray(profile?.permissions) ? profile.permissions : [];
  return permissions.includes('*') || permissions.includes('audit:read');
}

function showAlert(message) {
  alertMessage.textContent = message;
  alertBox.hidden = false;
}

function hideAlert() {
  alertBox.hidden = true;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.classList.toggle('loading', isLoading);
  submitButton.querySelector('.button-label').textContent = isLoading
    ? 'Memeriksa akun…'
    : 'Masuk ke dashboard';
}

function fieldError(input, message) {
  const wrap = input.closest('.input-wrap');
  const error = input === emailInput ? emailError : passwordError;
  wrap?.classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  error.textContent = message ?? '';
  error.hidden = !message;
}

function clearErrors() {
  fieldError(emailInput, '');
  fieldError(passwordInput, '');
}

function translateError(message) {
  const translations = {
    'Email or password is incorrect': 'Email atau password salah. Silakan coba lagi.',
    'User account is not active': 'Akun ini sedang tidak aktif. Hubungi administrator.',
    'Session is invalid or has expired': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  };
  return translations[message] ?? message ?? 'Terjadi kesalahan. Silakan coba lagi.';
}

async function fetchProfile(token) {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'Session check failed');
  }
  return body.data;
}

async function redirectIfSignedIn() {
  const token = getToken();
  if (!token) return;

  try {
    const profile = await fetchProfile(token);
    if (!isAdminProfile(profile)) {
      clearSession();
      return;
    }
    const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.location.replace('/admin');
  } catch {
    clearSession();
  }
}

function handleInitialMessage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('expired') === '1') {
    showAlert('Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.');
  } else if (params.get('forbidden') === '1') {
    showAlert('Akun ini tidak memiliki akses ke dashboard administrator.');
  }
}

togglePassword.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  togglePassword.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
  togglePassword.querySelector('.eye-open').hidden = show;
  togglePassword.querySelector('.eye-off').hidden = !show;
  passwordInput.focus();
});

fillDemoButton.addEventListener('click', () => {
  emailInput.value = 'admin@marketara.local';
  passwordInput.value = 'Admin12345!';
  clearErrors();
  hideAlert();
  passwordInput.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert();
  clearErrors();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  let valid = true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldError(emailInput, 'Masukkan alamat email yang valid.');
    valid = false;
  }
  if (!password) {
    fieldError(passwordInput, 'Password wajib diisi.');
    valid = false;
  }
  if (!valid) return;

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error?.message ?? 'Login gagal');
    }

    const data = body.data;
    if (!isAdminProfile(data)) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { authorization: `Bearer ${data.token}` },
      }).catch(() => {});
      showAlert('Akun ini tidak memiliki akses ke dashboard administrator.');
      setLoading(false);
      return;
    }

    const profile = {
      user: data.user,
      permissions: data.permissions,
      organizations: data.organizations,
      expiresAt: data.expiresAt,
    };

    saveSession(data.token, profile, rememberInput.checked);
    window.location.replace('/admin');
  } catch (error) {
    showAlert(translateError(error.message));
    setLoading(false);
    passwordInput.select();
  }
});

emailInput.addEventListener('input', () => fieldError(emailInput, ''));
passwordInput.addEventListener('input', () => fieldError(passwordInput, ''));

handleInitialMessage();
void redirectIfSignedIn();
