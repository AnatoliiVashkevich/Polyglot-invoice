# Polyglot Invoice — product decisions (iPhone app)

The agreed user flow and rules, collected question by question with the owner. Updated after every answer.
Last updated: 2026-11-19.

## 1. Product and platform

- **Main goal:** create invoices fast. Bonuses: payment tracking, reports, client base, income and expenses, a simple schedule.
- **Platform:** iPhone app built with Expo (React Native), developed on Windows and tested on the iPhone with **Expo Go**.
  The Python server (AI, PDFs, data) runs online; Supabase stays.
- **Selling it:** the app will be sold through the App Store.

## 2. App Store rules we follow from day one

1. Account deletion inside the app.
2. A privacy policy, and a clear notice plus consent before voice or text is sent to OpenAI.
3. Microphone and contacts permissions are asked only when first needed, with a reason.
4. Subscriptions use Apple in-app purchases (Apple keeps 15–30%). Customers paying the user for jobs is not affected.
5. Sign in with Apple is offered.
6. The calendar works like Apple's, but its look is our own (no copied design or icons).
7. No unfinished screens; a demo account for Apple's reviewer.

## 3. Free trial and subscription

- **14-day free trial of Pro**, everything included, **no card needed**. The trial is tied to the account, so reinstalling doesn't
  restart it. Then a subscription through Apple (Face ID; no card typed into the app). Managed with RevenueCat.
- **Free plan (after the trial):** up to **300 invoices in total**, created by typing · send the PDF · Mark Paid ·
  calendar with invoices · client list (created from invoices). After 300 invoices, a subscription is needed to create
  more (everything stays visible and exportable).
- **Pro:** 🎤 voice with AI · AI translation of PDFs · estimates · tasks / schedule · Money and reports ·
  expenses, receipt photos, photos · Navigate / Call / Text buttons.
- **Users never lose information:** after the trial, Pro items stay **visible, read-only**, and **export of all data**
  (CSV and PDFs) is always free.
- The Free/Pro split is stored on the server, so it can change without a new App Store release.
  Avoid taking features away from people who already pay.

## 4. One object: Task → Estimate → Invoice

- Task, estimate and invoice are **stages of the same job**, created and edited with the same flow.
- Money counts as **income only when the invoice is Paid**.
- **Invoice statuses:** Created (normal look) → Requested (clearly marked, waiting for money) → Paid (lighter, ✓).
  Sending through the share sheet switches it to Requested automatically; the user can change the status by hand at any time.
- **Task statuses:** Created → Done; it can be turned into an estimate or an invoice.
- **Estimate statuses:** Created → Sent (automatically when sent). There is **no "Accepted"**: scheduling the job means
  the customer said yes.
- **One big "next step" button** on every job card, so nobody has to figure out what to do:

  | The job is… | The big button says |
  |---|---|
  | Estimate, Created | **Send estimate** (it becomes Sent) |
  | Estimate, Sent | **Schedule the job** · **Make invoice** |
  | Scheduled job | **Job done → Create invoice** (prefilled) |
  | Invoice, Created | **Send invoice** (it becomes Requested) |
  | Invoice, Requested | **Mark Paid** |
  | Paid | ✓ Done, no button |

  Other actions (Edit, PDF, Delete…) are smaller, underneath. Steps can be skipped (a quick job can go straight to an invoice).

## 5. Calendar (first screen)

- A month calendar that works like the iPhone calendar: swipe between months (the year follows), Today, an accent circle
  on today's date, one big **＋** for creating.
- **Tapping a day shows that day's list under the month**, on the same screen.
- **Entries in the month grid:** small rounded colored bars showing the **customer's first name**.
  Colors: Task blue · Estimate purple · Invoice green · unpaid invoice red.
- **An invoice shows on its own date:** today by default, changeable by the user.
- **Paid invoices stay** on the calendar, lighter with a ✓.
- **Overdue** (Requested and past its due date): a red mark.
- **A row in the day list:**
  `● Ann Lee · Invoice INV-0012` / `Installed 3 doors · $700 · Requested`.
  Tasks also show the address. Tap to open the full card; swipe left for quick actions (Mark Paid, Send).

## 5b. The ＋ button

A small menu, with the accent on invoices:

