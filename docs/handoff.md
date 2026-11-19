# Where we stopped (handoff between chats)

Last updated: 2026-11-19. Update this file at the end of every session.

## Status
- **Steps 0, 1 and 2 are done and tested on the owner's iPhone (2026-11-19).**
- Step 2 built: `server/` (FastAPI: sign up / sign in / refresh / delete account, settings, clients, items, expenses;
  20 tests in `server/tests`), the new schema in `server/schema.sql` (already run in Supabase; old crm-solo tables gone),
  and in the app: the sign-in screen, the session in secure storage, the calendar loading real data, Sign out in Settings.
- The owner signed in with their old crm-solo login (it still exists in Supabase Auth with its old password).
  Two other old test logins (test…, 1@1…) also remain; harmless.
- **Next: Step 3, new invoice by typing.** Ask the owner before starting it.

## How the server runs (testing)
- `cd C:\polyglot-invoice\server` then `venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000`.
  Keys are in `server/.env` (copied from crm-solo, git-ignored). Tests: `venv\Scripts\python -m pytest`.
- The app finds the server automatically: the PC that runs Expo, port 8000 (`mobile/src/lib/api.ts`).
  `EXPO_PUBLIC_API_URL` in `mobile/.env.local` overrides it (Expo must be restarted to read it).
- Over Wi-Fi (LAN) works. A tunnel for the server (e.g. cloudflared) is not set up; installing it was blocked, ask the owner.

## How the owner runs the app on the iPhone (what worked)
- The owner has a free Expo account (**qanatolii**), signed in both in Expo Go and on the PC (`npx expo login`).
  The tunnel needs both sign-ins in this SDK.
- Same Wi-Fi: `cd C:\polyglot-invoice\mobile` then `npx expo start` (this is what works with the server).
- Tunnel: `npx expo start --tunnel` (`@expo/ngrok` is a dev dependency) — but then the phone can't reach the server on port 8000.
- If no QR code shows (Claude starting Expo in the background has no QR), the owner types the address
  `exp://<tunnel>.exp.direct` into Safari on the iPhone. Find it with `curl http://127.0.0.1:4040/api/tunnels`.
- The blue gear button on screen is Expo Go's own tools button, not part of the app.

## Files to read in a new chat
1. `CLAUDE.md`: how to work with the owner and the project layout
2. `docs/product-decisions.md`: every agreed product rule
3. `docs/build-plan.md`: the steps, in order
4. `docs/screen-map.html`: the approved screen sketches (open it in a browser)

## Background
- The old web app is in `C:\crm-solo` (FastAPI + plain JS + Supabase). It is a **reference only**. Reuse from it in
  step 2: `auth.py`, `database.py`, `voice_ai.py`, `doc_i18n.py`, `invoice_pdf.py` (Cyrillic fonts, 5 languages),
  `receipt_ai.py`, `money.py`, and the tests' fake-database approach (`tests/test_api.py`).
- The Supabase project from crm-solo holds only test data; the new schema may replace it (ask the owner first).
- The owner pays the Apple Developer account ($99/year) only when steps 0–9 are perfect. Until then: Expo Go only, no paid services.
