# PowerShell script to launch Chrome/Edge with performance flags for betting extension
# Usage: .\launch-chrome.ps1 [-Browser chrome|edge] [-AdditionalFlags "--flag1 --flag2"]

param(
    [string]$Browser = "chrome",
    [string]$AdditionalFlags = ""
)

$performanceFlags = @(
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding", 
    "--disable-backgrounding-occluded-windows",
    "--disable-features=TranslateUI",
    "--aggressive-cache-discard-disabled"
)

# Browser paths
$browserPaths = @{
    "chrome" = @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
    )
    "edge" = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
    )
}

# Find browser installation
$browserPath = $null
$browserName = $Browser.ToLower()

if ($browserPaths.ContainsKey($browserName)) {
    foreach ($path in $browserPaths[$browserName]) {
        if (Test-Path $path) {
            $browserPath = $path
            break
        }
    }
}

if (-not $browserPath) {
    Write-Host "$Browser not found. Please install $Browser or use -Browser parameter." -ForegroundColor Red
    Write-Host "Usage: .\launch-chrome.ps1 -Browser chrome|edge" -ForegroundColor Yellow
    exit 1
}

# Combine flags
$allFlags = $performanceFlags
if ($AdditionalFlags) {
    $allFlags += $AdditionalFlags.Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
}

Write-Host "Launching $Browser with performance flags..." -ForegroundColor Green
Write-Host "Flags: $($allFlags -join ' ')" -ForegroundColor Yellow

# Launch browser with flags
& $browserPath $allFlags "https://stake.bet/casino/games/crash"

Write-Host "$Browser launched successfully!" -ForegroundColor Green