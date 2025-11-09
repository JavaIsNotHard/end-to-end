require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Build DATABASE_URL from individual env vars if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD || 'postgres';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || 5432;
  const dbName = process.env.DB_NAME || 'e2e_chat';
  
  process.env.DATABASE_URL = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
}

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize database schema
const initSchema = async () => {
  try {
    // Test connection
    await prisma.$connect();
    console.log('Connected to PostgreSQL database via Prisma');

    // Prisma Migrate will handle schema changes
    // For existing databases, we'll use prisma db push or migrations
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
};

module.exports = {
  prisma,
  initSchema,
};
