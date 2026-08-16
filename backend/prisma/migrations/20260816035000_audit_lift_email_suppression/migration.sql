-- Extend the audit action enum without altering existing audit records.
-- Seul dans sa migration : PostgreSQL refuse d'employer une valeur d'enum
-- ajoutée dans la même transaction que son usage.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LIFT_EMAIL_SUPPRESSION';
