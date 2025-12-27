# Documentation Audit - Mobile App

**Date:** 2025-01-27  
**Scope:** `mobile/` directory only

## Inventory

| Path                               | Purpose                                    | Status             | Referenced By                                    | Recommended Action                                                         |
| ---------------------------------- | ------------------------------------------ | ------------------ | ------------------------------------------------ | -------------------------------------------------------------------------- |
| `README.md`                        | Main mobile app README                     | Accurate           | Root README, users                               | **Keep** - Canonical entry point                                           |
| `docs/INSTALL_ON_PHONES.md`        | Installation guide (Expo Go + EAS)         | Accurate           | README, scripts                                  | **Keep** - Active doc                                                      |
| `docs/SUPABASE_STAGING_SETUP.md`   | Staging project setup                      | Accurate           | README                                           | **Keep** - Active doc                                                      |
| `docs/TWO_DEVICE_TEST_PLAN.md`     | Two-device testing workflow                | Accurate           | README, scripts                                  | **Keep** - Active doc                                                      |
| `docs/TEST_RUN_LOG_TEMPLATE.md`    | Test log template                          | Accurate           | README, scripts                                  | **Keep** - Active doc                                                      |
| `docs/RELEASE_CHECKLIST.md`        | Pre-build verification                     | Accurate           | README                                           | **Keep** - Active doc                                                      |
| `ENV_SETUP.md`                     | Environment variable setup                 | Partially accurate | README, scripts                                  | **Merge into README** - Duplicate of README section                        |
| `QUICK_START.md`                   | Quick start guide                          | Duplicate          | None                                             | **Delete** - Superseded by README + INSTALL_ON_PHONES                      |
| `TEST_AND_DEPLOY.md`               | Testing & deployment                       | Duplicate          | None                                             | **Delete** - Superseded by docs/INSTALL_ON_PHONES + docs/RELEASE_CHECKLIST |
| `QUICK_BUILD_STEPS.md`             | EAS build steps                            | Duplicate          | None                                             | **Delete** - Superseded by docs/INSTALL_ON_PHONES                          |
| `DEVELOPMENT_BUILD_GUIDE.md`       | Dev build guide                            | Duplicate          | None                                             | **Delete** - Superseded by docs/INSTALL_ON_PHONES                          |
| `METRO_CONNECTION_FIX.md`          | Metro troubleshooting                      | Partially useful   | None                                             | **Archive** - Move useful parts to INSTALL_ON_PHONES troubleshooting       |
| `KNOWN_ISSUE_NEW_ARCH.md`          | React Navigation v7 issue                  | Stale              | None                                             | **Archive** - Issue may be resolved, keep for reference                    |
| `IMPLEMENTATION_SUMMARY.md`        | MVP gap fixes summary                      | Generated artifact | None                                             | **Archive** - Historical record                                            |
| `VALIDATION_REPORT.md`             | Analysis validation                        | Generated artifact | VALIDATION_REPORT references MOBILE_APP_ANALYSIS | **Archive** - Historical record                                            |
| `MOBILE_APP_ANALYSIS.md`           | App architecture analysis                  | Stale              | VALIDATION_REPORT                                | **Archive** - Outdated analysis                                            |
| `PRODUCTION_HARDENING_SUMMARY.md`  | Photo deletion + Sentry summary            | Generated artifact | None                                             | **Archive** - Historical record                                            |
| `RELEASE_AND_RECONCILE_SUMMARY.md` | Release checklist + reconciliation summary | Generated artifact | None                                             | **Archive** - Historical record                                            |
| `DEBUG_AND_TESTING_SUMMARY.md`     | Debug screen + testing summary             | Generated artifact | None                                             | **Archive** - Historical record                                            |

## Analysis

### Canonical Docs (Keep)

- `README.md` - Main entry point
- `docs/INSTALL_ON_PHONES.md` - Installation guide
- `docs/SUPABASE_STAGING_SETUP.md` - Staging setup
- `docs/TWO_DEVICE_TEST_PLAN.md` - Testing workflow
- `docs/TEST_RUN_LOG_TEMPLATE.md` - Test log template
- `docs/RELEASE_CHECKLIST.md` - Release verification

### Duplicates to Delete

- `QUICK_START.md` - Content covered in README + INSTALL_ON_PHONES
- `TEST_AND_DEPLOY.md` - Content covered in INSTALL_ON_PHONES + RELEASE_CHECKLIST
- `QUICK_BUILD_STEPS.md` - Content covered in INSTALL_ON_PHONES
- `DEVELOPMENT_BUILD_GUIDE.md` - Content covered in INSTALL_ON_PHONES

### To Merge

- `ENV_SETUP.md` - Merge essential content into README (env vars section already exists)

### To Archive

- `METRO_CONNECTION_FIX.md` - Extract useful troubleshooting to INSTALL_ON_PHONES, then archive
- `KNOWN_ISSUE_NEW_ARCH.md` - Archive for reference
- `IMPLEMENTATION_SUMMARY.md` - Archive (historical)
- `VALIDATION_REPORT.md` - Archive (historical)
- `MOBILE_APP_ANALYSIS.md` - Archive (outdated)
- `PRODUCTION_HARDENING_SUMMARY.md` - Archive (historical)
- `RELEASE_AND_RECONCILE_SUMMARY.md` - Archive (historical)
- `DEBUG_AND_TESTING_SUMMARY.md` - Archive (historical)

## Actions

1. Create `docs/archive/` directory
2. Move historical/generated artifacts to archive
3. Delete duplicate docs
4. Merge ENV_SETUP.md content into README (if not already covered)
5. Extract useful troubleshooting from METRO_CONNECTION_FIX.md to INSTALL_ON_PHONES.md
6. Update README to remove references to deleted files
7. Create `docs/README.md` as table of contents
