// Espace super admin : promoteurs et vérification de leur dossier (/api/admin/vendors).
const supabase = require('../../config/supabase');
const { callRpc, sendHttpError } = require('../../services/rpc');
const { signedUrl } = require('../../services/kycStorage');
const { addAdjustment } = require('../../services/ledger');
const { record } = require('../../services/audit');
const { employeesWithSales } = require('../vendorEmployees.controller');
const { notify } = require('../../services/notify');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['pending_review', 'approved', 'rejected', 'suspended'];

// Ce que le super admin vérifie avant d'approuver. Tous les points doivent être cochés.
const CHECKLIST = ['id_readable', 'name_matches', 'selfie_matches', 'payout_matches'];

const USER_COLUMNS = 'id, email, full_name, phone, country, account_status, created_at, last_login_at, last_seen_at';
const PROFILE_COLUMNS =
  'user_id, legal_name, business_name, city, id_type, id_number, id_front_path, id_back_path, selfie_path, payout_method, payout_phone, bank_name, account_holder, account_number, submitted_at, reviewed_by, reviewed_at, rejection_reason';

const NOT_FOUND = { error: 'Promoteur introuvable.' };
const ONLINE_MS = 5 * 60 * 1000; // vu dans les 5 dernières minutes = en ligne

// Nom à afficher dans le journal : celui de la CNI (dossier) s'il existe, sinon celui de l'inscription.
async function vendorLabel(id) {
  const [{ data: user }, { data: profile }] = await Promise.all([
    supabase.from('users').select('full_name, email').eq('id', id).maybeSingle(),
    supabase.from('vendor_profiles').select('legal_name').eq('user_id', id).maybeSingle(),
  ]);
  return { vendor_name: profile?.legal_name || user?.full_name || null, email: user?.email || null };
}

const isOnline = (lastSeen) => Boolean(lastSeen) && Date.now() - new Date(lastSeen).getTime() < ONLINE_MS;

// Zones, ventes et soldes calculés par Postgres (admin_vendor_stats, migration 009), par promoteur.
async function vendorStats(vendorId = null) {
  const { data } = await callRpc('admin_vendor_stats', { p_vendor_id: vendorId });
  return new Map(
    (data || []).map((r) => [
      r.vendor_id,
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === 'vendor_id' || k === 'last_sale_at' ? v : Number(v)])),
    ]),
  );
}

// GET /api/admin/vendors?status=pending_review&submitted=true
//   status : un statut de compte (facultatif) ; submitted=true : seulement les dossiers envoyés.
async function listVendors(req, res) {
  const { status, submitted } = req.query;
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: 'Statut inconnu.' });

  let query = supabase.from('users').select(USER_COLUMNS).eq('role', 'vendor').order('created_at', { ascending: false });
  if (status) query = query.eq('account_status', status);
  const { data: users, error } = await query;
  if (error) throw error;
  if (users.length === 0) return res.json({ vendors: [] });

  const [{ data: profiles, error: profilesError }, stats] = await Promise.all([
    supabase
      .from('vendor_profiles')
      .select('user_id, legal_name, business_name, city, submitted_at, reviewed_at')
      .in('user_id', users.map((u) => u.id)),
    vendorStats(),
  ]);
  if (profilesError) throw profilesError;
  const byUser = new Map(profiles.map((p) => [p.user_id, p]));

  let vendors = users.map((u) => {
    const p = byUser.get(u.id) || {};
    return {
      ...u,
      online: isOnline(u.last_seen_at),
      legal_name: p.legal_name || null,
      business_name: p.business_name || null,
      city: p.city || null,
      submitted_at: p.submitted_at || null,
      reviewed_at: p.reviewed_at || null,
      stats: stats.get(u.id) || null,
    };
  });
  if (submitted === 'true') {
    // Les dossiers les plus anciens d'abord : ce sont eux qui attendent depuis le plus longtemps.
    vendors = vendors.filter((v) => v.submitted_at).sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
  }
  res.json({ vendors });
}

