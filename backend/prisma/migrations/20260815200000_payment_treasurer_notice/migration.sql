-- Garde anti-doublon du rappel de dépôt envoyé au trésorier.
-- Distincte de "reminderSentAt", qui appartient au rappel de l'adhérent.
ALTER TABLE "Payment" ADD COLUMN "treasurerNotifiedAt" TIMESTAMP(3);
