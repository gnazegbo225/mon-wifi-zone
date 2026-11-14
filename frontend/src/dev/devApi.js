// Seul fichier de l'espace développeur qui parle au backend (/api/dev).
// Séparé des espaces promoteur et super admin : autre jeton, autre stockage.
// Le jeton ne vit que dans cet onglet (sessionStorage) et expire au bout d'une heure côté serveur.
import { ApiError } from '../services/api';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'mwz_dev_token';

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getDevToken() {
  return storage()?.getItem(TOKEN_KEY) || null;
}

export function devLogout() {
  storage()?.removeItem(TOKEN_KEY);
}

let onUnauthorized = null;
export function setDevUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getDevToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}/dev${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Serveur injoignable');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && auth) {
      devLogout();
      onUnauthorized?.();
    }
    throw new ApiError(response.status, data?.error || `Erreur ${response.status}`, data?.field || null);
  }
  return data;
}

// Étape 1 : mot de passe → jeton intermédiaire.
export async function devLogin(email, password) {
  const data = await request('/auth/login', { method: 'POST', body: { email, password }, auth: false });
  return data.mfa_token;
}

// Étape 2 : code à 6 chiffres → ouvre la session.
export async function devVerifyCode(mfaToken, code) {
  const data = await request('/auth/mfa', { method: 'POST', body: { mfa_token: mfaToken, code }, auth: false });
  storage()?.setItem(TOKEN_KEY, data.token);
  return data.user;
}

export async function getDevMe() {
  const data = await request('/auth/me');
  return data.user;
}

// { api, database, config, webhooks, stats, stuck_minutes }
export function getOverview() {
  return request('/overview');
}

// { ok, reason, http_status, latency_ms }
export function checkMoneroo() {
  return request('/moneroo');
}

// view : stuck | no_ticket | failed | recent ; q : identifiant, identifiant Moneroo ou chiffres du numéro
export function listPayments({ view = 'stuck', q = '', page = 1 } = {}) {
  const params = new URLSearchParams({ view, page: String(page) });
  if (q) params.set('q', q);
  return request(`/payments?${params}`);
}

// { payment, ticket, events }
export function getPayment(id) {
  return request(`/payments/${encodeURIComponent(id)}`);
}

// { result: { outcome, status, remote_status }, payment, ticket, events }
export function syncPayment(id) {
  return request(`/payments/${encodeURIComponent(id)}/sync`, { method: 'POST', body: {} });
}

// source : webhook | return_page | developer ; problems : seulement les problèmes
export function listEvents({ source = '', problems = false, page = 1 } = {}) {
  const params = new URLSearchParams({ page: String(page) });
  if (source) params.set('source', source);
  if (problems) params.set('problems', '1');
  return request(`/events?${params}`);
}
