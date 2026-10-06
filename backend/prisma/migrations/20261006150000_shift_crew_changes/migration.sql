-- Emails à l'adhérent quand un admin le retire d'une permanence ou en change le créneau.
ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'SHIFT_REMOVAL' AFTER 'SHIFT_WITHDRAWAL_NOTICE';
ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'SHIFT_RESCHEDULED' AFTER 'SHIFT_REMOVAL';
