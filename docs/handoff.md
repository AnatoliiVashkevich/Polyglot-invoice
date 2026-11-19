# Where we stopped (handoff between chats)

Last updated: 2026-11-19. Update this file at the end of every session.

## Status
- **Steps 0 and 1 of `build-plan.md` are built** (Expo app, 4 tabs, the month calendar with FAKE data, the ＋ menu).
  It compiles, and the type check and lint pass. **It has not been tested on the owner's iPhone yet.**
- Node.js was upgraded to v26 on the owner's PC (Expo SDK 58 needs Node 22+).
- The next step after the iPhone test is **Step 2: server and database**.

## What the owner needs to do next (test on the iPhone)
1. Install **Expo Go** from the App Store.
2. The PC and the iPhone on the **same Wi-Fi**.
3. In VS Code, a new terminal:
   ```
   cd C:\polyglot-invoice\mobile
   npx expo start
   ```
4. Point the iPhone **Camera** at the QR code and tap "Open in Expo Go". If Windows asks about the firewall, click **Allow**.
5. If the phone can't connect: Ctrl+C, then `npx expo start --tunnel` (answer **y** if it asks to install something).

**Expected:** month calendar (year + month, Today, 4 colored filter chips), colored bars with first names, swipe between
months, tap a day to see its list below, the orange ＋ opens the menu (big "New invoice"; forms come in step 3),
4 tabs at the bottom (3 of them empty for now).
One change from the decisions to confirm with the owner: on a phone the bars are too small to tap one by one, so tapping
a day opens its list, and a row opens the job (job card in step 5).

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