```
[ 💵  New invoice        ]   ← big, highlighted, first
  📋 Estimate   ☑️ Task   🧾 Expense   ← smaller
```

## 6. Creating an invoice: a questionnaire, one question per screen

AI is an optional shortcut inside the same flow: whatever the user says fills in the next answers, and the
filled-in steps are skipped. Free users get the same screens with plain fields.

1. **Customer:** **one search box**. Recent clients show before typing. As the user types, results come in this order:
   **Your clients** → **From your phone contacts** → **＋ New client "typed name"** (prefilled).
   Choosing a phone contact saves it as a client; if it is already a client (same phone or email), that client is used,
   no duplicate. The contacts permission is asked the first time ("to find your customers faster"); if refused, only
   clients and "New client" show. "Skip" only for tasks.
2. **Check the customer's info:** pre-filled, edit if needed.
3. **Work and prices in one sentence:** "installed 2 single swing doors, 200 each, 1 double swing 300".
   The AI turns it into clean lines (2 × $200 = $400; 1 × $300). Free users: "Work" + "Price" fields, ＋ for another line.
4. **Expenses, if any, with a price:** "materials 64.50". Each has a switch **"Add to invoice?"** (on by default).
   It is always saved as the user's expense as well.
5. **Date:** today by default, changeable.
6. **Review:** every field editable → **Create invoice**.

**After Create:** the PDF opens with a big **Send** button (share sheet: Mail, Messages, WhatsApp…), **✏️ Edit** and **Later**.
- Editable until **Paid**. Editing after sending asks "Send the updated invoice to the customer?"
- A paid invoice is locked until the payment is undone.

## 6b. Creating a task (scheduled job)

One question per screen, like invoices:
1. Customer (or skip)
2. What to do (🎤 or type)
3. Date and **time**
4. Reminder: **1 hour before** by default (none / 30 min / 1 hour / 1 day). A phone notification.

No prices and no duration. Prices are added later, when the job becomes an invoice.

## 6c. Adding an expense outside an invoice (Pro)

1. The **＋** button offers **Expense** alongside Invoice / Estimate / Task.
2. Take a photo of the store receipt. The AI reads the store, amount, date and category.
3. Check it. Link it to a **client** (with its date that's enough to find it later), or leave the default
   **General business**. Not linked to a specific job: jobs are harder to pick from a list.
4. Save.

## 7. Invoice details

- **Sales tax:** **off by default**. In Settings: one **tax %** and **"Tax applies to: Materials only / Everything"**,
  with the note "Check your state's rules or ask your accountant." (Background: in many states, Florida included,
  a contractor who installs materials pays the tax at the store and does not charge it again.)
  - Review screen: one line "Sales tax 7% (materials) $4.52" with a switch to turn it off for one invoice (tax-exempt customer).
  - PDF: Subtotal · Sales tax · Total.
  - Money screen: "Sales tax collected (owed to state)" is shown separately and **not counted as income or profit**.
  - CSV: its own tax column.
- **Invoice terms:** an optional text in Settings → Invoices, printed at the bottom of every invoice
  (e.g. "1-year warranty on labor", "Late fee 1.5% per month").
- **Due date:** a default in Settings (**Now** / 7 / 15 / 30 days), changeable on each invoice. Shown as "Due: Now".
  ("Receipt" in the app always means a **store receipt**.)
- **Late invoices:** a red mark on the calendar, plus one phone notification ("Ann Lee's invoice $450 is 3 days late")
  with a button that opens a ready, polite reminder message to the client.
- **Numbers:** INV-0001, INV-0002… by default. Editable on any invoice; the next number continues from the user's own
  format ("2026-045" → "2026-046", "A-17" → "A-18"). A used number gives a warning and the next free one.
  Estimates: EST-0001… the same way.

## 8. First launch (business info for the PDFs)

One question per screen. Each screen has a short "why" line and a live invoice preview at the bottom.
Only the business name is required; everything else can be added later in Settings.

| Screen | Why (shown to the user) |
|---|---|
| Business name | "Shown at the top of every invoice." |
| Logo | "Makes your invoices look professional. You can add it later." |
| Phone and email | "So customers can contact you about an invoice." |
| Address | "Required on invoices in many states, and it builds trust." |
| How customers pay you | "Printed on invoices so customers know how to pay you, like Zelle or Venmo." |
| Languages | "App language: your screens. Document language: what your customers read." |

**Sign in:** Sign in with Apple (Face ID), plus email and password as a backup.

## 9. Languages: the main selling point

| Whose | Example | Used for |
|---|---|---|
| **The user's** | Russian | Screens, dictation, the review step. Everything the user reads in the app. |
| **Official** (Settings → Document language) | English | The main invoice, always sent; for taxes and records. |
| **The client's** (on the client's info) | Spanish | An extra copy, only when it differs from the official one. |

