-- Avis aux admins quand un bénévole confirmé se désiste.
ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'SHIFT_WITHDRAWAL_NOTICE' AFTER 'SHIFT_REFUSAL';
