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
   **Your clients** → **＋ New client "typed name"** (prefilled) → **From your phone contacts** (changed 2026-11-19:
   "New client" must be easy to see). **＋ New client** on the Clients tab starts with this same search.
   Choosing a phone contact saves it as a client; if it is already a client (same phone or email), that client is used,
   no duplicate. The contacts permission is asked the first time ("to find your customers faster"); if refused, only
   clients and "New client" show. "Skip" only for tasks.
2. **Check the customer's info:** pre-filled, edit if needed.
3. **Work and prices in one sentence:** "installed 2 single swing doors, 200 each, 1 double swing 300".
   The AI turns it into clean lines (2 × $200 = $400; 1 × $300). Free users: "Work" + "Price" fields, ＋ for another line.
4. **Date:** today by default, changeable.
5. **Review:** every field editable → **Create invoice**.

(Changed 2026-11-19, §6f: there is no separate Expenses screen any more. Materials are lines on the invoice, and
Create asks whether to save what the user paid as expenses.)

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

## 6e. Details agreed while testing step 4 (2026-11-19)

- **Work step wording:** "Write what you did and the price. Use as many lines as you need: one fixed price for the whole
  job, or a line for each part. Charging by the hour? Put the hours in Qty." The quantity field is "Qty / hours".
- **Expenses step:** under the question, "No expenses? Tap Skip at the bottom."
- **Review shows everything printed on the PDF** before Create: FROM (the user's business: name, address, phone, email,
  how customers pay; tap to fill in / change), BILL TO (the client with address, phone, email), lines, tax, total,
  number, date and due, terms.
- **PDF:** the client's name, address, phone and email are together under BILL TO. JOB SITE shows only when the job
  address differs from the client's address.
- **Calendar:** shows only the weeks the month needs (4–6), no extra row of next month.
- **Send stays automatic** (owner, 2026-11-19): closing the share sheet after Send switches the invoice to Requested,
  without asking "Did you send it?". The status can still be changed by hand.
- **Day list rows:** a long, multi-line description is shortened to one line; the amount and the status always show.

## 6f. Details agreed while testing step 5 (2026-11-19)

- **Every button has a frame** (border), so it clearly looks like a button. "＋ Another line" is an outlined button.
- **Text fields have a visible frame** (the work description too), so they clearly look like fields.
- **Estimate wording:** "What work will you do?" and "Write the work and materials you offer, with prices…".
- **Work / Materials on every line** (estimates and invoices; the tax on materials works). **The Expenses screen is
  gone.** When an invoice with Materials lines is created, a window asks **"Add these materials to your expenses?"**:
  each material shows **"I paid $"** (filled in with the line amount, changeable, because the customer may pay more),
  then **Add to my expenses** or **Later**. It explains: expenses show how much you really earn; **each cost is
  counted once**: here, or later from the receipt with ＋ → Expense, not both. Saved expenses are linked to the invoice.
  (Step 8 should warn when a receipt looks like one already saved for that invoice.)
- **Prices travel along the job:** a task scheduled from an estimate keeps the estimate's lines and total (shown on the
  task card as "Price (from the estimate)"). "Job done → Create invoice" then fills everything in and opens Review
  right away; the user can still change anything.
- **"Choose more contacts"** became **"Pick from all contacts"**: it opens the iPhone's own contact list, and tapping a
  person picks them. If iOS hides that person (only some contacts shared), a message explains it and opens Settings →
  Contacts → Full Access; the user can also just type the name.
- **The first question is "Choose the customer"** (not "Who is it for?", which could mean "for me").
- **No flash of the first question** when a task / invoice is made from another job: nothing shows until it's loaded.

## 6g. Repeating tasks and notes (decided 2026-11-19)

- **Repeat** works for **tasks and notes** (not invoices). In New task / New note, after "When?", a screen
  **"Repeat?"**: Never (default) · Every week · Every 2 weeks · Every month · Every year · Custom (every N days / weeks /
  months), and **Until** a date or **No end date**.
