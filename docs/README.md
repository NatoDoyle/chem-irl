# Documentation Index

This directory contains organized documentation for the Chem IRL dating app project.

## Quick Links

### 📖 Main Documentation
- **[Complete Documentation](../DOCUMENTATION.md)** - Full technical documentation
- **[Architecture Plan](../ARCHITECTURE_PIVOT_PLAN.md)** - Architecture decisions and pivot plan
- **[Pivot Quick Start](../PIVOT_QUICK_START.md)** - Quick reference for app-first pivot

### 🚀 Deployment
- **[Deployment Guide](./deployment/DEPLOYMENT_GUIDE.md)** - Complete deployment guide
- **[Deployment Checklist](./deployment/DEPLOYMENT_CHECKLIST.md)** - Pre-deployment checklist
- **[Vercel Setup](./deployment/VERCEL_SINGLE_PROJECT_SETUP.md)** - Vercel configuration
- **[Deployment Troubleshooting](./deployment/DEPLOYMENT_TROUBLESHOOTING.md)** - Common deployment issues

### ⚙️ Setup
- **[Supabase Setup](./setup/SUPABASE_SETUP.md)** - Supabase connection and configuration
- **[Postmark/Cloudflare Setup](./setup/POSTMARK_CLOUDFLARE_SETUP.md)** - Email and CDN configuration
- **[Database Setup](../DATABASE_SETUP.md)** - Database migrations and setup (root level)

### 💻 Development
- **[Development Guide](./development/DEVELOPING.md)** - Development workflow and best practices
- **[Git Troubleshooting](./development/GIT_PUSH_TROUBLESHOOTING.md)** - Git push issues and solutions
- **[Repo State Explanation](./development/REPO_STATE_SYSTEM_EXPLANATION.md)** - System state management

### 🏗️ Infrastructure
- **[Cloudflare Setup](./infrastructure/CLOUDFLARE_SETUP.md)** - Cloudflare CDN configuration
- **[Security Audit](./infrastructure/SECURITY_AUDIT.md)** - Security audit and recommendations

### 📱 Mobile App
- **[Mobile App README](../mobile/README.md)** - Mobile app setup and development
- See `mobile/docs/` for detailed mobile app documentation

### 🌐 Website
- **[Website README](../web/README.md)** - Website setup and deployment

### 🗄️ Database
- **[Database Automation](../db/AUTOMATION.md)** - Database automation scripts

### 📦 Archive
Historical documentation and status files are in [`archive/`](./archive/).

## Documentation Structure

```
docs/
├── README.md (this file)
├── deployment/
│   ├── DEPLOYMENT_GUIDE.md
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── VERCEL_SINGLE_PROJECT_SETUP.md
│   └── DEPLOYMENT_TROUBLESHOOTING.md
├── setup/
│   ├── SUPABASE_SETUP.md
│   └── POSTMARK_CLOUDFLARE_SETUP.md
├── development/
│   ├── DEVELOPING.md
│   ├── GIT_PUSH_TROUBLESHOOTING.md
│   └── REPO_STATE_SYSTEM_EXPLANATION.md
├── infrastructure/
│   ├── CLOUDFLARE_SETUP.md
│   └── SECURITY_AUDIT.md
└── archive/
    ├── PHASE1_COMPLETE.md
    ├── PHASE2_COMPLETE.md
    ├── POLISH_COMPLETE.md
    ├── CLEANUP_SUMMARY.md
    ├── DEPLOYMENT_STATUS.md
    ├── DEPENDENCY_STATUS.md
    ├── LEGACY.md
    └── web-LEGACY.md
```

## Getting Started

1. **New to the project?** Start with [`../README.md`](../README.md) and [`../DOCUMENTATION.md`](../DOCUMENTATION.md)
2. **Setting up locally?** Follow [`../DATABASE_SETUP.md`](../DATABASE_SETUP.md) and platform-specific READMEs
3. **Ready to deploy?** See [`deployment/DEPLOYMENT_GUIDE.md`](./deployment/DEPLOYMENT_GUIDE.md)

## Documentation Quality

Run the documentation link checker to validate all markdown links:

```bash
bun run docs:check
```

This will check all markdown files (excluding archives) and report any broken links.

