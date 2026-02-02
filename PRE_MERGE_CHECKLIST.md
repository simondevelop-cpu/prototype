# Pre-Merge Checklist

## Code Quality ✅
- [x] All linter errors fixed
- [x] TypeScript compilation successful
- [x] Build passes on Vercel
- [x] No console errors in production

## Testing ✅
- [x] Fixed consent test to use l1_events
- [x] Fixed auth test to use l1_events
- [x] Added event logging test suite
- [ ] **TODO**: Add tests for user tracker (edit-counts API)
- [ ] **TODO**: Add tests for editing events data tab
- [ ] **TODO**: Add tests for vanity metrics API
- [ ] **TODO**: Migration tests need real DB (expected to fail in CI)

## Documentation ✅
- [x] Excel export documentation updated and accurate
- [x] Vanity metrics formulas documented
- [x] Event logging architecture documented
- [x] Testing updates documented

## Functionality Verified ✅
- [x] Login events logged for WAU/MAU tracking
- [x] Transaction edit events logged
- [x] Bulk edit events logged
- [x] Statement upload events logged
- [x] User tracker shows edit counts
- [x] Editing events data tab shows events
- [x] Vanity metrics calculate correctly
- [x] Recategorization counts unique transactions
- [x] Statement metrics added to vanity metrics

## Known Issues
- Migration verification tests fail in CI (expected - need real DB)
- Some test files may still reference `user_events` in comments (non-critical)

## Recommended Next Steps
1. Add missing tests (see TESTING_UPDATES_SUMMARY.md)
2. Consider using test containers for migration tests
3. Review and update any remaining `user_events` references

## Excel Export Accuracy ✅
All formulas and data sources in Excel exports have been verified:
- Total users (cumulative)
- Weekly/Monthly active users (from l1_events login events)
- New users
- Total/New transactions uploaded
- Total transactions recategorised (unique count)
- Total statements uploaded
- Total statements by unique person
- Total unique banks uploaded
