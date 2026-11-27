import { prisma } from '../config/database.js';
import { safeMessage } from '../utils/safeMessage.js';

// Enregistre une action admin dans le journal d'audit.
// - req     : requête Express (pour extraire l'IP et l'admin connecté)
// - action  : valeur de l'enum AuditAction (ex: 'DELETE_USER')
// - severity: 'CRITICAL' ou 'IMPORTANT'
// - target  : objet { type, id, label } décrivant la ressource concernée (optionnel)
// - details : objet JSON avec des informations supplémentaires (optionnel)
// - code    : motif en constante (ex: 'EMAIL_NON_VERIFIE'), seul détail écrit sur la console (optionnel)
const logAudit = async (req, action, severity, target = {}, details = null, code = null) => {
  const admin = req?.user;

  // Écrite avant la base, pour rester visible si l'insertion échoue. Ni email, ni
  // libellé, ni détails : ils portent des données personnelles et restent en base.
  // Le code passe seul, et seulement en majuscules : un texte libre n'y entre pas.
  const cible = target?.type ? ` sur ${target.type}${target.id ? ` ${target.id}` : ''}` : '';
  const motif = typeof code === 'string' && /^[A-Z][A-Z_]{0,63}$/.test(code) ? ` (${code})` : '';
  console.log(`[Audit] ${severity} ${action} par ${admin?.id ?? 'système'}${cible}${motif}`);

  try {
    const ip = req?.ip || req?.socket?.remoteAddress || null;

    await prisma.auditLog.create({
      data: {
        adminId:     admin?.id    ?? null,
        adminEmail:  admin?.email ?? 'système',
        action,
        severity,
        targetType:  target.type  ?? null,
        targetId:    target.id    ?? null,
        targetLabel: target.label ?? null,
        details:     details      ?? undefined,
        ipAddress:   ip,
      },
    });
  } catch (err) {
    // Ne jamais faire planter l'action principale à cause du log
    console.error(`[AuditLog] Erreur lors de l'enregistrement : ${safeMessage(err)}`);
  }
};

export { logAudit };
