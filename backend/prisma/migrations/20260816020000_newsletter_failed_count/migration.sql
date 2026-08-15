-- AlterTable
ALTER TABLE "Newsletter" ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0;

-- Les newsletters déjà parties gardent 0, faute de mieux : le compte des refus
-- n'a jamais été écrit, il n'existe nulle part d'où le tirer. À l'écran, 0 ne
-- s'affiche pas — l'archive reste donc muette sur ses échecs passés, ce qui est
-- la lecture honnête de « on ne sait pas ».

-- DropColumn
--
-- openCount n'a jamais été alimenté : aucune écriture dans le backend, aucun
-- pixel de suivi dans les gabarits, aucun webhook branché. Seul le front le
-- lisait, derrière un « > 0 » qui n'a jamais été vrai.
--
-- Il ne reviendra pas tel quel. Une ouverture se mesure en faisant charger une
-- image au lecteur, or Gmail bloque les images par défaut et Apple Mail les
-- précharge pour tout le monde depuis iOS 15 : le compteur sous-évalue les uns
-- et invente les autres. Ce qui se mesure vraiment, ce sont les rebonds et les
-- plaintes, que le relais connaît et sait renvoyer par webhook — dans EmailLog,
-- qui porte déjà le messageId qui sert de jointure.
ALTER TABLE "Newsletter" DROP COLUMN "openCount";
