# Browser Launcher for Stake Betting Extension

PowerShell script to launch Chrome or Edge with optimized performance flags to prevent tab suspension and maintain extension connectivity.

## 🚀 Quick Start

```powershell
# Launch Chrome (default)
.\launch-chrome.ps1

# Launch Edge
.\launch-chrome.ps1 -Browser edge
```

## 📋 Usage

### Basic Commands
```powershell
# Chrome with performance flags
.\launch-chrome.ps1

# Edge with performance flags  
.\launch-chrome.ps1 -Browser edge

# Chrome with additional flags
.\launch-chrome.ps1 -AdditionalFlags "--incognito --new-window"

# Edge with additional flags
.\launch-chrome.ps1 -Browser edge -AdditionalFlags "--inprivate"
```

### Parameters
- **`-Browser`**: Choose browser (`chrome` or `edge`) - Default: `chrome`
- **`-AdditionalFlags`**: Add custom browser flags - Default: `""`

## 🔧 Performance Flags Applied

The script automatically applies these optimization flags:

| Flag | Purpose |
|------|---------|
| `--disable-background-timer-throttling` | Prevents timer throttling in background tabs |
| `--disable-renderer-backgrounding` | Keeps renderer active when tab not visible |
| `--disable-backgrounding-occluded-windows` | Prevents suspension of hidden windows |
| `--disable-features=TranslateUI` | Disables translate popup interference |
| `--aggressive-cache-discard-disabled` | Prevents aggressive memory cleanup |

## 💡 Why Use This?

### Problem
- Browser suspends inactive tabs after 5+ minutes
- Content script loses connection to page
- Betting automation stops unexpectedly
- Extension becomes unresponsive

### Solution
- Launches browser with performance flags
- Keeps tabs active indefinitely
- Maintains extension connectivity
- Ensures uninterrupted betting sessions

## 🛠️ Installation

1. **Download** the `launch-chrome.ps1` script
2. **Right-click** → "Run with PowerShell"
3. **Or run in PowerShell:**
   ```powershell
   .\launch-chrome.ps1
   ```

## 🔒 Security Note

The script only launches browsers with performance flags - no system modifications or security risks.

## 🆘 Troubleshooting

### Browser Not Found
```
Chrome not found. Please install Chrome or use -Browser parameter.
```
**Solution**: Install Chrome/Edge or specify correct browser with `-Browser` parameter

### PowerShell Execution Policy
```
Execution of scripts is disabled on this system.
```
**Solution**: Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Script Won't Run
**Solution**: Right-click script → Properties → Unblock → OK

## 📝 Examples

```powershell
# Standard Chrome launch
.\launch-chrome.ps1

# Edge with private browsing
.\launch-chrome.ps1 -Browser edge -AdditionalFlags "--inprivate"

# Chrome with developer tools
.\launch-chrome.ps1 -AdditionalFlags "--auto-open-devtools-for-tabs"

# Chrome with specific profile
.\launch-chrome.ps1 -AdditionalFlags "--profile-directory=Profile1"
```

## ⚡ Pro Tips

1. **Create Desktop Shortcut**: Right-click script → Send to → Desktop
2. **Pin to Taskbar**: Create shortcut, then pin to taskbar
3. **Always Use**: Launch browser with this script for betting sessions
4. **Combine with Extension**: Use together with "Keep Tab Active" extension for maximum reliability

---

**Note**: This launcher is specifically designed for the Stake Crash Auto Betting Extension to maintain optimal performance during long betting sessions.