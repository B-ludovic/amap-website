import { prisma } from '../config/database.js';

// Enregistre une action admin dans le journal d'audit.
// - req     : requête Express (pour extraire l'IP et l'admin connecté)
// - action  : valeur de l'enum AuditAction (ex: 'DELETE_USER')
// - severity: 'CRITICAL' ou 'IMPORTANT'
// - target  : objet { type, id, label } décrivant la ressource concernée (optionnel)
// - details : objet JSON avec des informations supplémentaires (optionnel)
const logAudit = async (req, action, severity, target = {}, details = null) => {
  try {
    const admin = req.user;
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

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
    console.error('[AuditLog] Erreur lors de l\'enregistrement :', err.message);
  }
};

export { logAudit };
