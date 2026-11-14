// Seul fichier de l'espace super admin qui parle au backend (/api/admin).
// Totalement séparé de l'espace promoteur (services/api.js) : autre jeton, autre stockage.
// Le jeton admin ne vit que dans cet onglet (sessionStorage) et expire au bout d'une heure côté serveur.
import { ApiError } from '../services/api';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'mwz_admin_token';

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getAdminToken() {
  return storage()?.getItem(TOKEN_KEY) || null;
}

export function adminLogout() {
  storage()?.removeItem(TOKEN_KEY);
}

let onUnauthorized = null;
export function setAdminUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getAdminToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}/admin${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Serveur injoignable');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && auth) {
      adminLogout();
      onUnauthorized?.();
    }
    throw new ApiError(response.status, data?.error || `Erreur ${response.status}`, data?.field || null);
  }
  return data;
}

// Étape 1 : mot de passe. Renvoie le jeton intermédiaire de la double authentification.
export async function adminLogin(email, password) {
  const data = await request('/auth/login', { method: 'POST', body: { email, password }, auth: false });
  return data.mfa_token;
}

// Étape 2 : code à 6 chiffres. Ouvre la session admin.
export async function adminVerifyCode(mfaToken, code) {
  const data = await request('/auth/mfa', { method: 'POST', body: { mfa_token: mfaToken, code }, auth: false });
  storage()?.setItem(TOKEN_KEY, data.token);
  return data.user;
}

export async function getAdminMe() {
  const data = await request('/auth/me');
  return data.user;
}

// --- Promoteurs et vérification ---------------------------------------------

// params : { status, submitted } → [{ id, full_name, email, phone, account_status, submitted_at, … }]
export async function listVendors({ status, submitted } = {}) {
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (submitted) query.set('submitted', 'true');
  const data = await request(`/vendors${query.size ? `?${query}` : ''}`);
  return data.vendors;
}

// { vendor, profile, documents: { id_front, id_back, selfie } (liens temporaires), checklist, events }
export function getVendor(id) {
  return request(`/vendors/${encodeURIComponent(id)}`);
}

export function approveVendor(id, checklist) {
  return request(`/vendors/${encodeURIComponent(id)}/approve`, { method: 'POST', body: { checklist } });
}

export function rejectVendor(id, reason, checklist) {
  return request(`/vendors/${encodeURIComponent(id)}/reject`, { method: 'POST', body: { reason, checklist } });
}

// --- Retraits --------------------------------------------------------------

// status : 'pending', 'approved', 'paid' ou 'rejected,cancelled' → { withdrawals, total }
export function listWithdrawals(status) {
  return request(`/withdrawals?status=${encodeURIComponent(status)}`);
}

// { withdrawal (avec vendor), vendor_balance, events }
export function getWithdrawal(id) {
  return request(`/withdrawals/${encodeURIComponent(id)}`);
}

export function approveWithdrawal(id, note) {
  return request(`/withdrawals/${encodeURIComponent(id)}/approve`, { method: 'POST', body: { note } });
}

export function rejectWithdrawal(id, reason) {
  return request(`/withdrawals/${encodeURIComponent(id)}/reject`, { method: 'POST', body: { reason } });
}

export function markWithdrawalPaid(id, transferReference, note) {
  return request(`/withdrawals/${encodeURIComponent(id)}/mark-paid`, {
    method: 'POST',
    body: { transfer_reference: transferReference, note },
  });
}

// --- Supervision ------------------------------------------------------------

// period : today | 7d | 30d | month | all
export function getOverview(period) {
  return request(`/overview?period=${encodeURIComponent(period)}`);
}

export function suspendVendor(id, reason) {
  return request(`/vendors/${encodeURIComponent(id)}/suspend`, { method: 'POST', body: { reason } });
}

export function reactivateVendor(id, reason) {
  return request(`/vendors/${encodeURIComponent(id)}/reactivate`, { method: 'POST', body: { reason } });
}

// filters : { from, to, status, vendorId, zoneId, page } → { transactions, totals, page, has_more }
export function listTransactions({ from, to, status, vendorId, zoneId, page = 1 } = {}) {
  const query = new URLSearchParams({ page: String(page) });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (status) query.set('status', status);
  if (vendorId) query.set('vendor_id', vendorId);
  if (zoneId) query.set('zone_id', zoneId);
  return request(`/transactions?${query}`);
}

export async function listAllZones() {
  const data = await request('/zones');
  return data.zones;
}
