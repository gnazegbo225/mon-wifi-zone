// Espace promoteur : son argent (/api/vendor/balance, /sales, /withdrawals).
// Les montants viennent du registre financier (migration 007) ; rien n'est calculé à la main ici,
// sauf les totaux d'affichage des ventes.
const supabase = require('../config/supabase');
const { getBalance, requestWithdrawal, setWithdrawalStatus } = require('../services/ledger');
const { sendHttpError } = require('../services/rpc');
const { maskPhone } = require('../utils/phone');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 20;
const WITHDRAWAL_COLUMNS =
  'id, amount, method, destination_phone, bank_name, account_holder, account_number, status, requested_at, reviewed_at, paid_at, transfer_reference, rejection_reason, cancelled_at';

async function settings() {
  const { data, error } = await supabase.from('platform_settings').select('key, value');
  if (error) throw error;
  return Object.fromEntries(data.map((s) => [s.key, s.value]));
}

async function payoutAccount(vendorId) {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('payout_method, payout_phone, bank_name, account_holder, account_number')
    .eq('user_id', vendorId)
    .maybeSingle();
  if (error) throw error;
  return data?.payout_method ? data : null;
}

// GET /api/vendor/balance : les quatre montants, les règles de retrait et le compte de retrait vérifié.
async function getMyBalance(req, res) {
  const [balance, s, payout] = await Promise.all([getBalance(req.user.id), settings(), payoutAccount(req.user.id)]);
  res.json({
    balance,
    rules: {
      commission_percent: (s.commission_rate_bps ?? 0) / 100,
      min_withdrawal: s.min_withdrawal ?? 0,
      hold_hours: s.hold_hours ?? 0,
    },
    account_status: req.user.accountStatus,
    payout_account: payout,
  });
}

// GET /api/vendor/sales?page=1&from=2026-11-01&to=2026-11-30&zone_id=…
// Ventes réussies des zones du promoteur, les plus récentes d'abord, avec les totaux de la période.
async function listSales(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const { from, to, zone_id: zoneId } = req.query;
  if (zoneId !== undefined && !UUID_REGEX.test(zoneId)) return res.status(400).json({ error: 'zone_id invalide' });
  for (const [name, value] of [['from', from], ['to', to]]) {
    if (value !== undefined && Number.isNaN(Date.parse(value))) return res.status(400).json({ error: `${name} invalide` });
  }

  const filter = (query) => {
    let q = query.eq('owner_id', req.user.id).eq('status', 'completed');
    if (from) q = q.gte('completed_at', new Date(from).toISOString());
    if (to) q = q.lt('completed_at', new Date(new Date(to).getTime() + 24 * 3600 * 1000).toISOString());
    if (zoneId) q = q.eq('wifi_zone_id', zoneId);
    return q;
  };

  const [{ data: rows, error }, { data: all, error: totalsError }, { data: zones, error: zonesError }, s] = await Promise.all([
    filter(
      supabase
        .from('payments')
        .select('id, completed_at, amount, commission_amount, pricing_name, pricing_duration_label, payment_method, phone, wifi_zone_id'),
    )
      .order('completed_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    filter(supabase.from('payments').select('amount, commission_amount')),
    supabase.from('wifi_zones').select('id, name').eq('owner_id', req.user.id),
    settings(),
  ]);
  if (error) throw error;
  if (totalsError) throw totalsError;
  if (zonesError) throw zonesError;

  const zoneNames = new Map(zones.map((z) => [z.id, z.name]));
  const holdMs = (s.hold_hours ?? 0) * 3600 * 1000;
  const gross = all.reduce((sum, p) => sum + p.amount, 0);
  const commission = all.reduce((sum, p) => sum + (p.commission_amount || 0), 0);

  res.json({
    sales: rows.map((p) => ({
      id: p.id,
      completed_at: p.completed_at,
      available_at: new Date(new Date(p.completed_at).getTime() + holdMs).toISOString(),
      amount: p.amount,
      commission: p.commission_amount || 0,
      net: p.amount - (p.commission_amount || 0),
      pricing_name: p.pricing_name,
      duration: p.pricing_duration_label,
      method: p.payment_method,
      zone_name: zoneNames.get(p.wifi_zone_id) || null,
      customer: maskPhone(p.phone),
    })),
    totals: { count: all.length, gross, commission, net: gross - commission },
    page,
    has_more: page * PAGE_SIZE < all.length,
  });
}

// GET /api/vendor/sales/monthly : ventes des 6 derniers mois (graphique du tableau de bord).
async function monthlySales(req, res) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const { data, error } = await supabase
    .from('payments')
    .select('amount, commission_amount, completed_at')
    .eq('owner_id', req.user.id)
    .eq('status', 'completed')
    .gte('completed_at', start.toISOString());
  if (error) throw error;

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    return { month: d.toISOString().slice(0, 7), tickets: 0, amount: 0, net: 0 };
  });
  const byMonth = new Map(months.map((m) => [m.month, m]));
  for (const p of data) {
    const m = byMonth.get(new Date(p.completed_at).toISOString().slice(0, 7));
    if (!m) continue;
    m.tickets += 1;
    m.amount += p.amount;
    m.net += p.amount - (p.commission_amount || 0);
  }
  res.json({ months });
}

// GET /api/vendor/withdrawals : ses demandes de retrait, les plus récentes d'abord.
async function listMyWithdrawals(req, res) {
  const { data, error } = await supabase
    .from('withdrawals')
    .select(WITHDRAWAL_COLUMNS)
    .eq('vendor_id', req.user.id)
    .order('requested_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  res.json({ withdrawals: data });
}

// POST /api/vendor/withdrawals { amount }
// L'argent part toujours vers le compte de retrait vérifié du dossier : on ne choisit pas une
// autre destination au moment du retrait (sinon la vérification ne servirait à rien).
async function createWithdrawal(req, res) {
  const amount = req.body?.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Le montant doit être un nombre entier de FCFA.', field: 'amount' });
  }
  const payout = await payoutAccount(req.user.id);
  if (!payout) {
    return res.status(400).json({ error: 'Ajoute ton compte de retrait dans Mon compte.', field: 'destination' });
  }

  const { httpError, data } = await requestWithdrawal(req.user.id, {
    amount,
    method: payout.payout_method,
    phone: payout.payout_phone,
    bankName: payout.bank_name,
    accountHolder: payout.account_holder,
    accountNumber: payout.account_number,
  });
  if (httpError) return sendHttpError(res, httpError);
  res.status(201).json({ withdrawal: data, balance: await getBalance(req.user.id) });
}

// POST /api/vendor/withdrawals/:id/cancel : tant qu'elle est en attente.
async function cancelWithdrawal(req, res) {
  if (!UUID_REGEX.test(req.params.id)) return res.status(404).json({ error: 'Retrait introuvable.' });
  const { httpError, data } = await setWithdrawalStatus(req.params.id, 'cancelled', req.user.id);
  if (httpError) return sendHttpError(res, httpError);
  res.json({ withdrawal: data, balance: await getBalance(req.user.id) });
}

module.exports = { getMyBalance, listSales, monthlySales, listMyWithdrawals, createWithdrawal, cancelWithdrawal };
