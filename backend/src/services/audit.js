// Journal des actions du super admin (table audit_log, migration 010), en ajout seulement.
// On enregistre après une action réussie. Si l'écriture du journal échoue, l'action reste faite
// (l'argent a déjà bougé, par exemple) : on le signale dans les journaux du serveur.
const supabase = require('../config/supabase');

/**
 * @param {object} req requête Express (auteur et adresse IP)
 * @param {string} action ex : vendor.approve, withdrawal.paid, adjustment.create
 * @param {{ targetType?: string, targetId?: string, details?: object, actorId?: string }} [target]
 *   actorId : auteur, quand req.user n'existe pas encore (connexion).
 */
async function record(req, action, { targetType = null, targetId = null, details = {}, actorId = null } = {}) {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: actorId || req.user.id,
    action,
    target_type: targetType,
    target_id: targetId ? String(targetId) : null,
    details,
    ip: req.ip || null,
  });
  if (error) console.error(`Journal : action ${action} non enregistrée`, error.message);
}

module.exports = { record };
