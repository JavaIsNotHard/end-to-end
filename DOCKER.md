# Docker Setup Guide

This guide explains how to run the PostgreSQL database using Docker Compose.

## Prerequisites

- Docker installed on your system
- Docker Compose installed (usually comes with Docker Desktop)

## Quick Start

1. **Configure environment variables:**
   ```bash
   cd backend
   cp .env.example .env
   ```
   Edit `backend/.env` with your desired database credentials:
   ```env
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=e2e_chat
   DB_PASSWORD=your_secure_password
   DB_PORT=5432
   ```

2. **Start PostgreSQL:**
   ```bash
   npm run docker:up
   ```
   Or manually:
   ```bash
   docker-compose up -d
   ```

3. **Verify it's running:**
   ```bash
   docker-compose ps
   ```

4. **View logs:**
   ```bash
   npm run docker:logs
   ```

## Docker Commands

### Start Database
```bash
npm run docker:up
# or
docker-compose up -d
```

### Stop Database
```bash
npm run docker:down
# or
docker-compose down
```

### View Logs
```bash
npm run docker:logs
# or
docker-compose logs -f postgres
```

### Restart Database
```bash
npm run docker:restart
# or
docker-compose restart postgres
```

### Access PostgreSQL CLI
```bash
npm run docker:psql
# or
docker-compose exec postgres psql -U postgres -d e2e_chat
```

### Stop and Remove Everything (including data)
```bash
docker-compose down -v
```
⚠️ **Warning**: This will delete all database data!

## Environment Variables

The Docker Compose file reads from `backend/.env`:

- `DB_USER` - PostgreSQL username (default: postgres)
- `DB_PASSWORD` - PostgreSQL password (default: postgres)
- `DB_NAME` - Database name (default: e2e_chat)
- `DB_PORT` - Port to expose (default: 5432)

## Database Initialization

The database schema is automatically initialized when the container starts for the first time. The `database-setup.sql` file is mounted and executed automatically.

## Data Persistence

Database data is stored in a Docker volume named `postgres_data`. This means:
- Data persists even if you stop the container
- Data persists even if you remove the container
- To delete all data, use: `docker-compose down -v`

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs postgres

# Check if port is already in use
lsof -i :5432
```

### Connection refused
- Make sure the container is running: `docker-compose ps`
- Check the DB_HOST in `backend/.env` is set to `localhost`
- Verify the port matches: `DB_PORT=5432`

### Reset database
```bash
# Stop and remove everything
docker-compose down -v

# Start fresh
docker-compose up -d
```

### Access database from host
```bash
# Using psql (if installed)
psql -h localhost -U postgres -d e2e_chat

# Or using Docker
docker-compose exec postgres psql -U postgres -d e2e_chat
```

## Production Considerations

For production use:
1. Use strong passwords
2. Don't expose port 5432 publicly
3. Use Docker secrets or environment variables from a secure source
4. Set up regular backups
5. Use a managed database service (AWS RDS, Google Cloud SQL, etc.)

