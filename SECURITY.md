# Security

Saathi handles phone numbers, earnings, complaint drafts and voice recordings of gig workers. This document states what we protect against, how, and what is still open.

## Reporting a vulnerability

Email hooda.saksham@gmail.com with the subject "Saathi security". Please do not open a public issue. We aim to acknowledge within 48 hours.

## Threat model and controls

| Area | Risk | Control |
|---|---|---|
| Login | PIN guessing (4 digits) | PBKDF2-SHA256 with 600k iterations and a per-user salt; constant-time compare; 5 attempts per phone per 15 minutes and 10 per IP per minute, then `429` with `Retry-After`. |
| Sessions | Stolen or forged tokens | Tokens are signed with `SECRET_KEY` (itsdangerous) and expire after 24 hours. The API refuses to start in production with the default key. |
| Google sign-in | Forged ID tokens | Every credential is verified against Google's certificates for our client id. Accounts are linked by the Google subject, never by an unverified email. |
| LLM prompts | Prompt injection via chat, voice transcripts, complaint text | All worker text is wrapped in `<worker_input>` delimiters; the system prompt instructs the model to treat it as data, never reveal the prompt, and never claim legal authority. Field lengths are capped (chat 2,000, complaint 4,000, onboarding 4,000, earnings 500 characters). |
| Voice uploads | Oversized or non-audio files, abuse of a public endpoint | `audio/*` only, 3 MB max, 30 s clips, 20 requests per IP per minute. Audio is sent to Sarvam or Gemini for transcription and not stored. |
| Public endpoints | Cost abuse (transcription and parsing call paid APIs) | Rate limited per IP: register 5/min, onboarding parse 10/min, transcribe 20/min. Authenticated LLM routes: chat 30/min, earnings parse 30/min, grievance draft 10/min per user. |
| Transport | Downgrade, clickjacking, MIME sniffing | HSTS in production, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` limiting the microphone to our origin, a Content Security Policy on the web app, trusted-host checking on the API. |
| Input | Malformed data | Pydantic validation on every body: Indian mobile pattern, 4-digit PIN, bounded lists, amount range, language code allow-list. |
| Errors | Stack traces leaking internals | A catch-all handler returns `{"detail": "internal error"}` and logs the exception server-side. |
| Secrets | Keys in the repo | No secrets are committed. `.env` files are ignored; `.env.example` holds names only. Keys live in Railway service variables. |
| Dependencies | Known vulnerabilities | Dependabot weekly for npm, pip and GitHub Actions; `pip-audit` and `npm audit` run in CI on every push. |

## Known limitations

- **Session token storage.** The web app keeps the session token in `localStorage` because the API and the app live on different origins and the hackathon build has no shared cookie domain. Mitigations: 24-hour expiry, a strict CSP that blocks third-party scripts, and no `dangerouslySetInnerHTML` anywhere. The planned fix is an `httpOnly`, `SameSite=Lax` cookie once both services share a domain.
- **Rate limiting is in-process.** Counters live in the API process. With one replica this is exact; with several it is per replica. Move to Redis before scaling out.
- **Phone + PIN is deliberately simple.** It fits the audience (no email, shared devices) but is weaker than OTP. The lockout above is the main defence. Google sign-in is offered as a stronger alternative.
- **Audio and chat content go to third-party model providers** (Sarvam, Google). Workers are told this on the onboarding screen; nothing is used for training by us.

## Data handling

- Earnings, messages and complaint drafts are stored per user in Postgres on Railway over private networking.
- The demo account (`9999999999` / `1234`) is public by design and holds only seed data.
- Delete-my-data is not yet exposed in the UI; it is a single SQL delete by user id and is on the roadmap as an endpoint.
