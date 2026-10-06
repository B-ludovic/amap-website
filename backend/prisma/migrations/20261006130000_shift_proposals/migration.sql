-- Proposition de permanence : l'adhérent se propose, un admin accepte ou refuse.
ALTER TYPE "VolunteerStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "VolunteerStatus" ADD VALUE IF NOT EXISTS 'REFUSED';
ALTER TYPE "EmailKind" ADD VALUE IF NOT EXISTS 'SHIFT_REFUSAL' AFTER 'SHIFT_WITHDRAWAL';
