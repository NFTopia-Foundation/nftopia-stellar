# NFTOPIA Frontend Responsiveness & Accessibility QA Checklist

## Automated Checks

- [ ] **Lighthouse CI**: Mobile score ≥90, no accessibility or best-practices errors
  - Run: `npm run lhci:collect && npm run lhci:assert`
- [ ] **Jest/RTL & axe-core**: All unit, integration, and accessibility tests pass
  - Run: `npm test`
- [ ] **Storybook/Chromatic**: Visual regression passes
  - Run: `npm run storybook` and Chromatic

---

## Manual Device/Breakpoint QA

### Navbar

- [ ] Hamburger menu works on <768px
- [ ] Logo and text align at 992px and above
- [ ] Dropdowns never overflow viewport on mobile/tablet
- [ ] All nav links and buttons are ≥48px and keyboard accessible

### Footer

- [ ] Columns stack at 768px, not 1200px
- [ ] Social icons scroll horizontally on mobile, never overflow
- [ ] Copyright is readable at 320px

### Content/Layout

- [ ] All main containers have `max-w-screen-xl` or similar
- [ ] Padding/margins adjust at each breakpoint
- [ ] No horizontal scroll at any size
- [ ] `min-h-[100svh]` fixes mobile browser chrome issues

### Accessibility

- [ ] All interactive elements have ARIA labels
- [ ] No color contrast issues
- [ ] All forms have labels
- [ ] Logical tab order and visible focus indicators

### Touch Targets

- [ ] All buttons/links are ≥48px on mobile

### Landscape/Edge Cases

- [ ] Test iPhone SE, iPad Air, and desktop in both portrait and landscape
- [ ] No keyboard navigation issues on mobile menus
- [ ] No Safari viewport height bugs

---

## Final Steps

- [ ] Run all automated tests and audits
- [ ] Perform manual QA using this checklist
- [ ] Fix any issues found
- [ ] Re-run Lighthouse and accessibility tests
- [ ] Commit and push to `fix/frontend-responsiveness` with a clear message
