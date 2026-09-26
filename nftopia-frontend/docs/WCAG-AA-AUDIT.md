# WCAG 2.2 AA audit — core marketplace flows

Issue #542 covers the marketplace, auction, and creator-dashboard surfaces.
This audit records the automated checks and the manual review checklist so a
future release can repeat the same scope instead of treating accessibility as
an undocumented one-off.

## Automated coverage

The Jest accessibility suite uses `jest-axe` against shared layout, navigation,
footer, and marketplace-filter components:

- `components/layout/ClientBody.a11y.test.tsx`
- `components/Footer.a11y.test.tsx`
- `components/marketplace/MarketplaceFilters.a11y.test.tsx`

The filter audit specifically protects the browse/filter controls used by the
marketplace and auction entry points: search, minimum price, maximum price, and
sort controls each have an accessible name. Run it with:

```bash
cd nftopia-frontend
npm test -- --runInBand components/marketplace/MarketplaceFilters.a11y.test.tsx \
  components/layout/ClientBody.a11y.test.tsx components/Footer.a11y.test.tsx
```

## Manual WCAG AA checklist

| Area | Review | Result / follow-up |
| --- | --- | --- |
| Marketplace browse and filters | Keyboard tab order reaches search, price filters, sort, cards, and pagination; no dead end | Automated labels covered; repeat keyboard pass on each release |
| Auction detail and bidding | Bid controls, countdown updates, validation errors, and live bid changes are announced | Verify with VoiceOver/NVDA against the deployed route |
| Creator dashboard | Tab through dashboard navigation, collection controls, forms, and tables | Verify at 200% zoom and narrow viewport |
| Dialogs | Focus moves into the dialog, remains contained while open, and returns to the trigger | Existing wallet/transaction dialogs use `role="dialog"` and `aria-modal`; repeat manual pass |
| Dynamic content | Toasts, auction updates, and streaming content use live regions without stealing focus | Existing live regions documented; test with a screen reader |
| Color and contrast | Text, controls, focus indicators, disabled states, and charts meet WCAG AA | Run browser contrast tooling on the current design tokens before release |

## Findings addressed in this PR

- Marketplace filter inputs previously relied on placeholders and had no
  programmatic labels. They now have explicit accessible names and remain
  keyboard reachable at all responsive breakpoints.
- The new regression test fails if any of the four controls loses its label or
  introduces an axe-detected violation.

No automated tool can certify screen-reader behavior, real keyboard flows, or
contrast in every rendered state. Those items remain explicit release checks
rather than being reported as silently passed.
