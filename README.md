# End-to-End Encrypted Chat Application

A secure, real-time chat application with end-to-end encryption, similar to Telegram. Messages are encrypted on the client side and can only be decrypted by the intended recipient. All messages are stored in PostgreSQL for verification that they are indeed encrypted.

## Features

- 🔒 **End-to-End Encryption**: Messages are encrypted using AES-GCM with keys derived from ECDH key exchange
- ⚡ **Real-time Messaging**: WebSocket-based instant messaging
- 🛡️ **Secure Key Exchange**: ECDH (Elliptic Curve Diffie-Hellman) for secure key exchange
- 👥 **User Management**: Simple user registration and online status tracking
- 💬 **Modern UI**: Beautiful, responsive chat interface
- 🗄️ **PostgreSQL Storage**: All messages stored encrypted in database for verification
- 🔍 **Admin Endpoints**: View encrypted messages to verify encryption

## Technology Stack

### Backend
- Node.js with Express
- Socket.io for WebSocket communication
- PostgreSQL for data persistence
- Web Crypto API for encryption

### Frontend
- React
- Socket.io-client
- Web Crypto API for client-side encryption

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher) OR Docker and Docker Compose

## Installation

1. **Install PostgreSQL** (if not already installed):
   - macOS: `brew install postgresql`
   - Ubuntu: `sudo apt-get install postgresql`
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/)

2. **Set up PostgreSQL database**:

   **Option A: Using Docker Compose (Recommended)**
   ```bash
   # Make sure you have backend/.env configured
   cd backend
   cp .env.example .env
   # Edit .env with your desired database credentials
   
   # Start PostgreSQL with Docker Compose
   cd ..
   npm run docker:up
   ```
   This will automatically:
   - Create the PostgreSQL container
   - Create the database
   - Run the initialization script
   - Set up the schema

   **Option B: Using local PostgreSQL**
   ```bash
   # Create database manually
   createdb e2e_chat
   
   # Or use the provided SQL script
   cd backend
   psql -U postgres -f database-setup.sql
   ```

3. **Configure environment variables**:
   
   **Backend:**
   ```bash
   cd backend
   cp .env.example .env
   ```
   Edit `backend/.env` with your PostgreSQL credentials:
   ```
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=e2e_chat
   DB_PASSWORD=your_password
   DB_PORT=5432
   PORT=5002
   ```
   
   **Frontend (optional, for ngrok):**
   ```bash
   cd frontend
   cp .env.example .env
   ```
   Edit `frontend/.env` if needed:
   ```
   REACT_APP_API_URL=http://localhost:5002
   ```

4. **Install dependencies:**
   ```bash
   npm run install-all
   ```
   This installs dependencies for root, backend, and frontend.

5. **Start the development servers:**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend server on `http://localhost:5002`
   - Frontend React app on `http://localhost:3000`

## How It Works

### Encryption Flow

1. **Key Generation**: Each user generates an ECDH key pair when connecting
2. **Key Exchange**: When two users start a chat, they exchange their public keys
3. **Shared Secret**: Each client derives a shared secret using their private key and the peer's public key
4. **AES Key Derivation**: The shared secret is used to derive an AES-256-GCM key using PBKDF2
5. **Message Encryption**: Messages are encrypted with AES-GCM before sending
6. **Message Storage**: Encrypted messages are stored in PostgreSQL (server cannot read them)
7. **Message Decryption**: Only the recipient can decrypt messages using their derived key

### Security Features

- **Forward Secrecy**: Each chat session uses a new key pair
- **Server Cannot Read Messages**: The server only sees encrypted data stored in BYTEA format
- **Authenticated Encryption**: AES-GCM provides both encryption and authentication
- **Secure Key Derivation**: PBKDF2 with 100,000 iterations
- **Database Verification**: All messages stored encrypted - you can query the database to verify

## Usage

