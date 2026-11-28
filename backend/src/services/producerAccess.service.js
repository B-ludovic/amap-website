/* Rôle PRODUCER et rattachement à une ferme se retirent ensemble, ici, dans la
   transaction de l'appelant : révocation par un admin ou suppression du compte.
   Verrou dans l'ordre compte puis demande, comme l'approbation, pour qu'aucun
   croisement ne s'interbloque. */
export async function revokeProducerAccess(tx, userId, actorId) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true, producerId: true },
  });
  if (!user || (user.role !== 'PRODUCER' && !user.producerId)) return null;

  const demande = await tx.producerAccessRequest.findFirst({
    where: { userId, status: 'APPROVED' },
    orderBy: { processedAt: 'desc' },
    select: { id: true, previousRole: true },
  });

  const role = user.role === 'PRODUCER' ? (demande?.previousRole ?? 'MEMBER') : user.role;

  // tokenVersion : la session ouverte avec l'ancien rôle tombe.
  await tx.user.update({
    where: { id: userId },
    data: { role, producerId: null, tokenVersion: { increment: 1 } },
  });

  if (demande) {
    await tx.producerAccessRequest.update({
      where: { id: demande.id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actorId },
    });
  }

  return { requestId: demande?.id ?? null, producerId: user.producerId, role };
}
