// Statut « réel » d'un ticket pour les comptages.
// Une réservation dont reserved_until est dépassé compte comme libre (même règle
// que reserve_ticket dans la base) : le ticket peut être revendu.
function whereTicketStatus(query, status, now = new Date()) {
  const nowIso = now.toISOString();
  if (status === 'free') {
    return query.or(`status.eq.free,and(status.eq.reserved,reserved_until.lt.${nowIso})`);
  }
  if (status === 'reserved') {
    return query.eq('status', 'reserved').gte('reserved_until', nowIso);
  }
  return query.eq('status', status);
}

module.exports = { whereTicketStatus };
