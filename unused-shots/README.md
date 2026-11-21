# Not published

`tablet-clients.png` — the tablet's "Clients and balances" screen, captured
from the demo tenant. No customer data in it; it is held back for a
different reason.

Its **Oldest unpaid** column reads 25-26 days for all ten agents, beside
**Last activity: Today**. The tablet reports the client's first ever trading
day there rather than their oldest unsettled deployment - the same defect
that was fixed on the desktop. Suleiman chose to ship the app as it is, so
this is a known state.

It matters for the website because `public/assets/shots/outstanding.png`,
already on the page, shows the same demo book with ages of "Today" and
"1d old". Publishing both puts two screenshots of one book on one page
disagreeing about how old the debts are - on the page that sells aged
balances as a feature.

Once the tablet reports the oldest unsettled deployment, recapture and this
becomes usable. The slot it would fill is the product grid's tablet figure,
currently showing `tablet-accounts.png`.
