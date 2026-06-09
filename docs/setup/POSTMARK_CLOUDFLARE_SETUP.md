# Postmark Setup with Cloudflare Email Routing

> ⚠️ **Outdated — the app sends transactional email via Resend, not Postmark** (see `supabase/functions/waitlist-signup` and `waitlist-confirm`, which use `RESEND_API_KEY`). Postmark was never wired up. Kept for the Cloudflare email-routing steps only; ignore the Postmark-specific instructions.

Since you've set up Cloudflare email routing, you can now use Postmark! Here's how:

## Step 1: Sign Up for Postmark

1. Go to https://postmarkapp.com
2. Click "Sign Up"
3. **Use your Cloudflare email** (e.g., `nathan@chemirl.app` or `support@chemirl.app`)
   - Cloudflare will forward it to your Outlook email
4. Complete signup
5. **Check your Outlook inbox** for the verification email (via Cloudflare routing)

## Step 2: Create a Server in Postmark

1. In Postmark Dashboard, click **"Servers"**
2. Click **"Add Server"**
3. Name: `Chem IRL Production`
4. Click **"Create Server"**
5. **Save your Server API Token** (starts with something like `xxxx-xxxx-xxxx`)

## Step 3: Verify Your Domain in Postmark

This is **critical** for sending emails from `@chemirl.app`:

1. In Postmark → Your Server → **"Domains"**
2. Click **"Add Domain"**
3. Enter: `chemirl.app`
4. Click **"Verify Domain"**

## Step 4: Add DNS Records in Cloudflare

Postmark will give you DNS records to add. In your Cloudflare dashboard:

### SPF Record
```
Type: TXT
Name: @
Value: v=spf1 include:spf.mtasv.net ~all
TTL: Auto
Proxy: ❌ (DNS only - important!)
```

### DKIM Records (from Postmark)
Postmark will give you 2-3 DKIM records. Add each one:
```
Type: TXT
Name: [selector from Postmark, e.g., "20251029._domainkey"]
Value: [Full DKIM value from Postmark]
TTL: Auto
Proxy: ❌ (DNS only - important!)
```

### Return Path CNAME
```
Type: CNAME
Name: [from Postmark, usually "pm-bounces" or similar]
Target: [from Postmark]
Proxy: ❌ (DNS only - important!)
```

### Important Notes
- ✅ **DNS only** - Don't proxy these records (turn off orange cloud)
- ✅ Wait 10-15 minutes after adding
- ✅ Postmark will show verification status

## Step 5: Get Your API Token

1. Postmark Dashboard → Your Server → **"API Tokens"**
2. Copy the **Server API Token**
3. Keep it secret!

## Step 6: Add to Vercel

1. Go to Vercel → Your Project → Settings → Environment Variables
2. Add:
   ```
   POSTMARK_API_TOKEN = your-server-api-token-here
   POSTMARK_FROM_EMAIL = nathan@chemirl.app
   ```
3. ✅ Check all 3 environments (Production, Preview, Development)
4. **Redeploy** your project

## Step 7: Test Sending

1. In Postmark Dashboard → **Message Stream**
2. Click **"Send Test"**
3. Send to your Outlook email (it will route through Cloudflare)

## Cloudflare Email Routing Benefits

✅ **Professional email**: `nathan@chemirl.app` looks professional
✅ **Postmark compatible**: Can sign up with business domain email
✅ **Email forwarding**: Receives at `@chemirl.app`, forwards to Outlook
✅ **Domain verification**: Can verify domain for sending

## Troubleshooting

### Postmark signup email not arriving
- Check Cloudflare email routing is working (send test email to `nathan@chemirl.app`)
- Check spam folder in Outlook
- Verify Cloudflare email routing settings

### Domain verification fails
- Ensure DNS records are **DNS only** (not proxied)
- Wait 24-48 hours for propagation
- Double-check DKIM values are exact (no extra spaces)

### Emails not sending
- Verify domain is verified in Postmark (green checkmark)
- Check API token is correct in Vercel
- Review Postmark logs for errors

## Next Steps

After setup:
1. ✅ Domain verified in Postmark
2. ✅ API token in Vercel
3. ✅ Test email sent successfully
4. ➡️ Ready to send transactional emails from your app!

Your email setup is complete! 🚀
