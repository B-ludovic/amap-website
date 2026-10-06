-- Mot de passe refusé devant un changement de rôle ou une suppression de compte.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FAILED_ACCOUNT_REAUTH' AFTER 'CHANGE_USER_ROLE';
