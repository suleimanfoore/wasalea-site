# Product screenshots

Drop the real captures into `public/assets/shots/` (create it) and point `public/index.html` at them.

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
