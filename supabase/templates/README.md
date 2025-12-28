# Email Templates

This directory contains email templates for local Supabase development.

## Usage

### Local Development

These templates are automatically used when running Supabase locally with `supabase start`.

To apply changes:
```bash
supabase stop && supabase start
```

### Hosted Projects

For hosted Supabase projects, copy the template content into the Dashboard:

1. Go to **Authentication** → **Email Templates** in Supabase Dashboard
2. Select the template (e.g., "Magic Link")
3. Copy the HTML content from the corresponding `.html` file
4. Paste into the template editor
5. Click **Save**

## Templates

### `confirmation.html`
- **Used for:** Email OTP authentication (code-only)
- **Template variable:** `{{ .Token }}` (6-digit code), `{{ .Email }}` (user's email)
- **Purpose:** Code-only verification (no clickable links)
- **When sent:** When user signs up and email confirmation is enabled
- **Note:** This template is configured to be code-only (no confirmation links)

## Template Variables

Available variables in templates:

- `{{ .Token }}` - 6-digit OTP code
- `{{ .Email }}` - User's email address
- `{{ .SiteURL }}` - Application site URL (avoid using for OTP templates)
- `{{ .ConfirmationURL }}` - Full confirmation URL (avoid using for OTP templates)

## Important Notes

⚠️ **For OTP Flow (Code-Only):**
- ✅ Use `{{ .Token }}` to display the code
- ✅ Instruct users to "enter code in app"
- ❌ Do NOT use `{{ .SiteURL }}` or `{{ .ConfirmationURL }}`
- ❌ Do NOT include clickable buttons or links
- ❌ Do NOT say "click here" or "open link"

## Testing

1. Start local Supabase: `supabase start`
2. Request OTP from mobile app
3. Check email inbox (or Supabase logs)
4. Verify email contains only code (no links)

