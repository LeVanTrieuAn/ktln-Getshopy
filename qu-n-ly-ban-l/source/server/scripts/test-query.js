const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.time('query');
  const [rows, count] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT id, name FROM "Product"
      WHERE is_deleted = false
        AND (branch_ids::jsonb = '[]'::jsonb OR branch_ids::jsonb @> '["HCM001"]'::jsonb)
      ORDER BY id DESC LIMIT 8
    `),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count FROM "Product"
      WHERE is_deleted = false
        AND (branch_ids::jsonb = '[]'::jsonb OR branch_ids::jsonb @> '["HCM001"]'::jsonb)
    `)
  ]);
  console.timeEnd('query');
  console.log('Count:', count[0].count);
}
main().finally(() => prisma.$disconnect());
