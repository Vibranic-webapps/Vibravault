import { prisma } from './prisma'

/**
 * Soft delete, enforced in ONE place.
 *
 * Every read of Transaction must exclude rows with a deletedAt. Relying on
 * each call site to remember that is how deleted rows silently reappear in a
 * total - and the number still looks plausible, which is the worst kind of
 * bug. This Prisma client extension injects the filter into every find/count/
 * aggregate/groupBy for Transaction, so forgetting is not possible.
 *
 * Use `prismaLive` for all reads. Use raw `prisma` only when you deliberately
 * want deleted rows (e.g. import dedupe checks that must see history).
 */
export const prismaLive = prisma.$extends({
  query: {
    transaction: {
      async $allOperations({ operation, args, query }) {
        const reads = ['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']
        if (reads.includes(operation)) {
          const a = args as { where?: Record<string, unknown> }
          a.where = { ...(a.where ?? {}), deletedAt: null }
        }
        return query(args)
      },
    },
  },
})