- Each visit shows on its own day in the calendar with its own reminder, and is marked done on its own.
- On a repeating task the big button is **✓ Done**; **Make invoice** stays as a smaller button.
- Editing or deleting one visit asks, like the iPhone Calendar: **Only this one** / **This and all next ones**.
- **A task always has a customer** (owner: it should have contact info: Call / Text / Navigate, the address, invoice
  later, the client's page). The **Skip** on the customer step goes away.
- **Notes** (＋ → Note): text and a day; optional time, reminder and repeat; no customer, no prices; their own color in
  the calendar. Anything without a customer is a note ("Pick up tile", "Pay the truck insurance").
- A note has an **optional ✓ Done**: it fades like a paid invoice; never turns red, never nags. On a repeating note ✓
  marks only that day.

## 6h. Clients, improved (decided 2026-11-19)

- **"Client", not "customer"**, everywhere in the app (owner: "customer sounds wrong").
- **The client's page with many jobs:** filter buttons **All · Invoices · Estimates · Tasks · Owes** (with counts),
  jobs **grouped by month** ("November 2026 · 4 · $2,300 invoiced"), **20 at a time** with **Show more**.
- **From every job to the client:** on a task, estimate or invoice the client's name opens their page, and
  **Call · Text · Navigate** are right there (Navigate goes to the job's address).
- **Several addresses per client:** the main one is the **Billing address**; **Other addresses** have a short name
  (Rental, Office…). Making a job for a saved client asks **"Where is the job?"** (chips; **＋ Another address** adds
  one to the client right there). The PDF shows JOB SITE when it isn't the billing address. On the client's page every
  address has its own **Navigate**.
- The list of a client's jobs is called **History**. It has two parts: **Upcoming** (after today, soonest first; a
  repeating series shows once, as its next visit) and the history itself (today and before, newest first, by month).
- **Leaving an invoice or estimate that isn't sent yet asks** "This invoice is not sent yet. Send it to the client
  now?" → **Later** / **Send now** (owner, 2026-11-19).
- **An invoice can still be made from a done task** ("Make invoice"), until one exists.
- **§6i Two stories, no "mode" to pick** (owner, 2026-11-19): the job's linked stages decide the big button.
  - Pay after the job: Estimate → Schedule the job → task → **Job done → Create invoice** → Send → Paid.
  - Pay before the job: Estimate → Make invoice → Send → **Schedule the job** (on any invoice without a task yet;
    the task keeps the invoice's prices) → task → **✓ Job finished**.
  - **A task always shows its invoice as a card** (number, amount, paid / sent / not sent), tap to open it, whatever
    its status. No separate "Show invoice" button, and no small "Job finished" next to the big one.
  - A deposit (part before, the rest after) is planned with step 8.
- **🔗 Linked** on every job card, hidden until tapped: the same job's other stages (estimate → task → invoice);
  tap one to open it.
- **§6j Teach every status, prevent mistakes** (owner, 2026-11-19): under the status on every job card, one plain line
  says what it means and what happens next ("You get a reminder 1 hour before", "Only you can see it. Tap Send
  invoice…"). The task button says **✓ Job finished** (not just "Done", which looked like "saved"), and marking a task
  or note done always asks first: "Is the job finished? It is planned for Nov 27 at 9:00. After this, its reminder is
  turned off." → **Not yet** / **Yes, it's finished**. New status buttons follow the same rule.
- **One place for Edit and Delete on every page:** **✏️ Edit** at the **top right** (a bit bigger, the same
  everywhere); **Delete** at the **bottom**, away from other buttons, so nothing is deleted by accident.
- **On the Clients tab the ＋ menu offers "New client" first** (big), then Invoice · Estimate · Task · Expense; no
  separate "New client" button.
- History: finished jobs stay in the calendar (faded, ✓) and on the client's page; that is enough (owner, 2026-11-19).

## 6k. Step 7, part 1: describe the work in one go (2026-11-19)

- On the work step, at the top: **"✨ Describe it in one go"** — one field ("door installation 300, 2 double swing
  doors installation and adjustment 700, hinges 3 at 12 each") and **Make lines**. The lines appear below, every one
  editable; rows the user already filled stay. Typing lines by hand still works.
- The AI (OpenAI, model gpt-5.4-mini) keeps the user's language and words, puts counts into Qty (not twice in the
  text), splits a total by the count, marks bought things as Materials, never invents prices.
- **Consent first** (App Store rule §2): the first time, "Use AI to make the lines? Your text is sent to OpenAI…
  OpenAI does not use it to train its AI." → Not now / Yes, use AI. Without consent or without internet, the app's own
  quick reader makes lines from the numbers typed, and says so.

## 6l. Step 7, part 2: the invoice in the document language (2026-11-19)

- The user writes and checks the lines in their own language (e.g. Russian); **the PDF comes out in the invoice
  language** (Settings → Invoice language, e.g. English). The app keeps the user's words; each line is translated
  once and remembered, and only a changed line is translated again. Without the AI the PDF keeps the user's words.
- **The AI knows the trade** (owner): a home-repair contractor, so "пол" = floor (never gender), "затирка" = grout,
  "плинтус" = baseboard… And it tidies the user's words into invoice wording in the same language ("съездил в
  магазин" → "Поездка в магазин за материалами") without changing the meaning.
- **"Check in my language":** above the invoice preview, a switch **English · sent | Русский · check**.
- **Settings (for now):** **Your language** (you write and check in it; the screens follow in step 9) and **Invoice
  language**.
- Still to do in step 7: the client's extra copy in their language (how to send two files is to be decided), voice,
  fixing a translation by hand, translating the terms.

## 6m. The AI knows the user's work (2026-11-19)

- **Settings → "What kind of work do you do?"**: pick one or more (Handyman / repair, Construction / remodeling,
  Cleaning, Landscaping / lawn care, Painting, Plumbing, Electrical, HVAC, Flooring / tile, Moving, Auto repair,
  Hair / beauty, Pet care, Tutoring / lessons, IT / computer help, Photography) and **Other** (free text). For anyone:
  a hairdresser, a tutor… (owner). Also asked in the first-launch setup (step 9).
- For now it sits on the main Settings page for testing; in step 9 Settings becomes groups (Business › Invoices ›
  App › Account › About, §11): "What kind of work do you do?" goes under **Business**, the invoice language under
  **Invoices**, your language under **App** (owner, 2026-11-19).
- The AI reads every word in that work's sense ("укладка": a blowout for a hair salon, sod for lawn care). Before a
  choice: a neutral small service business, no construction guesses. The repair glossary ("пол" = floor) stays as help.

## 6n. When the AI isn't sure, it asks (2026-11-19)

- Owner: "пердел 100" stayed in Russian and became "curtain" in English. Now, when the AI isn't sure what a part means
  (a typo, an unknown or odd word, two meanings), it keeps the user's words and asks **under that line, in the user's
  language**: "❓ Что вы имели в виду под «пердел»?" → **Use «Переделка»** (its best guess) · **Keep as I wrote** ·
  or correct the text. It never guesses silently; translations never swap in an unrelated word.
- **Lines typed by hand are checked too, when the user taps Next** on the work step: unclear, rude, or not paid work
  ("спал") → the same question under the line; Next waits until it is answered (Use / Keep as I wrote / correct).
  Without the AI or consent, Next simply goes on.
- **Translations are faithful above all** (owner's invoice: "Срал" came out as "Installed door"): each translation
  echoes its own line and is refused if the lines got mixed up; odd lines are translated literally, never "cleaned up"
  into invented work. Old translations are made again with these rules.
- **The client's extra copy in their language is hidden for now** (owner: "hide it and all about it, remind me at the
  last point"): no language question on the client screens. The data stays; switch: `mobile/src/lib/features.ts`.

## 13. Database (decided 2026-11-19)

- The new app **reuses the crm-solo Supabase project and its keys**. Its old tables hold only test data and are
  replaced by the new, simpler schema (old test logins may be deleted too).

## Still to decide (raised by the owner while testing step 5, 2026-11-19; remind the owner)

1. ~~Easier work + price entry~~ → part 1 built, §6k (voice comes next).
   Old note: **Easier work + price entry.** Ideas: one big field where the user writes the work and prices in their own words and
   we split it into lines ("door installation 300", Next line, "2 double swing doors installation and adjustment 700"),
   or a "type a line, tap Next line" flow. Discuss now and again when the AI is connected (step 8, voice): these
   screens will be reworked then anyway.
2. ~~Repeating tasks~~ → decided, §6g.
3. ~~History~~ → decided, §6h (the calendar and the client's page are enough).
4. ~~Notes~~ → decided, §6g.
6. **The client's copy in their language — REMIND THE OWNER AT THE LAST POINT (before release).** Hidden now (§6n).
   To decide: how to send two files (one PDF with both languages · Mail + Messages with two attachments · two shares).
5. **Charging before the visit (prepayment / deposit)** — asked again 2026-11-19; planned with step 8 (Money): today an invoice can already be made from an estimate before
   the job ("Make invoice"). Still to discuss: a deposit (part now, the rest after the job) and how it shows.