// GET /api/admin/vendors/:id : compte, dossier, liens temporaires vers les pièces, historique.
async function getVendor(req, res) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json(NOT_FOUND);

  const { data: user, error } = await supabase.from('users').select(USER_COLUMNS).eq('id', id).eq('role', 'vendor').maybeSingle();
  if (error) throw error;
  if (!user) return res.status(404).json(NOT_FOUND);

  const [
    { data: profile, error: profileError },
    { data: events, error: eventsError },
    { data: zones, error: zonesError },
    { data: withdrawals, error: withdrawalsError },
    { data: sales, error: salesError },
    stats,
    { data: zoneStats },
  ] = await Promise.all([
    supabase.from('vendor_profiles').select(PROFILE_COLUMNS).eq('user_id', id).maybeSingle(),
    supabase
      .from('verification_events')
      .select('from_status, to_status, kind, note, checklist, actor_id, created_at')
      .eq('vendor_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('wifi_zones').select('id, name, city, is_active, created_at').eq('owner_id', id).order('name'),
    supabase
      .from('withdrawals')
      .select('id, amount, method, status, requested_at, paid_at, transfer_reference')
      .eq('vendor_id', id)
      .order('requested_at', { ascending: false })
      .limit(20),
    supabase
      .from('payments')
      .select('id, completed_at, amount, commission_amount, pricing_name, wifi_zone_id, payment_method')
      .eq('owner_id', id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10),
    vendorStats(id),
    callRpc('admin_zone_stats', {}),
  ]);
  // Employés, leurs zones et leurs ventes (= ventes de leurs zones) du jour et des 30 derniers jours.
  const [today, month] = await Promise.all([employeesWithSales(id, 'today'), employeesWithSales(id, '30d')]);
  const month30 = new Map(month.employees.map((e) => [e.id, e.sales]));
  const { data: adjustments, error: adjustmentsError } = await supabase
    .from('ledger_entries')
    .select('id, amount, note, created_by, created_at')
    .eq('vendor_id', id)
    .eq('type', 'adjustment')
    .order('created_at', { ascending: false });
  if (adjustmentsError) throw adjustmentsError;
  if (profileError) throw profileError;
  if (eventsError) throw eventsError;
  if (zonesError) throw zonesError;
  if (withdrawalsError) throw withdrawalsError;
  if (salesError) throw salesError;
  const statsByZone = new Map((zoneStats || []).map((z) => [z.zone_id, z]));
  const zoneNames = new Map(zones.map((z) => [z.id, z.name]));

  const p = profile || {};
  const [idFront, idBack, selfie] = await Promise.all([signedUrl(p.id_front_path), signedUrl(p.id_back_path), signedUrl(p.selfie_path)]);
  const { id_front_path: _f, id_back_path: _b, selfie_path: _s, user_id: _u, ...fields } = p;

  res.json({
    vendor: { ...user, online: isOnline(user.last_seen_at) },
    profile: fields,
    documents: { id_front: idFront, id_back: idBack, selfie },
    checklist: CHECKLIST,
    events,
    stats: stats.get(id) || null,
    zones: zones.map((z) => {
      const zs = statsByZone.get(z.id) || {};
      return {
        ...z,
        pricings_active: Number(zs.pricings_active || 0),
        tickets_free: Number(zs.tickets_free || 0),
        tickets_sold: Number(zs.tickets_sold || 0),
        sales_30d: Number(zs.sales_30d || 0),
        gross_30d: Number(zs.gross_30d || 0),
      };
    }),
    withdrawals,
    recent_sales: sales.map((p) => ({ ...p, zone_name: zoneNames.get(p.wifi_zone_id) || null })),
    adjustments,
    employees: today.employees.map(({ sales, ...e }) => ({
      ...e,
      zone_names: e.zone_ids.map((z) => zoneNames.get(z)),
      sales_today: { count: sales.count, amount: sales.amount },
      sales_30d: { count: month30.get(e.id).count, amount: month30.get(e.id).amount },
    })),
  });
}

