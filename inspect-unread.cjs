const { PrismaClient } = require('./node_modules/.prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const quotes = await prisma.quote.findMany({ orderBy: { updatedAt: 'desc' }, take: 6, select: { id: true, quoteNumber: true } });
    const rows = [];
    for (const quote of quotes) {
      const read = await prisma.$queryRawUnsafe('SELECT lastReadAt FROM QuoteReadState WHERE quoteId = ? AND viewer = ? AND viewerId = ? LIMIT 1', quote.id, 'MANAGER', 'manager');
      const lastReadAt = read[0]?.lastReadAt ? new Date(read[0].lastReadAt) : new Date(0);
      const count = await prisma.conversationMessage.count({ where: { quoteId: quote.id, sender: { not: 'MANAGER' }, createdAt: { gt: lastReadAt } } });
      const latestCustomer = await prisma.conversationMessage.findFirst({ where: { quoteId: quote.id, sender: 'CUSTOMER' }, orderBy: { createdAt: 'desc' }, select: { message: true, createdAt: true } });
      rows.push({ quote: quote.quoteNumber, unread: count, managerLastReadAt: lastReadAt, latestCustomer });
    }
    console.log(JSON.stringify(rows, null, 2));
  } finally { await prisma.$disconnect(); }
})();
