# USCIS sandbox evidence log

`npm run uscis:smoke` appends one JSON line per check to `YYYY-MM.jsonl` here.
Commit these files: together they're the record of five consecutive calendar
days of sandbox traffic (200 and 4xx) that USCIS asks for before production
access.

Each line holds only sanitized facts: timestamp, US Central date, test name,
the **published staging** receipt used, HTTP status, outcome class, attempts,
duration, how many token requests were made, and the staging status title.
No tokens, secrets, raw payloads or real case numbers.

Never edit or back-fill entries by hand. If a day is missed, the five-day
sequence restarts.
