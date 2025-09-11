# Stake Crash Auto Betting Chrome Extension

A Chrome extension that automates betting on Stake.bet's Crash game with advanced risk management features.

## Features

### 🎯 **Automated Betting**
- Automatic bet placement with configurable amounts
- Real-time crash detection and bet management
- Seamless integration with Stake.bet interface

### 💰 **Dynamic Bet Adjustment**
- **On Loss**: Increase bet amount by specified percentage (e.g., 30% increase)
- **On Win**: Decrease bet amount by specified percentage (e.g., 25% decrease)
- Maintains betting progression based on results

### 🛑 **Smart Skip Logic**
- **Trigger**: Skip betting after consecutive losses on actual bets placed
- **Counting**: Only counts losses on bets you placed (ignores skipped rounds)
- **Example**: Skip after 3 consecutive bet losses at crashes ≤ 2.0x

### 🔄 **Intelligent Resume Logic**
- **Trigger**: Resume betting when any crash crosses resume threshold
- **Monitoring**: Watches all crashes during skip period (not just bet crashes)
- **Example**: Resume when crash ≥ 5.0x (indicates market recovery)

### 📊 **Real-time Monitoring**
- Live betting history with win/loss tracking
- Current bet amount display
- Connection status indicator
- Bet notifications (placed/skipped)

### 🔧 **Safety Features**
- Auto-refresh on connection loss
- Start button disabled when not connected
- Collapsible configuration panels
- Fullscreen history view

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `Extension` folder
5. Navigate to [Stake.bet Crash Game](https://stake.bet/casino/games/crash)
6. Open the extension sidepanel

## Configuration

### Basic Settings
- **Bet Amount**: Initial betting amount
- **Cashout At**: Target multiplier for cashing out
- **On Loss (%)**: Percentage to increase bet after loss
- **On Win (%)**: Percentage to decrease bet after win

### Skip Betting Rules
- **Crash At**: Threshold for considering a crash as "low" (e.g., 2.0)
- **Times**: Number of consecutive losses before skipping (e.g., 3)

### Resume Betting
- **Resume At**: Crash threshold to resume betting (e.g., 5.0)

## Usage

1. **Configure Settings**: Set your betting parameters
2. **Save Config**: Click "Save Config" to store settings
3. **Start Betting**: Click "Start" when status shows connected
4. **Monitor**: Watch real-time betting activity and history
5. **Stop**: Click "Stop" to halt automated betting

## Game Logic & Strategy

### What This Extension Does

This extension implements an **automated Martingale-style betting system** with **intelligent risk management** for Stake.bet's Crash game. Here's the core strategy:

#### 1. **Automated Betting Cycle**
- Places bets automatically when "Bet" button appears
- Sets predefined cashout multiplier (e.g., 2.5x)
- Monitors crash results and adjusts bet amounts accordingly

#### 2. **Progressive Bet Sizing (Martingale System)**
- **After Loss**: Increase bet by X% (e.g., 30%) to recover losses
- **After Win**: Decrease bet by Y% (e.g., 25%) to secure profits
- **Goal**: Recover losses with fewer wins than losses

#### 3. **Risk Management - Skip Logic**
- **Problem**: Consecutive losses can lead to exponential bet increases
- **Solution**: Skip betting after N consecutive losses on actual bets
- **Trigger**: Only counts losses on bets we placed (not skipped rounds)
- **Purpose**: Prevent catastrophic loss during bad streaks

#### 4. **Market Recovery - Resume Logic**
- **Problem**: How to know when to resume betting after skipping?
- **Solution**: Monitor all crashes during skip period
- **Trigger**: Resume when any crash crosses high threshold (e.g., 5.0x)
- **Logic**: High crashes indicate market recovery from low streak

### Detailed Logic Flow

#### Skip Logic Example
```
Config: crashAt=2.0, crashTimes=3, resumeAt=5.0

Bet 1: Crash 1.5x → Loss (count=1) → Bet increases
Bet 2: Crash 1.8x → Loss (count=2) → Bet increases  
Bet 3: Crash 1.2x → Loss (count=3) → SKIP MODE ON
Skip:  Next rounds skipped, no bets placed
Skip:  Crash 3.0x → Still skipping (< 5.0x)
Skip:  Crash 4.2x → Still skipping (< 5.0x)
Resume: Crash 6.0x → SKIP MODE OFF (≥ 5.0x)
Bet 4: Resume betting with last calculated amount
```

#### Bet Amount Progression
```
Initial: ₹1.00
Loss 1:  ₹1.30 (+30%) - trying to recover ₹1.00 loss
Loss 2:  ₹1.69 (+30%) - trying to recover ₹2.30 total loss
Win:     ₹1.27 (-25%) - secured profit, reduce risk
```

#### Why This Strategy Works
1. **Martingale Recovery**: Larger bets after losses help recover faster
2. **Profit Securing**: Smaller bets after wins preserve gains
3. **Risk Limitation**: Skip logic prevents unlimited loss escalation
4. **Market Timing**: Resume logic waits for favorable conditions

#### Key Advantages
- **Automated**: No manual intervention required
- **Disciplined**: Follows strategy without emotional decisions
- **Risk-Aware**: Built-in safeguards against catastrophic losses
- **Adaptive**: Adjusts to market conditions (high/low crash periods)

## File Structure

```
Extension/
├── manifest.json       # Extension configuration
├── sidepanel.html      # UI interface
├── sidepanel.js        # UI logic and interactions
├── styles.css          # Styling and animations
├── content.js          # Main automation logic
└── background.js       # Service worker
```

## Key Components

### Content Script (`content.js`)
- DOM element detection and monitoring
- Bet placement automation
- Crash detection via MutationObserver
- Skip/resume logic implementation
- Bet amount calculations

### Sidepanel (`sidepanel.html/js`)
- Configuration interface
- Real-time status updates
- Betting history display
- Start/stop controls

### Background Service (`background.js`)
- Sidepanel management
- Extension lifecycle handling

## Safety Warnings

⚠️ **Important Disclaimers:**
- This extension is for educational purposes only
- Gambling involves financial risk - never bet more than you can afford to lose
- The extension automates betting but cannot guarantee profits
- Always monitor your betting activity and set reasonable limits
- Use responsibly and in accordance with local laws

## Technical Details

### Browser Compatibility
- Chrome 88+ (Manifest V3)
- Requires sidepanel API support

### Permissions
- `sidePanel`: For extension UI
- `storage`: For configuration persistence
- `activeTab`: For Stake.bet interaction

### Domain Restriction
- Only works on `stake.bet` domain
- Automatically activates on Crash game page

## Troubleshooting

### Connection Issues
- Refresh the Stake.bet page if status shows "Ready"
- Ensure you're on the Crash game page
- Check browser console for error messages

### Betting Not Working
- Verify all configuration fields are filled
- Ensure sufficient account balance
- Check if game interface has changed

### Extension Not Loading
- Verify extension is enabled in Chrome
- Check for manifest.json errors
- Reload extension in developer mode

## Contributing

This project is for educational purposes. If you find bugs or have suggestions:
1. Document the issue clearly
2. Include browser console logs
3. Describe expected vs actual behavior

## License

This project is provided as-is for educational purposes only. Use at your own risk.

---

**Remember**: Responsible gambling is key. Set limits, take breaks, and never chase losses.