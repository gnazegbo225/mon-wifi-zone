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

// body : un objet (envoyé en JSON) ou un FormData (envoi de fichier ; le navigateur pose
// lui-même le Content-Type multipart avec sa frontière).
async function request(path, { method = 'GET', body, auth = true } = {}) {
  const isForm = body instanceof FormData;
  const headers = { Accept: 'application/json' };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined || isForm ? body : JSON.stringify(body),
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

// Accepte la version en vigueur des conditions générales (promoteur) → user
export async function acceptTerms(version) {
  const data = await request('/auth/terms/accept', { method: 'POST', body: { version } });
  return data.user;
}

// --- Mot de passe oublié et confirmation de l'adresse -----------------------------

// Toujours la même réponse, que le compte existe ou non → { message }
export function forgotPassword(email) {
  return request('/auth/password/forgot', { method: 'POST', body: { email }, auth: false });
}

// Nouveau mot de passe avec le lien reçu par email.
export function resetPassword(token, password) {
  return request('/auth/password/reset', { method: 'POST', body: { token, password }, auth: false });
}

// Lien de confirmation de l'adresse → { email }
export function verifyEmail(token) {
  return request('/auth/email/verify', { method: 'POST', body: { token }, auth: false });
}

// Renvoie le lien de confirmation à l'adresse du compte connecté → { email }
export function resendEmailVerification() {
  return request('/auth/email/verify/resend', { method: 'POST', body: {} });
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

// --- Tickets ---------------------------------------------------------------

// Envoie un fichier CSV (colonnes Username, Password, Profile) pour une zone.
// Renvoie le rapport : { imported, duplicates, profiles_without_pricing, invalid_lines }.
export async function importTickets(zoneId, file) {
  const form = new FormData();
  form.append('zone_id', zoneId);
  form.append('file', file);
  const data = await request('/tickets/import', { method: 'POST', body: form });
  return data.report;
}

// Nombre de tickets libres, réservés et vendus, forfait par forfait. Jamais les identifiants.
export async function getTicketStock(zoneId) {
  const query = zoneId ? `?zone_id=${encodeURIComponent(zoneId)}` : '';
  const data = await request(`/tickets/stock${query}`);
  return data.stock;
}

// --- Parcours client (sans connexion) ---------------------------------------

// La zone, ses forfaits en vente et le nombre de tickets disponibles pour chacun.
export async function getPublicZone(zoneId) {
  return request(`/public/zones/${encodeURIComponent(zoneId)}`, { auth: false });
}

// Réserve un ticket et renvoie { payment_id, checkout_url } (page de paiement Moneroo).
export async function createPaymentIntent({ zoneId, pricingId, phone }) {
  return request('/public/payments/intent', {
    method: 'POST',
    body: { zone_id: zoneId, pricing_id: pricingId, phone },
    auth: false,
  });
}

// Statut du paiement : { payment: { status, … }, ticket: { username, password } | null }.
export async function getPaymentStatus(paymentId) {
  return request(`/public/payments/${encodeURIComponent(paymentId)}`, { auth: false });
}

// « Récupérer mon ticket » : achats réussis des 7 derniers jours avec ce numéro, sur cette zone.
// → { zone, purchases: [{ payment_id, completed_at, amount, pricing_name, pricing_duration_label, ticket|null }], router_host, days }
export async function retrieveTickets(zoneId, phone) {
  return request(`/public/zones/${encodeURIComponent(zoneId)}/retrieve`, { method: 'POST', body: { phone }, auth: false });
}

// --- Inscription et dossier du promoteur --------------------------------------

// Pays ouverts aux inscriptions : [{ code, name }].
export async function getCountries() {
  const data = await request('/auth/countries', { auth: false });
  return data.countries;
}

// account : { full_name, email, password, phone, country }. Connecte le promoteur tout de suite.
export async function register(account) {
  const data = await request('/auth/register', { method: 'POST', body: account, auth: false });
  saveToken(data.token, true);
  return data.user;
}

// { account_status, editable, submitted_at, rejection_reason, profile, documents: { id_front, id_back, selfie } }
export function getVendorProfile() {
  return request('/vendor/profile');
}

export function updateVendorProfile(fields) {
  return request('/vendor/profile', { method: 'PUT', body: fields });
}

// kind : id_front | id_back | selfie
export function uploadVendorDocument(kind, file) {
  const form = new FormData();
  form.append('file', file);
  return request(`/vendor/profile/documents/${encodeURIComponent(kind)}`, { method: 'POST', body: form });
}

export function submitVendorProfile() {
  return request('/vendor/profile/submit', { method: 'POST' });
}

// --- Argent du promoteur ----------------------------------------------------

// { balance: { pending_amount, available_amount, in_withdrawal, withdrawn, gross_sales, commissions },
//   rules: { commission_percent, min_withdrawal, hold_hours }, account_status, payout_account }
export function getVendorBalance() {
  return request('/vendor/balance');
}

// { sales: [...], totals: { count, gross, commission, net }, page, has_more }
export function getVendorSales({ page = 1, from, to, zoneId } = {}) {
  const query = new URLSearchParams({ page: String(page) });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (zoneId) query.set('zone_id', zoneId);
  return request(`/vendor/sales?${query}`);
}

// Ventes des 6 derniers mois : [{ month: '2026-11', tickets, amount, net }]
export async function getVendorMonthlySales() {
  const data = await request('/vendor/sales/monthly');
  return data.months;
}

export async function getVendorWithdrawals() {
  const data = await request('/vendor/withdrawals');
  return data.withdrawals;
}

// Le retrait part vers le compte de retrait vérifié du dossier. Renvoie { withdrawal, balance }.
export function requestVendorWithdrawal(amount) {
  return request('/vendor/withdrawals', { method: 'POST', body: { amount } });
}

export function cancelVendorWithdrawal(id) {
  return request(`/vendor/withdrawals/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

// Change l'adresse de connexion : { new_email, confirm_email, password } → user
export async function updateMyEmail(values) {
  const data = await request('/auth/email', { method: 'PUT', body: values });
  return data.user;
}

// --- Employés du promoteur ----------------------------------------------------

// period : today | 7d | 30d | month
// { employees: [{ id, full_name, email, phone, active, online, last_seen_at, zone_ids, shared_zone_ids,
//   sales: { count, amount, by_zone, by_pricing } }], zones: [{ id, name, is_active }], period, max }
export function getEmployees(period = 'today') {
  return request(`/vendor/employees?period=${encodeURIComponent(period)}`);
}

// Zones confiées à l'employé (liste vide : il voit toutes les zones) → { zone_ids }
export function setEmployeeZones(id, zoneIds) {
  return request(`/vendor/employees/${encodeURIComponent(id)}/zones`, { method: 'PUT', body: { zone_ids: zoneIds } });
}

// employee : { full_name, email, phone, password } (mot de passe provisoire)
export async function createEmployee(employee) {
  const data = await request('/vendor/employees', { method: 'POST', body: employee });
  return data.employee;
}

export async function setEmployeeActive(id, active) {
  const data = await request(`/vendor/employees/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { active } });
  return data.employee;
}

export function resetEmployeePassword(id, password) {
  return request(`/vendor/employees/${encodeURIComponent(id)}/password`, { method: 'POST', body: { password } });
}
