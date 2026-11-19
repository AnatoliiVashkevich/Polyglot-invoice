# Polyglot Invoice — build plan (instructions for Claude)

Read this file and `product-decisions.md` at the start of every session. Work on ONE step at a time, in order.
A step is done only when its **"Test on iPhone"** works for the owner. Then mark it `[x]`, note anything changed in
`product-decisions.md`, and ask before starting the next step.

**Rules for every step**
- Messages to the owner: short, one question at a time (they're not a developer).
- Follow `product-decisions.md`. If something isn't decided there, ask; don't invent product rules.
- App Store rules from day one: permissions asked only when needed, with a reason; no copied Apple design; no placeholder screens shipped.
- Every screen string goes through translations (5 languages) from the start; English first, the others before release.
- Server changes come with tests. App logic that handles money (totals, tax, numbering) gets unit tests.
- Commit to git at the end of each step (the owner has asked to keep things safe).

**Project**
- New folder `C:\polyglot-invoice` (a separate git repository; the old `C:\crm-solo` stays untouched as a reference).
  - `mobile/`: Expo SDK 58 (React Native, TypeScript, expo-router). Tested with **Expo Go** on the owner's iPhone.
  - `server/`: Python FastAPI. Reused from crm-solo: auth, Supabase access, `voice_ai.py`, `doc_i18n.py`, `invoice_pdf.py`,
    `receipt_ai.py`, the money math, adjusted to the new tables.
  - `docs/`: these two files.
- Database: a new, simpler schema (clients, items, expenses, settings).

---

## Steps

### [x] 0. Setup: "Hello" on the iPhone  — tested on the iPhone 2026-11-19
- Check Node (Expo needs a recent Node 20 LTS or newer; upgrade if needed), create the folder and git repo, create the Expo app.
- Run it with `npx expo start --tunnel`; the owner scans the QR code with Expo Go.
- **Test on iPhone:** the app opens and shows "Polyglot Invoice" and the 4 bottom tabs.

### [x] 1. The calendar (fake data)  — tested on the iPhone 2026-11-19
- Month grid like the iPhone calendar, in our own look: swipe between months, the year follows, Today button, accent circle
  on today, filter chips, colored bars with the customer's first name, the day list under the month, the floating ＋ with its menu.
- **Test on iPhone:** swiping, tapping days, the list, the ＋ menu all feel natural.
- Note: on a phone the bars are too small to tap one by one, so tapping a day opens its list and a row opens the job
  (the job card comes in step 5). Tell the owner if this differs from the decisions.

### [x] 2. Server and database  — tested on the iPhone 2026-11-19
- New schema; FastAPI endpoints for clients, items (task / estimate / invoice), expenses, settings; tests.
- Run the server on the PC, reachable from the phone through a tunnel (later: hosting).
- Sign in with email and password (Supabase). Sign in with Apple comes in step 10 (it needs a development build).
- **Test on iPhone:** sign up, sign in; the calendar now shows real (empty) data.

### [x] 3. New invoice by typing (the core, Free plan)  — tested on the iPhone 2026-11-19
- The questionnaire: 1 customer (search clients → phone contacts → new) · 2 check info · 3 work + prices
  (plain fields) · 4 expenses with "Add to invoice?" · 5 date and due date · 6 review → Create.
- Numbering (INV-0001, editable, continues the user's format), optional tax, totals.
- **Test on iPhone:** create a real invoice in under a minute; it appears on the calendar.

### [x] 4. PDF, send, paid  — tested on the iPhone 2026-11-19
- The PDF (official language; labels translated), the share sheet → Requested automatically, Edit / Later, Mark Paid
  (method + date), Undo payment, paid = locked, swipe actions in the day list.
- **Test on iPhone:** send yourself an invoice via Messages or Mail, mark it paid, see it turn light with ✓.

### [ ] 5. The job card and the stages
- The next-step button; estimates (Created → Sent → Schedule the job / Make invoice); tasks (customer, what, date + time,
  reminder); task → invoice prefilled; local notifications for task reminders and late invoices (with the ready reminder message).
- **Test on iPhone:** walk one job from estimate → scheduled → done → invoice → paid.

### [ ] 6. Clients
- Clients tab: list, search, the client page (contacts, preferred language, paid / owes, their jobs); ＋ pre-fills the client;
  Call / Text / Navigate.
- **Test on iPhone:** find a client, call, navigate, start an invoice from their page.

### [ ] 7. Voice and languages (the main selling point)
- 🎤 recording → AI fills the questionnaire (skips filled steps) · the trade glossary · two PDFs (official + client's
  language) · "Check in my language" · fixing translations (edit your text, or ✏️ on a translated line) · AI consent notice.
- **Test on iPhone:** dictate in Russian, the client gets English + Spanish PDFs that say exactly what was meant.

### [ ] 8. Money and expenses
- Expense with receipt photo (AI reads it), linked to a client or General business; Money screen (periods, received,
  waiting, expenses, profit, tax set-aside, sales tax shown separately); CSV export.
- **Test on iPhone:** add a receipt, see this month's profit.

### [ ] 9. First launch, settings, translations
- Onboarding (6 screens with "why" lines and the live preview); Settings (Business, Invoices, App, Account, About with
  feedback); export all data; delete account; all 5 languages complete.
- **Test on iPhone:** a fresh account set up in 2 minutes; switch the app to Russian; delete a test account.

### [ ] 10. Plans and Apple-only features (needs the Apple Developer account, $99/year)
- **The owner pays the $99 only when steps 0–9 are perfect.** Until then: no paid accounts, Expo Go only.
- Development build with EAS (replaces Expo Go for testing); Sign in with Apple; RevenueCat: 14-day Pro trial without card,
  then subscription; Free plan = 300 invoices total; Pro features locked but visible; limits stored on the server.
- **Test on iPhone:** trial countdown, subscribe in Apple's test mode (sandbox), Free plan limits.

### [ ] 11. Release
- Host the server online; privacy policy and terms (website); App Store listing that leads with languages;
  screenshots; icon; TestFlight with 2–3 real contractors; fixes; submit for review.
- **Test:** testers use it for real work for a week.
