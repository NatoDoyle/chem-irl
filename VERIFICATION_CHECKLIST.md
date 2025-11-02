# Chem IRL - Post-Deployment Verification Checklist

## ✅ Deployment Status

Your app is now live at: **https://chemirl.app**

Let's verify everything is working correctly.

## 🔍 Quick Checks

### 1. Test Your Live Site
- [ ] Visit https://chemirl.app on your phone
- [ ] Visit https://www.chemirl.app (should redirect)
- [ ] Check the landing page loads correctly
- [ ] Verify branding shows "Chem IRL"

### 2. Check HTTPS/SSL
- [ ] URL shows padlock icon (🔒)
- [ ] No security warnings
- [ ] SSL certificate is valid

### 3. Test on Different Devices
- [ ] Mobile phone (your phone)
- [ ] Desktop browser
- [ ] Tablet (if available)

### 4. Check Cloudflare Status
- [ ] Cloudflare shows "Proxied" (orange cloud)
- [ ] DNS records are correct
- [ ] SSL/TLS mode is "Full (strict)"

## 🚨 Common Issues & Fixes

### Site Shows "Vercel Default Page"
**Fix**: 
1. Go to Vercel Dashboard
2. Check deployment status
3. Verify build completed successfully
4. Check Root Directory is set to `web` (if repo is in parent folder)

### SSL/HTTPS Errors
**Fix**:
1. In Cloudflare: SSL/TLS → Overview
2. Set encryption mode to "Full (strict)"
3. Wait 10-15 minutes for propagation

### Domain Not Resolving
**Fix**:
1. Check DNS in Cloudflare:
   - Type: A, Name: @, Target: 76.76.19.61, Proxy: ✅
   - Type: CNAME, Name: www, Target: cname.vercel-dns.com, Proxy: ✅
2. Wait up to 24 hours for full propagation

### 404 Errors
**Fix**:
1. Check Vercel deployment logs
2. Verify Next.js build succeeded
3. Check environment variables are set

## 📋 Next Steps

### Immediate (Do Now)
1. ✅ Verify site is accessible
2. ✅ Test on mobile
3. ✅ Check HTTPS is working

### This Week
4. [ ] Set up Supabase database
5. [ ] Run database migrations (schema.sql, rls.sql, kpi_views.sql)
6. [ ] Add Supabase keys to Vercel environment variables
7. [ ] Set up email provider (Resend or Postmark)
8. [ ] Add email API key to Vercel

### Before Launch
9. [ ] Set up Stripe for payments
10. [ ] Configure PostHog for analytics
11. [ ] Set up Postmark/SES for transactional emails
12. [ ] Test authentication flow
13. [ ] Test all core features

## 🔗 Useful Links

- **Your Site**: https://chemirl.app
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **GitHub Repo**: https://github.com/NatoDoyle/chem-irl

## 🎯 Success Criteria

Your deployment is successful when:
- ✅ Site loads at chemirl.app
- ✅ HTTPS works (padlock icon)
- ✅ Mobile and desktop both work
- ✅ No console errors
- ✅ Fast loading (< 3 seconds)

## 📞 Need Help?

If something's not working:
1. Check Vercel deployment logs
2. Check Cloudflare SSL settings
3. Verify DNS records
4. Check browser console for errors
