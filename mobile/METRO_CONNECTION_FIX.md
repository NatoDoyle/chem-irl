# Fix Metro Bundler Connection Issue

## The Problem
Your phone can't connect to the Metro bundler running on your computer. This usually happens when:
- Metro bundler isn't running
- Phone and computer aren't on the same Wi-Fi network
- Firewall is blocking the connection
- IP address changed

## Quick Fixes

### Option 1: Restart Metro Bundler

1. **Stop the current Metro bundler** (if running):
   - Press `Ctrl+C` in the terminal where Expo is running

2. **Clear cache and restart**:
   ```bash
   cd mobile
   npx expo start --clear
   ```

3. **Scan the new QR code** with Expo Go

### Option 2: Check Network Connection

**Make sure:**
- ✅ Phone and computer are on the **same Wi-Fi network**
- ✅ Wi-Fi is enabled on both devices
- ✅ No VPN is blocking the connection
- ✅ Firewall allows connections on port 8081

### Option 3: Use Tunnel Mode (If Same Network Doesn't Work)

If you can't use the same network, use Expo's tunnel:

```bash
cd mobile
npx expo start --tunnel
```

**Note**: Tunnel mode is slower but works across different networks.

### Option 4: Manual Connection

1. **Find your computer's IP address**:
   - Windows: Open Command Prompt and type `ipconfig`
   - Look for "IPv4 Address" under your Wi-Fi adapter
   - Example: `192.168.1.100`

2. **In Expo Go app**:
   - Tap "Enter URL manually"
   - Enter: `exp://YOUR_IP_ADDRESS:8081`
   - Example: `exp://192.168.1.100:8081`

### Option 5: Check Firewall

**Windows Firewall:**
1. Open Windows Defender Firewall
2. Click "Allow an app or feature"
3. Make sure Node.js is allowed for Private networks
4. If not, click "Change settings" → "Allow another app" → Add Node.js

## Step-by-Step Restart

1. **Stop Metro** (Ctrl+C in terminal)

2. **Clear cache**:
   ```bash
   cd mobile
   npx expo start --clear
   ```

3. **Wait for QR code** to appear

4. **On your phone**:
   - Open Expo Go
   - Tap "Scan QR code"
   - Scan the code from terminal

5. **If still not working**, try tunnel mode:
   ```bash
   npx expo start --tunnel
   ```

## Verify Metro is Running

Check if Metro is listening on port 8081:
```bash
netstat -ano | findstr :8081
```

You should see a line with `:8081` if Metro is running.

## Still Not Working?

1. **Restart your phone's Wi-Fi**
2. **Restart your computer's Wi-Fi**
3. **Try a different network** (mobile hotspot)
4. **Use tunnel mode** as last resort




