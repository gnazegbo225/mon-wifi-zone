// Espace super admin : promoteurs et vérification de leur dossier (/api/admin/vendors).
const supabase = require('../../config/supabase');
const { callRpc, sendHttpError } = require('../../services/rpc');
const { signedUrl } = require('../../services/kycStorage');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['pending_review', 'approved', 'rejected', 'suspended'];

// Ce que le super admin vérifie avant d'approuver. Tous les points doivent être cochés.
const CHECKLIST = ['id_readable', 'name_matches', 'selfie_matches', 'payout_matches'];

const USER_COLUMNS = 'id, email, full_name, phone, country, account_status, created_at, last_login_at, last_seen_at';
const PROFILE_COLUMNS =
  'user_id, legal_name, business_name, city, id_type, id_number, id_front_path, id_back_path, selfie_path, payout_method, payout_phone, bank_name, account_holder, account_number, submitted_at, reviewed_by, reviewed_at, rejection_reason';

const NOT_FOUND = { error: 'Promoteur introuvable.' };

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

  const { data: profiles, error: profilesError } = await supabase
    .from('vendor_profiles')
    .select('user_id, legal_name, business_name, city, submitted_at, reviewed_at')
    .in('user_id', users.map((u) => u.id));
  if (profilesError) throw profilesError;
  const byUser = new Map(profiles.map((p) => [p.user_id, p]));

  let vendors = users.map((u) => {
    const p = byUser.get(u.id) || {};
    return {
      ...u,
      legal_name: p.legal_name || null,
      business_name: p.business_name || null,
      city: p.city || null,
      submitted_at: p.submitted_at || null,
      reviewed_at: p.reviewed_at || null,
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

  const [{ data: profile, error: profileError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from('vendor_profiles').select(PROFILE_COLUMNS).eq('user_id', id).maybeSingle(),
    supabase
      .from('verification_events')
      .select('from_status, to_status, kind, note, checklist, actor_id, created_at')
      .eq('vendor_id', id)
      .order('created_at', { ascending: true }),
  ]);
  if (profileError) throw profileError;
  if (eventsError) throw eventsError;

  const p = profile || {};
  const [idFront, idBack, selfie] = await Promise.all([signedUrl(p.id_front_path), signedUrl(p.id_back_path), signedUrl(p.selfie_path)]);
  const { id_front_path: _f, id_back_path: _b, selfie_path: _s, user_id: _u, ...fields } = p;

  res.json({
    vendor: user,
    profile: fields,
    documents: { id_front: idFront, id_back: idBack, selfie },
    checklist: CHECKLIST,
    events,
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
  return getVendor(req, res);
}

// POST /api/admin/vendors/:id/approve { checklist }
const approveVendor = (req, res) => decide(req, res, 'approved');
// POST /api/admin/vendors/:id/reject { reason, checklist }
const rejectVendor = (req, res) => decide(req, res, 'rejected');

module.exports = { listVendors, getVendor, approveVendor, rejectVendor };
