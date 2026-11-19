# Where we stopped (handoff between chats)

Last updated: 2026-11-19. Update this file at the end of every session.

## Status
- **Steps 0 and 1 are done and tested on the owner's iPhone (2026-11-19).** Layout fixes after the test: the gap under
  the filter chips (horizontal ScrollView needed `flexGrow: 0`), and a busy day shows 1 bar + a gray "+n" bar.
- **Next: Step 2, server and database.** Started 2026-11-19; first question to the owner: may the old crm-solo Supabase
  project (test data only) be reused for the new schema?

## How the owner runs the app on the iPhone (what worked)
- The owner has a free Expo account (**qanatolii**), signed in both in Expo Go and on the PC (`npx expo login`).
  The tunnel needs both sign-ins in this SDK.
- `@expo/ngrok` is a dev dependency of `mobile/`. Run: `cd C:\polyglot-invoice\mobile` then `npx expo start --tunnel`.
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
