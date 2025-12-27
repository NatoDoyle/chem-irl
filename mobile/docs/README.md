# Mobile App Documentation

This directory contains all documentation for the Chem IRL mobile app.

## Quick Links

### Setup & Installation

- **[Install on Phones](./INSTALL_ON_PHONES.md)** - Step-by-step guide for installing the app on physical devices (Expo Go and EAS dev builds)
- **[Supabase Staging Setup](./SUPABASE_STAGING_SETUP.md)** - How to set up and switch between staging and production Supabase projects

### Testing

- **[Two-Device Test Plan](./TWO_DEVICE_TEST_PLAN.md)** - Comprehensive testing workflow for validating app features with two devices
- **[Test Run Log Template](./TEST_RUN_LOG_TEMPLATE.md)** - Template for recording test sessions

### Release

- **[Release Checklist](./RELEASE_CHECKLIST.md)** - Pre-build verification steps before building for production

### Archive

- **[Archive](./archive/)** - Historical documentation and implementation summaries (for reference only)

## Documentation Structure

```
docs/
├── README.md (this file)
├── INSTALL_ON_PHONES.md
├── SUPABASE_STAGING_SETUP.md
├── TWO_DEVICE_TEST_PLAN.md
├── TEST_RUN_LOG_TEMPLATE.md
├── RELEASE_CHECKLIST.md
└── archive/
    ├── IMPLEMENTATION_SUMMARY.md
    ├── VALIDATION_REPORT.md
    ├── MOBILE_APP_ANALYSIS.md
    ├── PRODUCTION_HARDENING_SUMMARY.md
    ├── RELEASE_AND_RECONCILE_SUMMARY.md
    ├── DEBUG_AND_TESTING_SUMMARY.md
    └── KNOWN_ISSUE_NEW_ARCH.md
```

## Getting Started

1. **First time setup**: See [Install on Phones](./INSTALL_ON_PHONES.md)
2. **Staging environment**: See [Supabase Staging Setup](./SUPABASE_STAGING_SETUP.md)
3. **Testing**: Run `npm run test:two-device` for workflow, then follow [Two-Device Test Plan](./TWO_DEVICE_TEST_PLAN.md)
4. **Before release**: Complete [Release Checklist](./RELEASE_CHECKLIST.md)
