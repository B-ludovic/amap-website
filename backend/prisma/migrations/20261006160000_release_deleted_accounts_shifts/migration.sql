-- Les comptes supprimés avant ce correctif libèrent leurs permanences à venir,
-- comme le fait désormais toute suppression de compte. Les lignes passées restent.
UPDATE "ShiftVolunteer" AS sv
SET "status" = 'CANCELLED'
FROM "User" AS u, "Shift" AS s
WHERE sv."userId" = u."id"
  AND sv."shiftId" = s."id"
  AND u."deletedAt" IS NOT NULL
  AND sv."status" IN ('CONFIRMED', 'PENDING')
  AND s."distributionDate" >= CURRENT_DATE;
