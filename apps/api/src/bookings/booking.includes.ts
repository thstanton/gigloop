export const CONTRACT_INCLUDE = {
  where: { status: { not: 'VOID' } },
  orderBy: { createdAt: 'desc' as const },
  take: 1,
} as const;
