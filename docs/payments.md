# Automatic bKash / Nagad payments (about 15 minutes)

No merchant account or trade licence needed. Students pay your personal
bKash/Nagad number with **Send Money**; your Android phone forwards the
"You have received Tk ..." SMS to Mnemoq; Pro starts automatically.

```
Student: Send Money ৳299 → your bKash          Your phone: SMS "You have received Tk 299.00 ... TrxID BKA1B2C3D4"
Student: types BKA1B2C3D4 + last 4 digits        Forwarder app → POST /api/sms-hook
                     \                                   /
                      → Mnemoq matches them → 4 months of Pro, at once
```

Whichever arrives first (the TrxID or the SMS) waits for the other. The plan is
decided by the **amount received**, never by what the student picked, using the
prices in `src/proConfig.js` (launch prices until the offer ends, with one day
of grace).

## 1. Database
Supabase > SQL Editor > run `supabase/payments.sql`. Run `supabase/analytics.sql`
again too (it adds the free-diagnostic steps to the Stats funnel).

## 2. A secret for the SMS hook
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```
Vercel > Settings > Environment Variables > add `SMS_HOOK_SECRET` with that
value > Redeploy.

## 3. The forwarder app (on the phone with your bKash/Nagad SIM)
Install an Android app that forwards incoming SMS to a web address (search the
Play Store for "SMS forwarder webhook"; pick one that lets you set the URL, a
JSON body and a sender filter). Set it up like this:

| Setting | Value |
|---|---|
| Senders to forward | `bKash` and `NAGAD` only (also `16247`, `16167` if your phone shows those) |
| Address (URL) | `https://mnemoq-two.vercel.app/api/sms-hook?key=YOUR_SMS_HOOK_SECRET` |
| Method | `POST` |
| Body (JSON) | `{"from": "<sender>", "text": "<message>"}` using the app's own placeholders for sender and message |

Also: turn off battery optimisation for the app, keep mobile data or Wi-Fi on,
and allow it to start on boot. If the phone is off, payments wait and are
matched when the SMS arrives.

**Test it:** send yourself ৳1 from another number. The app should show a
`200` response, and Stats (`#/admin`) > Payments should list the payment as
"Not claimed yet" (৳1 buys no plan, which is expected).

## Safety
- Only SMS whose sender is bKash / NAGAD count, so an SMS typed by a person
  ("You have received Tk 599 ...") from a normal number is ignored.
- A TrxID alone is not enough: the student must also give the last 4 digits of
  the number they paid from, which must match the SMS.
- Each payment can be used once; a TrxID already used is refused.
- At most 10 tries an hour per account.
- The hook needs the secret; without it every request is refused.
- Nothing except bKash/Nagad "received" messages is stored. OTPs and personal
  SMS are dropped without being saved.

## When something goes wrong
- **Student paid, Pro did not start:** Stats > Payments. "Not claimed yet" means
  the SMS arrived but the student has not typed the TrxID (or typed it wrong).
  "Claim blocked: check number" means the last 4 digits did not match. If the
  payment is not listed at all, the SMS never reached the site: check the
  forwarder app. You can always fall back to an access code
  (`select * from create_pro_codes(1, 120, 'note');`).
- **Wrong amount** (for example ৳250): no plan matches, so nothing is granted.
  Refund the student or give an access code by hand.
- **The launch offer:** change `launch.endsAt` and the prices in
  `src/proConfig.js`; the Pro page, landing page and payment checker all follow.
