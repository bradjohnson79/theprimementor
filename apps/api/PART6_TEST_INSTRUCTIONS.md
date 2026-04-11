# Blueprint Engine — Part 6 Runtime Verification

## How to Get Your Clerk Token

1. Open http://localhost:5174 in your browser
2. Sign in as admin
3. Open DevTools → Console
4. Run:
   ```js
   await window.Clerk.session.getToken()
   ```
5. Copy the returned JWT string

## Run Verification Tests

```bash
cd /Users/bradjohnson/Documents/wisdomtransmissions.com

export TEST_CLERK_TOKEN="paste_your_jwt_here"

node apps/api/src/scripts/verify-blueprint-engine.js
```

## What the Tests Verify

### Test A — Guest Mode
- POST /api/blueprints/generate with guest data
- HTTP 200
- `client_id = null` in DB
- `status = draft`
- `blueprint.core` present
- `blueprint.astrology.system = vedic_sidereal`
- `blueprint.chinese` present
- Vedic ayanamsa in 23–26° range
- All timestamps correct
- Report retrievable by ID

### Test B — Client Mode
- Uses first client in DB
- POST /api/blueprints/generate with `clientId`
- HTTP 200
- `client_id = <uuid>` (not null) in DB
- FK integrity confirmed via retrieval

### Test C — Vedic Shift Verification
- 1990-05-12 14:30 London, UK
- Confirms Lahiri ayanamsa applies correctly
- Prints sidereal Sun sign vs tropical (Taurus → Aries expected)
- Confirms retrogrades and doshas are present
