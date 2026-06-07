# Account Redesign QA

Reference: latest Product Design mock, combining the left account rail with the music-studio Credits dashboard and removing the duplicated "资料与安全" main panel.

Implementation: `src/app/account/page.tsx`

Checks performed:

- Header/navigation remains provided by the existing shared `Navbar`; account page code does not modify it.
- Main account body now uses a fixed left account rail with avatar, account links, membership badge, usage summary, profile form, password form, and logout.
- Main content recreates the selected direction with a large Credits wallet cockpit, radial usage meter, expanded trend chart, compact subscription management panel, and wider recharge ledger.
- The duplicate main "资料与安全" block is absent; profile/password actions live only in the left rail.
- Desktop login-state screenshot captured at `account-local-redesign-final.png`.
- Mobile login-state screenshot captured at `account-local-redesign-mobile.png`.
- Wide viewport content width checked against adjacent pages; account main content is constrained to `1420px` inside the right work area instead of stretching full width.
- Browser console after reload: no console messages found.
- TypeScript check passed with `npm run typecheck`.
- Production build passed with `npm run build`.

Known acceptable difference:

- The global footer remains because it is part of the existing app layout, not the `/account` page body.
- The shared header is intentionally unchanged per request.

final result: passed
