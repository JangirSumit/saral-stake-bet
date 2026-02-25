# Crash Game Analyzer

A C# console application that analyzes crash game logs with different betting configurations to determine optimal strategies.

## Features

- **Log File Analysis**: Parses crash values from console log files
- **Multiple Configurations**: Test different betting strategies simultaneously
- **Profit/Loss Calculation**: Simulates betting with each configuration
- **CSV Export**: Results exported for further analysis
- **Skip/Resume Logic**: Implements the same logic as the Chrome extension

## Usage

1. **Build the application**:
   ```
   dotnet build
   ```

2. **Run the application**:
   ```
   dotnet run
   ```

3. **Provide inputs**:
   - Enter path to your console log file (from Chrome extension)
   - Enter path to configuration JSON file (or press Enter for defaults)

4. **View results**:
   - Console displays profit/loss for each configuration
   - CSV file generated with detailed analysis

## Configuration Format

Create a JSON file with betting configurations:

```json
[
  {
    "Name": "Conservative",
    "BetAmount": 1.0,
    "CashoutAt": 2.0,
    "OnLoss": 30,
    "OnWin": -25,
    "CrashAt": 2.0,
    "CrashTimes": 3,
    "ResumeAt": 5.0
  }
]
```

## Configuration Parameters

- **Name**: Strategy name for identification
- **BetAmount**: Initial bet amount
- **CashoutAt**: Target multiplier to cash out
- **OnLoss**: Percentage to increase bet after loss
- **OnWin**: Percentage to decrease bet after win (negative value)
- **CrashAt**: Skip threshold; positive = count crashes below threshold, negative = count crashes above absolute threshold
- **CrashTimes**: Number of consecutive crashes meeting CrashAt condition before skipping
- **ResumeAt**: Crash value to resume betting after skipping

## Log File Format

The application looks for crash patterns in log files:
- "New crash detected: 2.5x"
- "Crashed at 3.2x"

## Output

CSV file contains:
- Configuration name
- Total profit
- Total loss
- Net profit
- Total bets placed
- Win rate percentage

Results are sorted by net profit (highest first) to identify best performing strategies.
