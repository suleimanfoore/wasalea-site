# Product screenshots

**Six of the eight slots are filled.** The two still open:

- `restore-points.png` - the Cloud backups card needs S3 credentials, which the
  demo instance deliberately has none of so it cannot touch real customer data.
- `tablet.png` - the Android companion, scoped out of this round.

Both still render as dashed "Screenshot to come" placeholders on the page.

The six in place were captured from a demonstration database: invented
super-agents (WESTLANDS HUB, KAREN AGENTS, THIKA ROAD) and invented agents.
No real customer name, figure or date appears in any of them.

To fill a remaining slot, drop the capture into `public/assets/shots/` and point `public/index.html` at it.

Each slot in the page is currently a dashed placeholder that says
"Screenshot to come". To fill one, replace its inner `<div class="shot-frame
shot-pending" ...>...</div>` with:

    <div class="shot-frame">
      <img src="/assets/shots/<file>.png" alt="<what the screen shows>" width="1600" height="1000" loading="lazy">
    </div>

Expected files, matching the slots in order:

| File                  | Screen                                  |
|-----------------------|-----------------------------------------|
| dashboard.png         | Main desktop dashboard (also the hero)  |
| outstanding.png       | Outstanding agent balances              |
| daily.png             | Daily deployments and collections       |
| statement.png         | Individual agent statement / history    |
| executive-summary.png | Executive summary report                |
| accounts.png          | Account balances and transfers          |
| restore-points.png    | Backup history and restore points       |
| tablet.png            | Android tablet dashboard                |

Capture at a generous window size, PNG, and crop to the application window.
The desktop slots are styled 16:10 and the tablet slot 4:3; anything close
will sit correctly since the frame scales the image.

**Before publishing any screenshot, check it for real customer names, real
phone numbers and real balances.** Use demonstration data, or blur what
should not be public. Once it is on the site it is on the internet.
