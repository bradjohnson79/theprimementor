# Blueprint Engine Verification Tests

## Setup

1. Get your Clerk auth token:
   - Open Admin Dashboard in browser: http://localhost:5174/blueprint
   - Open DevTools (F12 or Cmd+Opt+I)
   - Go to Application/Storage → Cookies → http://localhost:5174
   - Find `__session` cookie and copy its value
   - OR run in console: `document.cookie.split('; ').find(c => c.startsWith('__session=')).split('=')[1]`

2. Set the token as environment variable:
   ```bash
   export TEST_CLERK_TOKEN="your_token_here"
   ```

## Run Tests

### Test A: Guest Mode
```bash
cd /Users/bradjohnson/Documents/wisdomtransmissions.com/apps/api
node src/scripts/test-guest-mode.js
```

### Test B: Client Mode
```bash
cd /Users/bradjohnson/Documents/wisdomtransmissions.com/apps/api
node src/scripts/test-client-mode.js
```

## Expected Results

Both tests should:
- ✅ Return HTTP 200
- ✅ Create report in database
- ✅ Persist blueprint_data correctly
- ✅ Allow retrieval of saved report

Test A (Guest):
- ✅ `client_id` should be NULL

Test B (Client):
- ✅ `client_id` should match the test client ID
- ✅ Foreign key integrity verified
