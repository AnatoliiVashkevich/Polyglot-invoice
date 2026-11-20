# Where we stopped (handoff between chats)

Last updated: 2026-11-19. Update this file at the end of every session.

## Status
- **Latest (2026-11-19, end of the long session):** after step 6 the owner asked for, and got: clients improved
  (§6h), repeating tasks and notes (§6g), Edit top right / Delete bottom, linked stages + the two stories pay-before /
  pay-after (§6i), status teaching lines and "Is the job finished?" (§6j), client page Upcoming / History.
  Tests: server 86 (95% coverage, main.py 99%), app 47 (src/lib 100% lines). ✓ Done on notes stays (agreed earlier;
  the owner asked why, got the reason, did not ask to remove it).
- **Step 7 in progress.** Part 1 built (§6k): `server/ai.py` (OpenAI, `OPENAI_API_KEY` in `server/.env`, model
  `AI_TEXT_MODEL` default gpt-5.4-mini), `POST /api/ai/lines`; app `src/lib/ai.ts` (consent + call),
  `src/lib/quick-lines.ts` (offline reader), "✨ Describe it in one go" in `new-invoice.tsx`. Part 2 built (§6l):
  `ai.translate_texts` + `_translated()` in main.py (cached per line in `lines[].tr`), language switch on the job card,
  languages in Settings. Tests never call the real AI (conftest `no_real_ai`). Trade context §6m: `ai.context(trade)`,
  `businesses.trade` — **owner must run:** `alter table businesses add column if not exists trade text not null default '';`
  Next parts: 🎤 voice
  (transcribe → fill the questionnaire), translated PDF in the client's language, "Check in my language", fixing
  translations. Windows: print Cyrillic from Python with `PYTHONIOENCODING=utf-8`.
- **Step 5 is done and tested on the iPhone (2026-11-19).** Feedback fixed (product-decisions.md §6f): button and
  field frames, Work / Materials on every line (no Expenses screen; Create asks "Add these materials to your expenses?"),
  prices kept from estimate → task → invoice, "Pick from all contacts", "Choose the customer". The job card is
  `src/app/job/[id].tsx`; notifications in `src/lib/notifications.ts` (the late-invoice notice was not seen live yet).
- **Step 6 (Clients) is done and tested on the iPhone (2026-11-19): "perfect".** Clients tab
  `src/app/(tabs)/clients.tsx` (search, "owes $" per client, "＋ New client"), the client's page `src/app/client/[id].tsx`
  (Call / Text / Navigate, Paid total / Owes now, contacts, language, notes, their jobs newest first; ＋ pre-fills the
  client), `src/app/edit-client.tsx` (edit / new / delete). Pure helpers in `src/lib/client-tools.ts` (tested).
  Server `GET /api/clients` now returns `paid` and `owes`.
  **Open ideas to discuss with the owner** are in product-decisions.md "Still to decide" (easier price entry, repeating
  tasks, history, notes). Remind the owner about them.
- If Metro says a package "could not be resolved" after a new install: stop Expo and run `npx expo start --clear`.
- The owner saw the app "crash like a reload" sometimes. Most likely Fast Refresh reloading while code was being
  edited; the owner will report if it happens when nothing is being changed (ask for the screen and a screenshot).
- **Clients improved (2026-11-19, §6h):** "client" wording, client page filters / months / Show more, client info
  and Call / Text / Navigate on every job (`components/contact-bar.tsx`), several addresses per client
  (`components/address-picker.tsx`). **The owner must run in Supabase SQL:**
  `alter table clients add column if not exists addresses jsonb not null default '[]'::jsonb;`
  (saving a client fails until then). Then the owner tests; then repeating tasks and notes (§6g).
- **Repeating tasks and notes built (2026-11-19, §6g), waiting for the owner's test.** Server: `repeat.py` (dates),
  kind "note", `series_id` + `repeat` on items, one row per visit, `?scope=one|following` on PATCH / DELETE, no end
  date extends in `GET /api/items`; a task needs a client. App: `new-note.tsx`, `components/repeat-picker.tsx`,
  `components/ask-scope.ts`, Repeat step in `new-task.tsx` (no Skip), notes in the calendar (amber, 📝, 🔁 for
  repeating), ✓ Done on the job card. **The owner must run in Supabase SQL:**
  ```
  alter table items drop constraint if exists items_kind_check;
  alter table items add constraint items_kind_check check (kind in ('task','estimate','invoice','note'));
  alter table items add column if not exists series_id uuid;
  alter table items add column if not exists repeat jsonb;
  create index if not exists items_series_idx on items (series_id);
  ```
- **Next (older note):** first the open ideas in product-decisions.md "Still to decide" (repeating tasks, easier price entry,
  history, notes, deposits), then Step 7 (voice and languages). Ask the owner which first.
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
- `cd C:\polyglot-invoice\server` then `venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000` (no --reload: on Windows it gets stuck; restart the server after changing server code).
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
