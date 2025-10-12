# Browser Launcher for Stake Betting Extension

PowerShell script to launch Chrome or Edge with optimized performance flags to prevent tab suspension and maintain extension connectivity.

## 🚀 Quick Start

### Method 1: Right-Click (Easiest)
1. **Right-click** `launch-chrome.ps1`
2. **Select** "Run with PowerShell"
3. **Done!** Chrome launches automatically

### Method 2: Command Line
```powershell
# Launch Chrome (default)
.\launch-chrome.ps1

# Launch Edge
.\launch-chrome.ps1 -Browser edge
```

### Method 3: One-Line Command
```cmd
# From Command Prompt (cmd)
powershell -ExecutionPolicy Bypass -File "launch-chrome.ps1"

# From PowerShell
powershell -ExecutionPolicy Bypass .\launch-chrome.ps1
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

## 🛠️ Installation & Running

### Option 1: Simple Right-Click (Recommended)
1. **Download** `launch-chrome.ps1` to any folder
2. **Right-click** the file
3. **Select** "Run with PowerShell"
4. **Chrome launches** with optimized settings

### Option 2: Command Line
```powershell
# Navigate to script folder
cd "C:\path\to\script"

# Run script
.\launch-chrome.ps1
```

### Option 3: From Any Location
```cmd
# Run from anywhere (replace path)
powershell -ExecutionPolicy Bypass -File "C:\path\to\launch-chrome.ps1"
```

### Option 4: Create Batch File
Create `launch-betting-chrome.bat`:
```batch
@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0launch-chrome.ps1"
pause
```
Double-click the `.bat` file to run.

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
**Solutions**:
- Right-click script → Properties → Unblock → OK
- Use bypass command: `powershell -ExecutionPolicy Bypass -File "launch-chrome.ps1"`
- Run as Administrator if needed

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

### Easy Access Methods
1. **Desktop Shortcut**: Right-click script → Send to → Desktop
2. **Taskbar Pin**: Create shortcut, then pin to taskbar  
3. **Start Menu**: Copy to `%APPDATA%\Microsoft\Windows\Start Menu\Programs`

### Quick Commands
```powershell
# Create alias for easy access
Set-Alias betting "C:\path\to\launch-chrome.ps1"
betting  # Now just type 'betting'

# Add to PowerShell profile for permanent alias
echo 'Set-Alias betting "C:\path\to\launch-chrome.ps1"' >> $PROFILE
```

### Best Practices
4. **Always Use**: Launch browser with this script for betting sessions
5. **Combine with Extension**: Use together with "Keep Tab Active" extension for maximum reliability
6. **Keep Script Handy**: Save in easily accessible location like Desktop or Documents

---

**Note**: This launcher is specifically designed for the Stake Crash Auto Betting Extension to maintain optimal performance during long betting sessions.