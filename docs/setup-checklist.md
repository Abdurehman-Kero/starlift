# NilePixel StarLift Challenge — Setup & Deployment Checklist

Follow this checklist step-by-step to configure, connect, and launch the NilePixel StarLift Referral Bot and Admin Dashboard.

---

## 1. Telegram Channel & Bot Setup (Manual Telegram Steps)

### Step 1.1: Obtain Bot Token
You already have the bot created via [@BotFather](https://t.me/BotFather):
- Bot username: `@NilePixelStarLiftBot`
- Bot link: https://t.me/NilePixelStarLiftBot
- Securely store the token provided by BotFather (never commit it to Git).

### Step 1.2: Add Bot as Administrator to NilePixel Showcase Channel
The bot must be an administrator in the target Telegram channel in order to generate tracked invitation links (`createChatInviteLink`) and receive member join events (`chat_member` updates):
1. Open your target Telegram channel.
2. Go to **Channel Settings** → **Administrators** → **Add Administrator**.
3. Search for `@NilePixelStarLiftBot` and select it.
4. **Required Administrator Permissions:**
   - ✅ **Invite Users via Link** (CRITICAL: enables `/mylink` personal link generation)
   - ✅ **Manage Chat** (or equivalent basic administration)
5. Save changes.

### Step 1.3: Retrieve Telegram Channel ID
To restrict referral tracking strictly to your showcase channel:
1. Forward any message from your channel to [@userinfobot](https://t.me/userinfobot) or [@JsonDumpBot](https://t.me/JsonDumpBot).
2. The numeric ID typically begins with `-100` (e.g., `-1002145678901`).
3. Set this ID as `TELEGRAM_CHANNEL_ID` in your `.env` file (or configure it dynamically from the Admin Dashboard under Settings).

---

## 2. PostgreSQL Database Setup

### Step 2.1: Create Database & User
Run the following in your PostgreSQL CLI (`psql`) or cloud database console (Supabase, Neon, Railway, RDS, etc.):

```sql
CREATE DATABASE nilepixel_starlift;

CREATE USER nilepixel_user WITH PASSWORD 'StrongPasswordHere123!';
GRANT ALL PRIVILEGES ON DATABASE nilepixel_starlift TO nilepixel_user;
```

---

## 3. Environment Variables (.env)

Create a `.env` file in the project root (`c:\Users\LEGION\Desktop\latestProject\nilepixelbot\.env`):

```env
# Backend Environment & Port
NODE_ENV=production
PORT=3001

# PostgreSQL Database Connection URL
DATABASE_URL=postgresql://nilepixel_user:StrongPasswordHere123!@localhost:5432/nilepixel_starlift?schema=public

# JWT Authentication Secrets (Generate secure random 64-char strings)
JWT_SECRET=generate_a_random_secret_at_least_32_characters_long_abc123
JWT_REFRESH_SECRET=generate_another_random_secret_at_least_32_characters_xyz789
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Telegram Bot Configuration
BOT_TOKEN=your_botfather_token_here
BOT_WEBHOOK_URL=https://api.yourdomain.com
TELEGRAM_CHANNEL_ID=-1001234567890

# Seed Admin Credentials
ADMIN_EMAIL=contact@nilexpixel.et
ADMIN_PASSWORD=nexus@0974

# CORS (Frontend URL)
CORS_ORIGIN=https://admin.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 4. Database Migrations & Initial Seeding

Run Prisma migrations and the seed script from `backend/`:

```bash
cd backend

# Run Prisma migrations
npm run db:migrate:deploy
# (Or in development: npm run db:migrate -- --name init)

# Seed default admin user & challenge settings
npm run db:seed
```

This will automatically create:
1. The initial administrator account (`contact@nilexpixel.et`).
2. Default challenge parameters:
   - Challenge window: November 15, 2026 – November 30, 2026.
   - Referral score weight: 70%.
   - Reaction score weight: 30%.
   - Minimum eligibility requirement: 1 referral.
   - Campaign status: Active.

---

## 5. Running the Application

### Development Mode (with hot-reload):

```bash
# Terminal 1 - Backend (port 3001)
cd backend
npm run dev

# Terminal 2 - Admin Dashboard (port 5173 with proxy to backend)
cd admin
npm run dev
```

Visit the Admin Dashboard at: `http://localhost:5173`

### Production Mode:

```bash
# 1. Build Backend
cd backend
npm run build
npm start

# 2. Build Admin Dashboard
cd admin
npm run build
# Serve admin/dist using Nginx, Caddy, Cloudflare Pages, or Vercel
```

---

## 6. Webhook vs Long-Polling Configuration

- **Development:** Leave `BOT_WEBHOOK_URL` empty or unset in `.env`. The bot will automatically use Telegram Long Polling with `allowed_updates: ['message', 'chat_member', 'callback_query']`.
- **Production:** Set `BOT_WEBHOOK_URL=https://your-domain.com`. The bot will register the webhook endpoint at `${BOT_WEBHOOK_URL}/webhook` with SSL and deliver updates directly to Express.

---

## 7. Verification Checklist

- [ ] Send `/start` to `@NilePixelStarLiftBot` — verify welcome message and participant registration in database.
- [ ] Send `/mylink` — verify unique Telegram channel invite link generated.
- [ ] Have a test account join the channel via that link — verify referral counted and credited to inviter.
- [ ] Send `/stats` — verify updated confirmed referral count and rank.
- [ ] Send `/leaderboard` — verify top participants listed.
- [ ] Sign in to Admin Dashboard (`/login`) with admin credentials.
- [ ] Check Overview page — charts and counts should reflect live data.
- [ ] Check Participants page — verify search, pagination, and submission verification modal.
- [ ] Check Referrals page — verify referral audit log.
- [ ] Check Leaderboard page — edit verified project reactions and verify 70/30 composite score recalculation.
- [ ] Check Settings page — update dates or weights if necessary.

