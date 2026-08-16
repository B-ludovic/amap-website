-- Consigner chaque passage du job de rétention, y compris ceux qui n'ont rien
-- purgé : les sept purges ne journalisent que sous « count > 0 », si bien qu'un
-- registre muet ne distinguait pas un passage à vide d'une absence de passage.
--
-- ADD VALUE seulement : les enregistrements d'audit existants ne sont pas touchés.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RETENTION_JOB_RUN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RETENTION_JOB_FAILED';