async function decide(req, res, status) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json(NOT_FOUND);

  const raw = req.body?.checklist && typeof req.body.checklist === 'object' ? req.body.checklist : {};
  const checklist = Object.fromEntries(CHECKLIST.map((k) => [k, raw[k] === true]));
  if (status === 'approved' && !CHECKLIST.every((k) => checklist[k])) {
    return res.status(400).json({ error: 'Coche chaque point de vérification avant d’approuver.', field: 'checklist' });
  }

  const note = typeof req.body?.reason === 'string' ? req.body.reason : null;
  const { httpError } = await callRpc('set_vendor_status', {
    p_vendor_id: id,
    p_status: status,
    p_actor_id: req.user.id,
    p_note: note,
    p_checklist: checklist,
  });
  if (httpError) return sendHttpError(res, httpError);
  await record(req, status === 'approved' ? 'vendor.approve' : 'vendor.reject', {
    targetType: 'vendor',
    targetId: id,
    details: { ...(await vendorLabel(id)), reason: note || undefined, checklist },
  });
  // Le promoteur est prévenu par email (sans attendre : un email raté ne bloque pas la décision).
  notify(id, status === 'approved' ? 'vendorApproved' : 'vendorRejected', { reason: note });
  return getVendor(req, res);
}

// POST /api/admin/vendors/:id/approve { checklist }
const approveVendor = (req, res) => decide(req, res, 'approved');
// POST /api/admin/vendors/:id/reject { reason, checklist }
const rejectVendor = (req, res) => decide(req, res, 'rejected');

// Suspendre (motif obligatoire) ou réactiver un promoteur approuvé. Une suspension coupe aussitôt
// l'accès du promoteur et de ses employés ; ses zones restent en ligne tant qu'on ne les désactive pas.
async function changeStatus(req, res, status) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json(NOT_FOUND);
  // Réactiver ne vaut que pour un compte suspendu : un dossier en attente passe par la vérification
  // (et sa liste de contrôle), jamais par ce raccourci.
  if (status === 'approved') {
    const { data: current, error } = await supabase.from('users').select('account_status').eq('id', id).eq('role', 'vendor').maybeSingle();
    if (error) throw error;
    if (!current) return res.status(404).json(NOT_FOUND);
    if (current.account_status !== 'suspended') {
      return res.status(409).json({ error: 'Seul un compte suspendu peut être réactivé.' });
    }
  }
  const note = typeof req.body?.reason === 'string' ? req.body.reason : null;
  const { httpError } = await callRpc('set_vendor_status', {
    p_vendor_id: id,
    p_status: status,
    p_actor_id: req.user.id,
    p_note: note,
    p_checklist: null,
  });
  if (httpError) return sendHttpError(res, httpError);
  await record(req, status === 'suspended' ? 'vendor.suspend' : 'vendor.reactivate', {
    targetType: 'vendor',
    targetId: id,
    details: { ...(await vendorLabel(id)), reason: note || undefined },
  });
  notify(id, status === 'suspended' ? 'vendorSuspended' : 'vendorReactivated', { reason: note });
  return getVendor(req, res);
}

// POST /api/admin/vendors/:id/suspend { reason }
const suspendVendor = (req, res) => changeStatus(req, res, 'suspended');
// POST /api/admin/vendors/:id/reactivate { reason? }
const reactivateVendor = (req, res) => changeStatus(req, res, 'approved');

// POST /api/admin/vendors/:id/adjustments { amount, note }
// Correction manuelle du solde : montant positif (crédit) ou négatif (débit), motif obligatoire.
// Disponible tout de suite ; inscrite au registre (ineffaçable) et au journal.
async function createAdjustment(req, res) {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(404).json(NOT_FOUND);
  const amount = req.body?.amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000) {
    return res.status(400).json({ error: 'Écris un montant entier en FCFA, différent de 0.', field: 'amount' });
  }
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (note.length > 300) return res.status(400).json({ error: 'Motif trop long (300 caractères maximum).', field: 'note' });

  const { httpError } = await addAdjustment(id, amount, req.user.id, note);
  if (httpError) return sendHttpError(res, httpError);
  await record(req, 'adjustment.create', {
    targetType: 'vendor',
    targetId: id,
    details: { ...(await vendorLabel(id)), amount, note },
  });
  return getVendor(req, res);
}

module.exports = { listVendors, getVendor, approveVendor, rejectVendor, suspendVendor, reactivateVendor, createAdjustment };
