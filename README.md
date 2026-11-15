# NilePixel StarLift Referral Bot & Admin Dashboard

Production-grade Telegram referral tracking system and administrative management dashboard for the **NilePixel Technologies – StarLift Project Showcase Challenge** (November 15 – November 30, 2026).

---

## 1. System Architecture & Overview

The system operates as a unified platform on `@NilePixelStarLiftBot` to manage contestant registration, direct showcase project submissions (with optional screenshots/banners), personal channel referral invite links, 70/30 scoring, and admin 1-click publishing:

```
                                  Telegram Cloud
                                        │
             ┌──────────────────────────┴─────────────────────────┐
             ▼                                                    ▼
     @NilePixelStarLiftBot                                NilePixel Channel
 (User Commands: /start, /mylink,                 (Audience joins via personal invite links)
          /stats, /leaderboard)                                   │
             │                                                    │
             │  Webhooks / Long-Polling                           │
             └───────────────────────┬────────────────────────────┘
                                     │ (chat_member join events)
                                     ▼
                      ┌───────────────────────────────┐
                      │   Express.js Backend (Node)   │
                      │   • Telegraf Bot Engine       │
                      │   • Referral Engine & Auditing│
                      │   • 70/30 Scoring Service     │
                      │   • REST Management APIs      │
                      └──────────────┬────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
             PostgreSQL Database              React Admin Dashboard
             (Prisma ORM)                     (Vite + Tailwind + Recharts)
```

---

## 2. Technology Stack

### Backend
- **Runtime:** Node.js (v20+) with TypeScript
- **Web Framework:** Express.js
- **Bot Framework:** Telegraf (Telegram Bot API)
- **Database & ORM:** PostgreSQL with Prisma ORM
- **Authentication:** JWT (JSON Web Tokens) with refresh token rotation & bcrypt password hashing
- **Security:** Helmet, CORS, Express Rate Limiting, input sanitization via Express-Validator & Zod
- **Testing:** Vitest

### Frontend (Admin Dashboard)
- **Framework:** React 19 + TypeScript
- **Bundler:** Vite
- **Styling:** Tailwind CSS (Minimal, white background, strictly no decorative gradients)
- **State & Server Cache:** TanStack Query (React Query)
- **Charts:** Recharts
- **Icons:** Lucide React
- **Notifications:** React Hot Toast

---

## 3. Telegram Bot Features & Commands

Bot link: **https://t.me/NilePixelStarLiftBot**

| Command | Description |
|---|---|
| `/start` | Welcomes user, records Telegram ID (`BigInt`), username, and names. Supports deep linking (`/start <referralCode>`) for direct bot referrals with self-referral prevention. |
| `/mylink` | Creates a unique personal invite link to the showcase channel via Telegram's `createChatInviteLink` API. If an active link already exists, returns the cached link. |
| `/stats` | Shows confirmed referral count, leaderboard rank, current invite link, and personalized progress milestone. |
| `/leaderboard` | Displays top 10 participants ranked by confirmed referrals with medals (🥇, 🥈, 🥉). |
| `/help` | Explains rules, scoring structure (70% referrals / 30% reactions), and guidelines. |

---

## 4. Referral Tracking Mechanics

### How It Works
1. When a participant calls `/mylink`, the bot creates a trackable channel invite link:
   ```typescript
   await ctx.telegram.createChatInviteLink(channelId, {
     name: `StarLift-${participant.referralCode}`,
     creates_join_request: false,
   });
   ```
2. The invite link URL is saved in MySQL and associated with the participant.
3. When an invited person clicks the link and joins the channel, Telegram triggers a `chat_member` update to the bot.
4. The bot inspects `update.chat_member`:
   - Validates that the event originated from the target showcase channel (`TELEGRAM_CHANNEL_ID`).
   - Ensures the status changed to `member` or `administrator`.
   - Extracts `invite_link.invite_link` and identifies the owning participant in MySQL.
5. **Referral Integrity Guarantees:**
   - **Self-referral prevention:** A participant clicking their own link is never credited.
   - **Duplicate prevention:** A Telegram account can only be credited as a referral once across the entire challenge.
   - **Rejoin handling:** If a user leaves and rejoins, the existing referral record is preserved and not duplicated.
   - **Audit logging:** All join events and status updates are logged in `activity_logs`.
   - **Instant notification:** The inviter receives a Telegram notification when someone joins using their link.

---

## 5. Scoring System & Winner Selection

The StarLift Challenge runs from **November 15, 2026, to November 30, 2026**.

Composite scores are calculated dynamically:

