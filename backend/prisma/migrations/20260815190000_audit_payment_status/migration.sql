-- Deux actions journalisables autour du cycle de vie d'un chèque.
--
-- UPDATE_PAYMENT_STATUS couvre tout déplacement d'un chèque : la pochette vers
-- la banque, la banque vers le compte, et les retours en arrière.
--
-- FAILED_PAYMENT_REAUTH consigne les mots de passe refusés devant une marche
-- arrière. Une invite de mot de passe est un oracle : si personne ne compte les
-- échecs, elle devient un moyen d'essayer le mot de passe de l'administrateur
-- depuis une session à demi compromise, sans que rien ne le signale.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'UPDATE_PAYMENT_STATUS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FAILED_PAYMENT_REAUTH';
