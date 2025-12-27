# Cloudflare Setup for Chem IRL

## DNS Configuration

### Required DNS Records
Add these in Cloudflare DNS dashboard:

```
Type: CNAME
Name: www
Target: cname.vercel-dns.com
Proxy status: Proxied ✅
TTL: Auto

Type: A
Name: @
Target: 76.76.19.61
Proxy status: Proxied ✅
TTL: Auto
```

### Optional Records
```
Type: CNAME
Name: api
Target: chem-irl-abc123.vercel.app
Proxy status: Proxied ✅

Type: CNAME
Name: app
Target: chem-irl-abc123.vercel.app
Proxy status: Proxied ✅
```

## Page Rules (Recommended)

### 1. Force HTTPS
```
URL: chemirl.app/*
Settings:
- Always Use HTTPS: On
- SSL: Full (strict)
```

### 2. Cache Static Assets
```
URL: chemirl.app/_next/static/*
Settings:
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 month
```

### 3. API Routes (No Cache)
```
URL: chemirl.app/api/*
Settings:
- Cache Level: Bypass
```

## Security Settings

### SSL/TLS Configuration
- **Encryption Mode**: Full (strict)
- **Edge Certificates**: Universal SSL enabled
- **Always Use HTTPS**: On
- **HTTP Strict Transport Security (HSTS)**: On
- **Minimum TLS Version**: 1.2

### Security Level
- **Security Level**: Medium
- **Bot Fight Mode**: On
- **Challenge Passage**: 30 minutes

### Firewall Rules
```
Rule: Block Suspicious Requests
Expression: (http.request.uri.path contains "wp-admin") or (http.request.uri.path contains "phpmyadmin")
Action: Block
```

## Performance Optimizations

### Caching
- **Caching Level**: Standard
- **Browser Cache TTL**: 4 hours
- **Edge Cache TTL**: 1 month

### Speed Features
- **Auto Minify**: HTML, CSS, JS ✅
- **Brotli Compression**: On
- **Rocket Loader**: On
- **Mirage**: On (for mobile)

### Image Optimization
- **Polish**: Lossless
- **WebP**: On
- **Image Resizing**: On

## Analytics & Monitoring

### Web Analytics
- Enable Cloudflare Web Analytics
- Track page views, unique visitors, bounce rate

### Real User Monitoring (RUM)
- Monitor Core Web Vitals
- Track loading performance
- Monitor user experience

## Custom Headers

Add these in Transform Rules → HTTP Response Header Modification:

### Security Headers
```
Header: X-Frame-Options
Value: DENY

Header: X-Content-Type-Options
Value: nosniff

Header: Referrer-Policy
Value: strict-origin-when-cross-origin

Header: X-XSS-Protection
Value: 1; mode=block
```

### Performance Headers
```
Header: Cache-Control
Value: public, max-age=31536000
Condition: URI Path starts with "/_next/static/"

Header: Cache-Control
Value: public, max-age=3600
Condition: URI Path starts with "/_next/image"
```

## Rate Limiting

### API Protection
```
Rule: API Rate Limit
Expression: http.request.uri.path starts_with "/api/"
Rate: 100 requests per 10 minutes per IP
Action: Block for 1 hour
```

### Login Protection
```
Rule: Login Rate Limit
Expression: http.request.uri.path eq "/auth/login"
Rate: 5 requests per 1 minute per IP
Action: Challenge
```

## Workers (Optional - Advanced)

### Custom Worker for Chem IRL
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Add custom logic here
  // e.g., A/B testing, geo-blocking, custom redirects
  
  return fetch(request)
}
```

## Monitoring & Alerts

### Uptime Monitoring
- Set up uptime monitoring for `https://chemirl.app`
- Alert threshold: 99% uptime
- Check interval: 1 minute

### Performance Alerts
- Alert if response time > 2 seconds
- Alert if error rate > 1%

## Cost Optimization

### Free Tier Limits
- **Bandwidth**: 1TB/month
- **Requests**: 10M/month
- **Page Rules**: 3 (free tier)
- **Workers**: 100k requests/day

### Pro Tier Benefits ($20/month)
- **Page Rules**: 20
- **Workers**: 10M requests/month
- **Image Resizing**: Advanced
- **Load Balancing**: Included

## Troubleshooting

### Common Issues

**1. SSL Certificate Issues**
- Ensure "Full (strict)" SSL mode
- Check certificate validity in SSL/TLS dashboard

**2. Caching Issues**
- Purge cache after deployments
- Check Page Rules for conflicting rules

**3. Performance Issues**
- Enable Auto Minify
- Check Rocket Loader compatibility
- Monitor Core Web Vitals

### Debug Tools
- **Cloudflare Analytics**: Traffic patterns
- **Security Events**: Attack logs
- **Performance Insights**: Speed metrics
- **Real User Monitoring**: User experience data

## Deployment Checklist

- [ ] DNS records configured
- [ ] SSL certificate active
- [ ] Page rules set up
- [ ] Security settings configured
- [ ] Performance optimizations enabled
- [ ] Analytics tracking active
- [ ] Uptime monitoring set up
- [ ] Error rate monitoring configured

## Support

- **Cloudflare Support**: Available 24/7
- **Documentation**: https://developers.cloudflare.com/
- **Community**: https://community.cloudflare.com/




