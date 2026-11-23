@'

Read SPEC\_v3.md before any work. The FAST TRACK section overrides Sections 4, 18 and 20.

Build one segment at a time; never start the next segment unless asked.

Follow Section 1 (agent rules) and Section 2 (evaluation requirements) at all times.

After each segment run: npm run lint \&\& npm test \&\& npm run build, fix everything, then summarise.

Never commit .env. Never use dangerouslySetInnerHTML.

Work in ONE branch for the whole session.

'@ | Set-Content -Encoding utf8 CLAUDE.md

