# Task script — onboarding (first-run experience)

**Flow under test:** sign-up → 5-step onboarding → first real action
**Environment:** local dev (`http://localhost:5173`) or preprod
**State reset:** none needed — each persona signs up as a brand-new user
(`uat-<persona>-<yyyymmdd>+clerk_test@example.com`, Clerk dev OTP `424242`)

Tasks are intents. How to achieve each one is the persona's problem — that's
the test.

## Tasks

1. **Get an account.** You've heard this app can run your gig admin and you've
   opened it for the first time. Sign up.
   *Done when: you're signed in and looking at whatever the app shows a new
   user.*

2. **Do the setup.** The app wants to set you up before you use it properly.
   Work through whatever it asks, answering as your persona honestly would —
   including skipping anything your persona would skip, if the app lets you.
   *Done when: the app stops setting you up and hands you the actual product.*

3. **Add a real gig.** You have a booking coming up (invent one that fits your
   persona — a wedding, a corporate do, a jazz night). Get it into the app.
   *Done when: you're confident the gig is recorded — where "confident" means
   whatever it means to your persona.*

4. **What now?** You vaguely remember the setup saying the app would help you
   stay on top of each booking. Find what it thinks you should do next for the
   gig you just added.
   *Done when: you can say, in persona voice, what the app wants you to do
   next for that gig — or you've concluded you can't tell.*

## Analyst notes (not shown to executors)

- Task 2 is the point of the run: #660 (step 1 helper text + business
  address) and #661 (step 2 orientation) shipped copy whose entire job is to
  survive Chloe (who won't read it) and satisfy Raj (who distrusts the
  automation it describes). Watch step 2's reminder/digest material against
  Raj's trust questions, and the business-address ask against Chloe.
- Task 3 exercises whether onboarding's mental model ("GigLoop runs your
  bookings") transfers to the real product surface.
- Task 4 probes discoverability of the checklist/goals from a cold start —
  compare against Graham's need for words-not-icons on desktop nav.
