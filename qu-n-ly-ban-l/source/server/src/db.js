const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Keep dummy readDb/writeDb for backward compatibility during migration
// if any files haven't been migrated yet. Ideally, you should import `prisma` directly.
async function readDb() {
    console.warn('readDb() is deprecated. Please use prisma directly.');
    return {}; 
}

async function writeDb(data) {
    console.warn('writeDb() is deprecated. Please use prisma directly.');
}

module.exports = {
    prisma,
    readDb,
    writeDb
};
