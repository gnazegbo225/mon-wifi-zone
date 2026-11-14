// Espace super admin : vue d'ensemble de la plateforme (/api/admin/overview).
// Les chiffres sont calculés par Postgres (admin_overview, migration 009).
const { callRpc } = require('../../services/rpc');

const PERIODS = ['today', '7d', '30d', 'month', 'all'];
const DAY = 24 * 3600 * 1000;

// Début de la période (UTC = heure de la Côte d'Ivoire). null = depuis la première vente.
function periodStart(period, now = new Date()) {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  switch (period) {
    case 'today':
      return new Date(midnight);
    case '7d':
      return new Date(midnight - 6 * DAY);
    case '30d':
      return new Date(midnight - 29 * DAY);
    case 'month':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    default:
      return null;
  }
}

// GET /api/admin/overview?period=today|7d|30d|month|all (30d par défaut)
async function getOverview(req, res) {
  const period = req.query.period || '30d';
  if (!PERIODS.includes(period)) return res.status(400).json({ error: 'Période inconnue.' });

  const from = periodStart(period);
  const { data } = await callRpc('admin_overview', { p_from: from ? from.toISOString() : null, p_to: new Date().toISOString() });
  const w = data.withdrawals;
  const inWithdrawal = Number(w.pending_amount) + Number(w.approved_amount);
  res.json({
    period,
    ...data,
    owed: {
      ...data.owed,
      in_withdrawal: inWithdrawal,
      // Tout ce que la plateforme doit encore verser aux promoteurs.
      total: Number(data.owed.available) + Number(data.owed.pending) + inWithdrawal,
    },
  });
}

module.exports = { getOverview, periodStart };