- Two separate files are sent together: `INV-0012-EN.pdf` + `INV-0012-ES.pdf`.
- **"Check in my language":** a preview of the invoice in the user's language, never sent.
- **Hidden until needed:** the client's language is a single line on the client's info ("Preferred language"), empty by default.
  The Send screen says plainly: "Sends 2 files: English + Spanish".
- **Fixing translations:** (A) the main way is editing the user's own text, after which the translation is redone automatically;
  (B) a small ✏️ on each translated line, kept as written once fixed by hand.
  If the original of a hand-fixed line changes later, the app asks before replacing the user's translation.
- **Made carefully:** a trade glossary for the AI, quality tests in all 5 languages before release, and the App Store
  pitch leads with it ("Speak your language, bill in your customer's").
- Languages: English, Spanish, Portuguese, Russian, Ukrainian.
- **Usability:** 2–3 real contractors try it through Expo Go as soon as the first screens work.

## 9b. The client's page

1. Name, phone, email, address, notes, and **Preferred language ▾** (empty = the official document language).
2. Buttons: **Call · Text · Navigate** (Pro).
3. Two numbers: **Paid total** · **Owes now**.
4. Their jobs (invoices, estimates, tasks), newest first, in the same rows as the day list.
5. No separate "new invoice" button: the normal **＋** on this page **pre-fills this client**
   (the questionnaire starts at "check the customer's info").

## 10. Money screen (Pro)

1. Period: This month ▾ (quarter, year, custom)
2. Three big numbers: **Received** (paid) · **Waiting** (requested) · **Expenses**
3. **Profit** = received − expenses, and **Set aside for taxes** (% from Settings)
4. The list of payments and expenses, newest first
5. **Export CSV** for the accountant

## 11. Settings

1. **Business:** name, logo, phone, email, address, how customers pay you
2. **Invoices:** document language, sales tax (% + Materials only / Everything), default due date,
   next invoice number, invoice terms
3. **App:** app language, notifications (task reminders, late invoices)
4. **Account:** subscription, export all data, sign out, **delete account**
5. **About:** Terms of Use, Privacy Policy (required by Apple), app version, **Send feedback**, contact support

## 11b. Navigation

A bottom bar with 4 tabs: **Calendar · Clients · Money · Settings**. The orange **＋** floats above it on every main screen.

## 12. Name

**Polyglot Invoice**. A quick web search found no app with this name. Before publishing, check the App Store,
the website address (polyglotinvoice.com) and a USPTO trademark search.

## 6d. Details agreed while testing step 3 (2026-11-19)

- **Customer step order:** search box → the contacts row → Recent clients (before typing) / results (while typing).
- **The contacts row is always visible** when it can help: "Search your phone contacts" (not asked yet),
  "Choose more contacts" (only some contacts shared: opens the iPhone's contact chooser again),
  "Allow contacts in Settings" (refused). With full access there is no row: matching contacts appear while typing,
  or "No phone contacts match…".
- **Work lines** have Work · Qty (default 1) · Price, so "2 × $200" can be typed without voice.
- **The client's language is asked as a friendly question, not "Preferred language":**
  "Also send a copy in your client's language?" with the line "The invoice is always in English. If your client reads
  another language better, they also get a copy in that language." Choices: "No, English only" · Español · Português ·
  Русский · Українська ("English" = the document language from Settings). The same wording goes on the client's page (§9b).

## 13. Database (decided 2026-11-19)

- The new app **reuses the crm-solo Supabase project and its keys**. Its old tables hold only test data and are
  replaced by the new, simpler schema (old test logins may be deleted too).

## Still to decide

Nothing open. Next step: a one-page screen map for approval, then development.
