// Seul fichier du frontend qui parle au backend.
// Le frontend ne parle jamais directement à Supabase : tout passe par l'API.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'mwz_token';

if (!API_URL) {
  console.error('VITE_API_URL manque dans frontend/.env');
}

// Erreur renvoyée par toutes les fonctions de ce fichier.
// status vaut 0 quand le serveur n'a pas pu être joint (pas de réseau, serveur arrêté).
// field indique le champ refusé par le backend (ex : 'amount'), quand il le précise.
export class ApiError extends Error {
  constructor(status, message, field = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
  }
}

// --- Token -----------------------------------------------------------------
// « Rester connecté » coché : localStorage (survit à la fermeture du navigateur).
// Sinon : sessionStorage (effacé à la fermeture de l'onglet).

function safeStorage(kind) {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  return safeStorage('session')?.getItem(TOKEN_KEY) || safeStorage('local')?.getItem(TOKEN_KEY) || null;
}

function saveToken(token, remember) {
  clearToken();
  safeStorage(remember ? 'local' : 'session')?.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  safeStorage('local')?.removeItem(TOKEN_KEY);
  safeStorage('session')?.removeItem(TOKEN_KEY);
}

// Appelé quand le backend répond 401 sur une route protégée (token expiré ou invalide).
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// --- Requête générique ----------------------------------------------------

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Serveur injoignable');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearToken();
      onUnauthorized?.();
    }
    throw new ApiError(response.status, data?.error || `Erreur ${response.status}`, data?.field || null);
  }

  return data;
}

// --- Authentification ------------------------------------------------------

export async function login(email, password, remember = false) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  saveToken(data.token, remember);
  return data.user;
}

export async function getMe() {
  const data = await request('/auth/me');
  return data.user;
}

export function logout() {
  clearToken();
}

// --- Données ---------------------------------------------------------------

// Le token est envoyé s'il existe : un admin reçoit aussi les zones désactivées,
// avec is_active et stats (forfaits et tickets reliés à chaque zone).
export async function getZones() {
  const data = await request('/zones');
  return data.zones;
}

// zone : { name, city, country }
export async function createZone(zone) {
  const data = await request('/zones', { method: 'POST', body: zone });
  return data.zone;
}

export async function updateZone(id, zone) {
  const data = await request(`/zones/${encodeURIComponent(id)}`, { method: 'PUT', body: zone });
  return data.zone;
}

// Pas de suppression : on active ou on désactive.
export async function setZoneActive(id, isActive) {
  const data = await request(`/zones/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
  });
  return data.zone;
}

// Le token est envoyé s'il existe : un admin reçoit aussi les forfaits désactivés
// (avec is_active et ticket_profile). Les autres ne reçoivent que les forfaits actifs.
export async function getPricings(zoneId) {
  const query = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : '';
  const data = await request(`/pricings${query}`);
  return data.pricings;
}

// pricing : { wifi_zone_id, name, amount, duration_label, speed_label, ticket_profile }
export async function createPricing(pricing) {
  const data = await request('/pricings', { method: 'POST', body: pricing });
  return data.pricing;
}

export async function updatePricing(id, pricing) {
  const data = await request(`/pricings/${encodeURIComponent(id)}`, { method: 'PUT', body: pricing });
  return data.pricing;
}

// Pas de suppression : on active ou on désactive.
export async function setPricingActive(id, isActive) {
  const data = await request(`/pricings/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
  });
  return data.pricing;
}
