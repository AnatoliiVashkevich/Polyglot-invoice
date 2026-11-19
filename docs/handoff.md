# Where we stopped (handoff between chats)

Last updated: 2026-11-19. Update this file at the end of every session.

## Status
- **Steps 0–4 are done and tested on the owner's iPhone (2026-11-19).** The owner loves the app so far.
- Step 4 built: server `invoice_pdf.py` + `doc_i18n.py` (PDF labels in 5 languages; Cyrillic via Arial on Windows —
  hosting will need DejaVu or PDF_FONT), `GET /api/items/{id}/pdf?lang=`; app `src/app/invoice/[id].tsx` (PDF preview
  in a WebView, Send / Mark Paid / Undo payment / Edit / Later), `components/mark-paid-sheet.tsx`,
  `components/business-sheet.tsx` (FROM details, opened from Review), edit mode in `new-invoice.tsx` (`?id=`),
  swipe actions in the day list, "!" on overdue bars, calendar shows only the weeks a month needs.
- Owner decisions from testing are in `product-decisions.md` §6d–6e (Send stays automatic, wording, review = everything
  on the PDF, client details together on the PDF).
- Tests: server 42 (`test_invoice_flow.py` walks a whole invoice and reads the PDF text), app 14 (`npm run check`).
- **Next: Step 5, the job card and the stages** (estimates, tasks, reminders). Ask the owner before starting it.

## How the server runs (testing)
- `cd C:\polyglot-invoice\server` then `venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-exclude venv --reload-exclude tests`.
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