1. Open the application in your browser (http://localhost:3000)
2. Enter a username to register
3. Select a user from the online users list
4. Wait for encryption to be established (you'll see a confirmation message)
5. Start sending encrypted messages!

## Verifying Encryption

### Using Admin Endpoints

The server provides admin endpoints to view encrypted messages:

1. **View all messages** (last 50):
   ```bash
   curl http://localhost:5002/api/admin/messages
   ```

2. **View messages between two users**:
   ```bash
   curl http://localhost:5002/api/admin/messages/{userId1}/{userId2}
   ```

3. **View statistics**:
   ```bash
   curl http://localhost:5002/api/admin/stats
   ```

### Using PostgreSQL

You can also query the database directly:

```sql
-- View all encrypted messages
SELECT 
  m.message_id,
  u1.username as from_user,
  u2.username as to_user,
  m.encrypted_message,
  m.iv,
  m.created_at
FROM messages m
JOIN users u1 ON m.from_user_id = u1.user_id
JOIN users u2 ON m.to_user_id = u2.user_id
ORDER BY m.created_at DESC
LIMIT 10;

-- View message count
SELECT COUNT(*) as total_encrypted_messages FROM messages;
```

**Note**: The `encrypted_message`, `iv`, and `tag` columns contain binary data that cannot be read by the server. Only clients with the correct decryption key can read the plaintext.

## Project Structure

```
end-to-end/
├── server/
│   ├── index.js          # Backend server with Socket.io
│   ├── db.js             # PostgreSQL connection and schema
│   └── db-queries.js     # Database query functions
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── utils/        # Encryption utilities
│   │   └── App.js
│   └── package.json
├── database-setup.sql    # Database schema SQL
├── .env.example          # Environment variables template
├── package.json
└── README.md
```

## Database Schema

### Users Table
- `user_id` (UUID): Primary key
- `username` (VARCHAR): Unique username
- `public_key` (JSONB): ECDH public key for key exchange
- `socket_id` (VARCHAR): Current WebSocket connection ID
- `created_at` (TIMESTAMP): Account creation time
- `last_seen` (TIMESTAMP): Last activity time

### Messages Table
- `message_id` (UUID): Primary key
- `from_user_id` (UUID): Sender user ID
- `to_user_id` (UUID): Recipient user ID
- `encrypted_message` (BYTEA): Encrypted message content (binary)
- `iv` (BYTEA): Initialization vector (binary)
- `tag` (BYTEA): Authentication tag (binary)
- `created_at` (TIMESTAMP): Message timestamp

## Important Notes

- This is a demonstration application. For production use, consider:
  - Using a proper authentication system (JWT, OAuth, etc.)
  - Implementing message history retrieval
  - Adding file sharing capabilities
  - Implementing group chats
  - Adding message deletion/editing
  - Implementing perfect forward secrecy with key rotation
  - Adding rate limiting and security headers
  - Using SSL/TLS for all connections

## Development

### Running the Application

**Start both frontend and backend:**
```bash
npm run dev
```

**Start only backend:**
```bash
npm run backend:dev
```

**Start only frontend:**
```bash
npm run frontend:dev
```

**Build frontend for production:**
```bash
npm run frontend:build
```

### Ports

- Backend runs on port 5002
- Frontend runs on port 3000
- Make sure both servers are running for the app to work properly
- Database schema is automatically created on first run

### Directory Structure

- `backend/` - All backend code, database files, and backend dependencies
- `frontend/` - All frontend code, React app, and frontend dependencies
- `scripts/` - Utility scripts for ngrok and other tools

## Troubleshooting

### Database Connection Issues

**If using Docker Compose:**

1. Check if the container is running:
   ```bash
   docker-compose ps
   ```

2. View database logs:
   ```bash
   npm run docker:logs
   ```

3. Restart the database:
   ```bash
   npm run docker:restart
   ```

4. Access PostgreSQL directly:
   ```bash
   npm run docker:psql
   ```

**If using local PostgreSQL:**

1. Make sure PostgreSQL is running:
   ```bash
   # macOS
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   ```

2. Verify database exists:
   ```bash
   psql -U postgres -l | grep e2e_chat
   ```

3. Check connection credentials in `backend/.env` file

### Port Already in Use

If port 5002 is already in use, change it in `.env`:
```
PORT=5003
```

## License

MIT
