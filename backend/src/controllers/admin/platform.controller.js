// Espace super admin : tous les paiements (/api/admin/transactions) et toutes les zones (/api/admin/zones).
const supabase = require('../../config/supabase');
const { callRpc } = require('../../services/rpc');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'cancelled'];
const PAGE_SIZE = 50;
const DAY = 24 * 3600 * 1000;

async function namesOf(table, ids, column = 'name') {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from(table).select(`id, ${column}`).in('id', unique);
  if (error) throw error;
  return new Map(data.map((r) => [r.id, r[column]]));
}

// Filtres de la page Transactions, vérifiés. Renvoie { filters } ou { error }.
function readFilters(query) {
  const { from, to, status, vendor_id: vendorId, zone_id: zoneId } = query;
  if (status && !PAYMENT_STATUSES.includes(status)) return { error: 'Statut inconnu.' };
  if (vendorId && !UUID_REGEX.test(vendorId)) return { error: 'vendor_id invalide' };
  if (zoneId && !UUID_REGEX.test(zoneId)) return { error: 'zone_id invalide' };
  for (const [name, value] of [['from', from], ['to', to]]) {
    if (value && Number.isNaN(Date.parse(value))) return { error: `${name} invalide` };
  }
  return {
    filters: {
      from: from ? new Date(from).toISOString() : null,
      // « au 14 novembre » : jusqu'à la fin de cette journée.
      to: to ? new Date(new Date(to).getTime() + DAY).toISOString() : null,
      status: status || null,
      vendorId: vendorId || null,
      zoneId: zoneId || null,
    },
  };
}

// GET /api/admin/transactions?from=2026-11-01&to=2026-11-14&status=completed&vendor_id=…&zone_id=…&page=1
// Tous les paiements, les plus récents d'abord (50 par page), avec les totaux des filtres.
async function listTransactions(req, res) {
  const { filters, error: filterError } = readFilters(req.query);
  if (filterError) return res.status(400).json({ error: filterError });
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

  let query = supabase
    .from('payments')
    .select(
      'id, created_at, completed_at, status, amount, commission_amount, pricing_name, pricing_duration_label, payment_method, phone, provider_payment_id, transaction_id, owner_id, wifi_zone_id',
    );
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lt('created_at', filters.to);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.vendorId) query = query.eq('owner_id', filters.vendorId);
  if (filters.zoneId) query = query.eq('wifi_zone_id', filters.zoneId);

  const [{ data: rows, error }, { data: summary }] = await Promise.all([
    query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    callRpc('admin_transactions_summary', {
      p_from: filters.from,
      p_to: filters.to,
      p_status: filters.status,
      p_vendor_id: filters.vendorId,
      p_zone_id: filters.zoneId,
    }),
  ]);
  if (error) throw error;

  const [vendors, zones] = await Promise.all([
    namesOf('users', rows.map((r) => r.owner_id), 'full_name'),
    namesOf('wifi_zones', rows.map((r) => r.wifi_zone_id)),
  ]);
  const totals = (Array.isArray(summary) ? summary[0] : summary) || {};
  const totalCount = Number(totals.total_count || 0);

  res.json({
    transactions: rows.map((r) => ({
      ...r,
      commission_amount: r.commission_amount ?? null,
      vendor_name: vendors.get(r.owner_id) || null,
      zone_name: zones.get(r.wifi_zone_id) || null,
    })),
    totals: {
      count: totalCount,
      completed: Number(totals.completed_count || 0),
      gross: Number(totals.gross || 0),
      commission: Number(totals.commission || 0),
    },
    page,
    has_more: page * PAGE_SIZE < totalCount,
  });
}

// GET /api/admin/zones : toutes les zones, avec leur promoteur, leur stock et leurs ventes sur 30 jours.
async function listAllZones(req, res) {
  const [{ data: zones, error }, { data: stats }] = await Promise.all([
    supabase
      .from('wifi_zones')
      .select('id, name, city, country, is_active, owner_id, router_host, manager_phone, created_at')
      .order('name'),
    callRpc('admin_zone_stats', {}),
  ]);
  if (error) throw error;
  const owners = await namesOf('users', zones.map((z) => z.owner_id), 'full_name');
  const byZone = new Map((stats || []).map((s) => [s.zone_id, s]));

  res.json({
    zones: zones.map((z) => {
      const s = byZone.get(z.id) || {};
      return {
        ...z,
        owner_name: owners.get(z.owner_id) || null,
        pricings_active: Number(s.pricings_active || 0),
        tickets_free: Number(s.tickets_free || 0),
        tickets_reserved: Number(s.tickets_reserved || 0),
        tickets_sold: Number(s.tickets_sold || 0),
        sales_30d: Number(s.sales_30d || 0),
        gross_30d: Number(s.gross_30d || 0),
      };
    }),
  });
}

module.exports = { listTransactions, listAllZones };
