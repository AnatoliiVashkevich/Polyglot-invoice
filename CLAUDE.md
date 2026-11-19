# Polyglot Invoice

An invoice-first iPhone app for solo contractors: voice → AI → invoice PDF in the customer's language, plus payments,
clients, expenses and a simple schedule.

**Before any work, read:**
0. `docs/handoff.md`: where the last session stopped and what the owner was asked to do
1. `docs/product-decisions.md`: what the owner decided (the source of truth for every product rule)
2. `docs/build-plan.md`: the step-by-step plan. Work on the current step only, then ask the owner to test on the iPhone.

**Working with the owner:** they are not a developer and English is not their first language. Keep messages short and
plain, ask one question at a time, and record every new decision in `docs/product-decisions.md`.
At the end of each session, update `docs/handoff.md` and commit.

**Folders**
- `mobile/`: Expo (React Native, TypeScript, expo-router). Read `mobile/AGENTS.md`: Expo changes every SDK; check the
  versioned docs, don't trust memory. Install packages with `npx expo install`. Check with `npx tsc --noEmit` and `npx expo lint`.
- `server/`: Python FastAPI (from build step 2).
- `docs/`: the handoff note, the decisions, the plan, and `screen-map.html` (the approved screen sketches).

**Tests: run them all before every commit** (they guard what the owner already tested on the iPhone):
- server: `cd server` then `venv\Scripts\python -m pytest` (offline, fake database; `test_invoice_flow.py` walks a whole
  invoice and reads the PDF text)
- app: `cd mobile` then `npm run check` (plain-Node unit tests in `src/**/*.test.ts` + type check + lint)
New rules get a test in the same commit. Pure app logic goes in `src/lib/` files without `@/` imports so Node can test it.

**Run on the iPhone:** the phone and the PC on the same Wi-Fi. Start the server (see `docs/handoff.md`), then in
`mobile/` run `npx expo start` and scan the QR code with Expo Go. (A tunnel can't reach the server on port 8000 yet.)
