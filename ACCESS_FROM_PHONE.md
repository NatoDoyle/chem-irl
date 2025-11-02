# Access Chem IRL from Your Phone

## Problem
The dev server runs on `localhost:3000` which only works on your laptop. Your phone can't access `localhost` because it refers to "this device."

## Solution: Use Your Local Network IP

### Step 1: Find Your Computer's Local IP Address

**Windows:**
1. Open Command Prompt (cmd)
2. Type: `ipconfig`
3. Look for "IPv4 Address" under your active connection
4. It will look like: `192.168.1.100` or `10.0.0.5`

**Mac:**
1. Open Terminal
2. Type: `ifconfig | grep "inet "`
3. Look for IP starting with `192.168.` or `10.`

**Linux:**
1. Open Terminal
2. Type: `hostname -I`
3. Or: `ip addr show`

### Step 2: Start Dev Server with Network Access

**Windows Command Prompt:**
```bash
cd web
set HOSTNAME=0.0.0.0
npm run dev
```

**Mac/Linux Terminal:**
```bash
cd web
HOSTNAME=0.0.0.0 npm run dev
```

**Or update package.json:**
Add this to your `package.json` scripts:
```json
"dev": "next dev -H 0.0.0.0"
```

### Step 3: Access from Phone

1. Make sure your phone is on the **same WiFi network** as your laptop
2. Open your phone's browser
3. Go to: `http://YOUR_IP_ADDRESS:3000`
   - Example: `http://192.168.1.100:3000`

### Step 4: Check Firewall (if it doesn't work)

**Windows:**
1. Go to Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Find Node.js or Next.js
4. Check both Private and Public

**Or temporarily disable firewall to test**

## Better Solution: Deploy to Vercel

For testing on your phone from anywhere:

1. Push code to GitHub (already done!)
2. Deploy to Vercel
3. Access from any device: `https://chemirl.app` or your Vercel URL

## Quick Test Commands

```bash
# Windows - Find your IP
ipconfig | findstr "IPv4"

# Start dev server accessible on network
cd web
set HOSTNAME=0.0.0.0
npm run dev

# Then on phone, go to: http://[YOUR_IP]:3000
```

## Troubleshooting

**Can't access from phone?**
- ✅ Make sure both devices on same WiFi
- ✅ Check firewall settings
- ✅ Verify IP address is correct
- ✅ Try disabling firewall temporarily

**Connection refused?**
- ✅ Make sure dev server shows "Ready" message
- ✅ Check that port 3000 isn't blocked
- ✅ Try a different port: `npm run dev -- -p 3001`

**Still not working?**
- Deploy to Vercel for easiest solution
- Or use ngrok for temporary public URL
