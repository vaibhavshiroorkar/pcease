# PCease

A PC building platform built for Indian buyers. Most tools like PCPartPicker are US-centric — prices in USD, stores like Newegg. PCease tracks prices from Indian retailers (Amazon.in, Flipkart, MDComputers, PrimeABGB, and five others), has a compatibility checker, AI build recommendations, and a community forum. Free, no affiliate links.

Live at: [pcease.vercel.app](https://pcease.vercel.app) · Backend on Render · DB on Supabase

---

## What it does

- **Browse components** — 100+ parts across CPUs, GPUs, motherboards, RAM, storage, PSUs, cases, and coolers. Grid and list views.
- **Price comparison** — Up to 9 Indian vendors shown side-by-side per component, cheapest highlighted, direct buy links.
- **PC Builder** — Slot-based builder with a live budget counter, wattage estimate, and basic bottleneck detection. Builds can be shared via a short link, no account needed.
- **Compare tool** — Drop up to 4 components into a spec table. Better values turn green automatically.
- **AI Advisor** — Give it a budget and use case, it returns a full build recommendation. There's also a follow-up chat mode. Powered by Gemini.
- **Forum** — Threads, replies, upvotes/downvotes. Categories: Build Help, Reviews, Deals, etc.
- **Auth** — JWT-based register/login. Signed-in users can save builds to their account.

---

## Stack

**Frontend** — React 18, Vite 5, React Router v6, react-hot-toast, Feather Icons, custom CSS (dark theme, CSS variables)

**Backend** — FastAPI on Python 3.13, Pydantic v2, python-jose for JWT

**Database** — Supabase (hosted PostgreSQL)

**AI** — Google Gemini (`google-generativeai`)

**Hosting** — Vercel (frontend), Render (backend), Supabase (DB)

---

## Running locally

### Requirements

- Node.js 18+
- Python 3.11+
- A Supabase project ([free tier works](https://supabase.com))

### Setup

```bash
git clone https://github.com/vaibhavshiroorkar/pcease.git
cd pcease
```

**Database** — Run `backend/supabase_migration.sql` in your Supabase SQL editor, then seed it:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # macOS/Linux
# .venv\Scripts\activate        # Windows
pip install -r requirements.txt
python seed_supabase.py
```

**Backend** — Create `backend/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
SECRET_KEY=any-random-string
GEMINI_API_KEY=your-gemini-key
FRONTEND_URL=http://localhost:5173
```

```bash
uvicorn app.main:app --reload --port 8000
```

**Frontend** — Create `frontend/.env`:

```
VITE_API_URL=http://localhost:8000/api
```

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`. Swagger docs at `http://localhost:8000/docs`.

---

## API

Full interactive docs at `/docs` (Swagger) or `/redoc` when the server is running. Quick overview:

**Components**
- `GET /api/categories` — all categories
- `GET /api/components` — list with filters (`category`, `brand`, `search`, `sort`, `skip`, `limit`)
- `GET /api/components/{id}` — single component + vendor prices
- `POST /api/compare` — compare up to 4 components `{ "ids": [1, 2, 3] }`
- `GET /api/vendors` — tracked vendors
- `GET /api/stats` — platform counts

**Builds** *(auth required where noted)*
- `GET /api/builds` ✓ — user's saved builds
- `POST /api/builds` ✓ — save a build
- `DELETE /api/builds/{id}` ✓ — delete a build
- `POST /api/builds/share` — generate shareable link
- `GET /api/builds/shared/{share_id}` — load a shared build

**Auth**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` ✓

**Forum** *(auth required for writes)*
- `GET /api/forum/threads` — list threads (`category`, `search`)
- `GET /api/forum/threads/{id}` — thread + replies
- `POST /api/forum/threads` ✓ — create thread
- `POST /api/forum/threads/{id}/replies` ✓ — reply
- `POST /api/forum/threads/{id}/vote` ✓ — upvote/downvote

**AI**
- `POST /api/advisor` — get a build recommendation

---

## Database schema

```
categories        id · slug · name · description · icon
vendors           id · slug · name · url · logo_url
components        id · category_id · name · brand · model · specifications (jsonb) · image_url
component_prices  id · component_id · vendor_id · price · currency · url · in_stock
builds            id · user_id · name · components (jsonb) · total_price · created_at
shared_builds     id · share_id · name · components (jsonb) · total_price · created_at
users             id · username · email · hashed_password · created_at
forum_threads     id · user_id · title · content · category · created_at
forum_replies     id · thread_id · user_id · content · created_at
forum_votes       id · thread_id · user_id · vote_type
```

---

## Project layout

```
pcease/
├── backend/
│   ├── app/
│   │   ├── main.py            # app init, CORS, router mounting
│   │   ├── config.py          # Pydantic settings from .env
│   │   ├── database.py        # Supabase client
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── components.py
│   │   │   └── forum.py
│   │   ├── schemas/
│   │   └── utils/auth.py      # JWT helpers, current_user dep
│   ├── seed_supabase.py
│   ├── supabase_migration.sql
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── pages/
        │   ├── Home.jsx
        │   ├── Browse.jsx
        │   ├── Builder.jsx
        │   ├── Compare.jsx
        │   ├── Advisor.jsx
        │   ├── Forum.jsx
        │   └── Auth.jsx
        ├── components/
        │   ├── Navbar.jsx
        │   └── Footer.jsx
        ├── context/AuthContext.jsx
        ├── services/api.js
        └── styles/global.css
```

---

## Deploying

**Backend (Render)**
- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add all keys from `backend/.env` as environment variables

**Frontend (Vercel)**
- Root directory: `frontend`
- Framework: Vite
- Build: `npm run build` → `dist`
- Set `VITE_API_URL` to your Render backend URL

**Database (Supabase)**
- Free tier is fine. Row Level Security is optional — the service key handles server-side writes already.

---

## Vendors tracked

Amazon.in · Flipkart · MDComputers · PrimeABGB · PC Studio · Vedant Computers · IT Depot · Compify · EliteHubs

---

## Contributing

Fork, branch off `main`, make your changes, open a PR. No formal process — just keep commits clean and describe what changed.

---

## License

MIT
