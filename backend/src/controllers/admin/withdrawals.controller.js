// Espace super admin : demandes de retrait des promoteurs (/api/admin/withdrawals).
// Le super admin approuve, fait le transfert à la main, puis le marque payé avec sa référence.
const supabase = require('../../config/supabase');
const { getBalance, setWithdrawalStatus } = require('../../services/ledger');
const { sendHttpError } = require('../../services/rpc');
const { record } = require('../../services/audit');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['pending', 'approved', 'paid', 'rejected', 'cancelled'];
const COLUMNS =
  'id, vendor_id, amount, method, destination_phone, bank_name, account_holder, account_number, status, requested_at, reviewed_by, reviewed_at, paid_by, paid_at, transfer_reference, admin_note, rejection_reason, cancelled_at';
const NOT_FOUND = { error: 'Retrait introuvable.' };

// Nom, email et téléphone des promoteurs (et des super admins qui ont agi).
async function people(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const [{ data: users, error }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase.from('users').select('id, full_name, email, phone, account_status').in('id', unique),
    supabase.from('vendor_profiles').select('user_id, legal_name').in('user_id', unique),
  ]);
  if (error) throw error;
  if (profilesError) throw profilesError;
  const legal = new Map(profiles.map((p) => [p.user_id, p.legal_name]));
  return new Map(users.map((u) => [u.id, { ...u, legal_name: legal.get(u.id) || null }]));
}

function withVendor(w, map) {
  const v = map.get(w.vendor_id) || {};
  return { ...w, vendor: { id: w.vendor_id, name: v.legal_name || v.full_name || null, email: v.email || null, phone: v.phone || null } };
}

// GET /api/admin/withdrawals?status=pending (plusieurs : status=rejected,cancelled)
// En attente et approuvés : les plus anciens d'abord (à traiter). Les autres : les plus récents d'abord.
async function listWithdrawals(req, res) {
  const statuses = String(req.query.status || 'pending').split(',');
  if (!statuses.every((s) => STATUSES.includes(s))) return res.status(400).json({ error: 'Statut inconnu.' });
  const toProcess = statuses.every((s) => s === 'pending' || s === 'approved');

  const { data, error } = await supabase
    .from('withdrawals')
    .select(COLUMNS)
    .in('status', statuses)
    .order('requested_at', { ascending: toProcess })
    .limit(200);
  if (error) throw error;
  const map = await people(data.map((w) => w.vendor_id));
  const withdrawals = data.map((w) => withVendor(w, map));
  res.json({ withdrawals, total: withdrawals.reduce((sum, w) => sum + w.amount, 0) });
}

// GET /api/admin/withdrawals/:id : la demande, le promoteur, son solde et l'historique.
async function getWithdrawal(req, res) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json(NOT_FOUND);

  const { data: w, error } = await supabase.from('withdrawals').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!w) return res.status(404).json(NOT_FOUND);

  const { data: events, error: eventsError } = await supabase
    .from('withdrawal_events')
    .select('from_status, to_status, actor_id, note, created_at')
    .eq('withdrawal_id', id)
    .order('created_at', { ascending: true });
  if (eventsError) throw eventsError;

  const map = await people([w.vendor_id, ...events.map((e) => e.actor_id)]);
  res.json({
    withdrawal: withVendor(w, map),
    vendor_balance: await getBalance(w.vendor_id),
    events: events.map((e) => ({ ...e, actor_name: map.get(e.actor_id)?.full_name || null })),
  });
}

async function move(req, res, status, { reference, note }) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json(NOT_FOUND);
  const text = (v) => (typeof v === 'string' ? v.trim() : null);
  const { httpError, data: w } = await setWithdrawalStatus(id, status, req.user.id, { reference: text(reference), note: text(note) });
  if (httpError) return sendHttpError(res, httpError);
  const map = await people([w.vendor_id]);
  await record(req, `withdrawal.${status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'paid'}`, {
    targetType: 'withdrawal',
    targetId: id,
    details: {
      vendor_name: map.get(w.vendor_id)?.legal_name || map.get(w.vendor_id)?.full_name,
      amount: w.amount,
      method: w.method,
      transfer_reference: w.transfer_reference || undefined,
      reason: w.rejection_reason || undefined,
    },
  });
  return getWithdrawal(req, res);
}

// POST /api/admin/withdrawals/:id/approve { note? }
const approveWithdrawal = (req, res) => move(req, res, 'approved', { note: req.body?.note });
// POST /api/admin/withdrawals/:id/reject { reason }
const rejectWithdrawal = (req, res) => move(req, res, 'rejected', { note: req.body?.reason });
// POST /api/admin/withdrawals/:id/mark-paid { transfer_reference, note? }
const markWithdrawalPaid = (req, res) =>
  move(req, res, 'paid', { reference: req.body?.transfer_reference, note: req.body?.note });

module.exports = { listWithdrawals, getWithdrawal, approveWithdrawal, rejectWithdrawal, markWithdrawalPaid };
