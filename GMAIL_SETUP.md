# Gmail setup (SMTP + IMAP, no Gmail API)

orbit. talks to Gmail the classic way: SMTP for sending and IMAP for reading replies. No Google Cloud project, no OAuth client, no Gmail API.

1. Google Account → **Security** → turn on **2-Step Verification**.
2. Security → **App passwords** → create one for "Mail" (a 16-character password).
3. In orbit. → **Integrations → Gmail** paste your address and the app password, click **Connect Gmail (SMTP + IMAP)**.
   - SMTP: `smtp.gmail.com:587` STARTTLS, verified by opening an authenticated session.
   - IMAP: `imap.gmail.com:993` SSL, verified by opening INBOX.
4. The password is stored in Windows Credential Manager only. Settings (host, port, address) are in `%APPDATA%\orbit\integrations.json`.
5. Outreach sends every email over SMTP on your click (or the opt-in auto follow-up loop) and pulls replies with **Sync replies** over IMAP.

Any other mailbox (Google Workspace, Outlook, Zoho, Mailgun, SES) uses the generic **SMTP Server** card plus its **Inbox (IMAP)** section.
