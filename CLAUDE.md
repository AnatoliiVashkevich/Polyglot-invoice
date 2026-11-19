# Polyglot Invoice

An invoice-first iPhone app for solo contractors: voice → AI → invoice PDF in the customer's language, plus payments,
clients, expenses and a simple schedule.

**Before any work, read:**
1. `docs/product-decisions.md`: what the owner decided (the source of truth for every product rule)
2. `docs/build-plan.md`: the step-by-step plan. Work on the current step only, then ask the owner to test on the iPhone.

**Working with the owner:** they are not a developer and English is not their first language. Keep messages short and
plain, ask one question at a time, and record every new decision in `docs/product-decisions.md`.

**Folders**
- `mobile/`: Expo (React Native, TypeScript, expo-router). Read `mobile/AGENTS.md`: Expo changes every SDK; check the
  versioned docs, don't trust memory. Install packages with `npx expo install`. Check with `npx tsc --noEmit` and `npx expo lint`.
- `server/`: Python FastAPI (from build step 2).
- `docs/`: the decisions and the plan.

**Run on the iPhone:** in `mobile/`, run `npx expo start --tunnel` and scan the QR code with Expo Go.