$$\text{Referral Score} = \left(\frac{\text{Participant Confirmed Referrals}}{\max(\text{All Referrals}, 1)}\right) \times 100$$

$$\text{Reaction Score} = \left(\frac{\text{Participant Verified Reactions}}{\max(\text{All Reactions}, 1)}\right) \times 100$$

$$\text{Final Score} = (\text{Referral Score} \times 0.70) + (\text{Reaction Score} \times 0.30)$$

- **Referral Weight:** 70% (configurable via Admin Settings).
- **Reaction Weight:** 30% (configurable via Admin Settings).
- Administrators can directly record or update verified project reaction counts from the Leaderboard tab.
- Top three finalists are highlighted on podium cards with itemized score breakdowns.

---

## 6. Admin Dashboard Guide

Designed with a clean, professional white background, consistent typography, and a max-3 interface color scheme:

1. **Overview (`/`):** Key metrics (Total Participants, Confirmed Referrals, Channel Joins, Active Referrers), 14-day activity area chart, live Top 3 podium, and real-time referral feed.
2. **Participants (`/participants`):** Searchable, paginated table of participants. Includes Telegram ID, username, registration date, referral count, invite link, and project submission verification status. Details modal allows approving/rejecting project submissions.
3. **Referrals (`/referrals`):** Audit table of all referral transactions. Displays referrer, referred member, timestamp, and audit actions (Confirm / Reject).
4. **Leaderboard (`/leaderboard`):** Displays itemized 70/30 scores. Administrators can click **Edit Reactions** on any row to input verified counts with instant recalculation.
5. **Activity Log (`/activity`):** Immutable audit log of administrative actions, participant registrations, and referral status updates.
6. **Settings (`/settings`):** Manage Telegram Channel ID, campaign start/end dates, scoring weights, eligibility requirements, and campaign status.

---

## 7. Database Schema

Managed via Prisma ORM for PostgreSQL:

- `admin_users`: Administrator credentials and roles.
- `participants`: Telegram users with `BigInt` `telegramId` to avoid integer overflow, unique `referralCode`, registration timestamps.
- `referrals`: Tracked referral pairs with unique constraint on `referredId` to prevent duplicate crediting.
- `invitation_links`: Unique invite links generated via Telegram Bot API linked to participant.
- `project_submissions`: Project link, description, and review status (`pending`, `verified`, `rejected`).
- `project_reactions`: Verified reaction counts recorded by administrators.
- `challenge_settings`: Key-value configuration for weights, dates, and channel ID.
- `activity_logs`: Audit trail for security, registrations, and administrative changes.

---

## 8. Quick Start & Setup

### Prerequisites
- Node.js v20+ or v24+
- PostgreSQL 14+ (Local, Docker, Supabase, Neon, or Railway)

### Step 1: Clone & Install Dependencies
```bash
# Backend
cd backend
npm install

# Admin Dashboard
cd ../admin
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env` in the project root:
```bash
cp .env.example .env
```
Update credentials:
- `DATABASE_URL`: Your MySQL connection string.
- `JWT_SECRET`: Random 32+ character secret.
- `JWT_REFRESH_SECRET`: Random 32+ character secret.
- `BOT_TOKEN`: Telegram bot token from BotFather.
- `TELEGRAM_CHANNEL_ID`: Numeric channel ID (e.g. `-1001234567890`).

### Step 3: Run Migrations & Seed
```bash
cd backend
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

### Step 4: Run Development Servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd admin
npm run dev
```

Visit the Admin Dashboard at `http://localhost:5173`. Default admin login:
- **Email:** `contact@nilexpixel.et` (or value in `.env`)
- **Password:** `nexus@0974` (or value in `.env`)

---

## 9. Running Tests

Run the test suite with Vitest:
```bash
cd backend
npm test
```
Tests cover:
- 70/30 scoring formula, normalization, and rankings
- Unique & deterministic referral code generation
- Self-referral and duplicate referral prevention logic
- Telegram MarkdownV2 character escaping & deep-link parameter parsing
- Password hashing and JWT cryptographic verification

---

## 10. Production Deployment

### Backend Production Build
```bash
cd backend
npm run build
npm start
```

### Frontend Production Build
```bash
cd admin
npm run build
```
The static assets will be in `admin/dist/` ready to be served by Nginx, Caddy, or Cloudflare Pages.

For manual Telegram setup steps, see [docs/setup-checklist.md](file:///c:/Users/LEGION/Desktop/latestProject/nilepixelbot/docs/setup-checklist.md).

