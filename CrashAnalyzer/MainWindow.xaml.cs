using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows;

namespace CrashAnalyzer
{
    public partial class MainWindow : Window
    {
        private List<double> crashes = new List<double>();
        private List<BetResult> betResults = new List<BetResult>();
        
        public MainWindow()
        {
            InitializeComponent();
        }
        

        
        private void BtnLoadLog_Click(object sender, RoutedEventArgs e)
        {
            var openFileDialog = new OpenFileDialog
            {
                Filter = "Text files (*.txt)|*.txt|Log files (*.log)|*.log|All files (*.*)|*.*",
                Title = "Select Console Log File"
            };
            
            if (openFileDialog.ShowDialog() == true)
            {
                btnLoadLog.Content = "⏳ Loading...";
                btnLoadLog.IsEnabled = false;
                
                crashes = LoadCrashesFromLog(openFileDialog.FileName);
                var originalBets = LoadOriginalBetsFromLog(openFileDialog.FileName);
                
                btnLoadLog.Content = $"📁 Loaded {crashes.Count} crashes";
                btnLoadLog.IsEnabled = true;
                
                if (crashes.Count == 0)
                {
                    MessageBox.Show("No crash data found in the selected file.", "No Data", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }
                
                // Show original log data
                ShowOriginalData(originalBets);
            }
        }
        
        private void BtnAnalyze_Click(object sender, RoutedEventArgs e)
        {
            if (crashes.Count == 0)
            {
                MessageBox.Show("Please load a log file first.", "No Data", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            
            btnAnalyze.Content = "⏳ Analyzing...";
            btnAnalyze.IsEnabled = false;
            
            try
            {
                var config = new BettingConfig
                {
                    BetAmount = double.Parse(txtBetAmount.Text),
                    CashoutAt = double.Parse(txtCashoutAt.Text),
                    OnLoss = double.Parse(txtOnLoss.Text),
                    OnWin = double.Parse(txtOnWin.Text),
                    CrashAt = double.Parse(txtCrashAt.Text),
                    CrashTimes = int.Parse(txtCrashTimes.Text),
                    ResumeAt = double.Parse(txtResumeAt.Text),
                    ResumeAdjust = double.Parse(txtResumeAdjust.Text),
                    ResumeBelowAt = double.Parse(txtResumeBelowAt.Text),
                    ResumeBelowTimes = int.Parse(txtResumeBelowTimes.Text),
                    ResetThreshold = double.Parse(txtResetThreshold.Text),
                    ProfitTimes = int.Parse(txtProfitTimes.Text),
                    LossResetAmount = double.Parse(txtLossResetAmount.Text),
                    WalletStopLoss = double.Parse(txtWalletStopLoss.Text),
                    DecimalPlaces = int.Parse(txtDecimalPlaces.Text)
                };
                
                betResults = AnalyzeConfigurationDetailed(crashes, config);
                
                // Update summary
                var totalProfit = betResults.Where(r => r.Won).Sum(r => r.Profit);
                var totalLoss = betResults.Where(r => !r.Won && r.BetPlaced).Sum(r => r.BetAmount);
                var netProfit = totalProfit - totalLoss;
                var totalBets = betResults.Count(r => r.BetPlaced);
                
                lblTotalProfit.Text = $"Total Profit: ${totalProfit:F2}";
                lblTotalLoss.Text = $"Total Loss: ${totalLoss:F2}";
                lblNetProfit.Text = $"Net Profit: ${netProfit:F2}";
                lblTotalBets.Text = $"Total Bets: {totalBets}";
                
                // Show comparison data
                ShowComparisonData(betResults);
                
                btnAnalyze.Content = "⚡ Analyze";
                btnAnalyze.IsEnabled = true;
            }
            catch (Exception ex)
            {
                btnAnalyze.Content = "⚡ Analyze";
                btnAnalyze.IsEnabled = true;
                MessageBox.Show($"Error analyzing configuration: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
        
        private void OnConfigChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            // Config changed - analysis will happen on Analyze button click
        }
        
        private void ShowOriginalData(List<OriginalBet> originalBets)
        {
            var originalData = crashes.Select((crash, index) => new
            {
                Crash = $"{crash:F2}x",
                Status = index < originalBets.Count ? originalBets[index].Status : "No Bet",
                BetAmount = index < originalBets.Count ? $"${originalBets[index].BetAmount:F2}" : "-",
                Profit = index < originalBets.Count ? $"${originalBets[index].Profit:F2}" : "-"
            }).ToList();
            
            dgvOriginal.ItemsSource = originalData;
            dgvAnalyzed.ItemsSource = null;
        }
        
        private void ShowComparisonData(List<BetResult> newResults)
        {
            var analyzedData = crashes.Select((crash, index) => new
            {
                Crash = $"{crash:F2}x",
                Status = index < newResults.Count ? (newResults[index].BetPlaced ? (newResults[index].Won ? "Won" : "Lost") : "Skipped") : "-",
                BetAmount = index < newResults.Count && newResults[index].BetPlaced ? $"${newResults[index].BetAmount:F2}" : "-",
                Profit = index < newResults.Count && newResults[index].BetPlaced ? $"${newResults[index].Profit:F2}" : "-"
            }).ToList();
            
            dgvAnalyzed.ItemsSource = analyzedData;
        }
        
        private void BtnExport_Click(object sender, RoutedEventArgs e)
        {
            if (betResults.Count == 0)
            {
                MessageBox.Show("No results to export. Please analyze a file first.", "No Data", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            
            btnExport.Content = "⏳ Exporting...";
            btnExport.IsEnabled = false;
            
            var fileName = $"crash_analysis_{DateTime.Now:yyyyMMdd_HHmmss}.csv";
            var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var fullPath = Path.Combine(desktopPath, fileName);
            
            ExportDetailedResults(betResults, fullPath);
            
            btnExport.Content = "💾 Export CSV";
            btnExport.IsEnabled = true;
            
            MessageBox.Show($"Results exported to Desktop: {fileName}", "Export Complete", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        
        private List<double> LoadCrashesFromLog(string logPath)
        {
            var crashes = new List<double>();
            var lines = File.ReadAllLines(logPath);
            
            foreach (var line in lines)
            {
                if (line.Contains("New crash detected:"))
                {
                    // Extract crash value from log line like: "New crash detected: 7.64"
                    var startIndex = line.IndexOf("New crash detected:") + "New crash detected:".Length;
                    var remaining = line.Substring(startIndex).Trim();
                    
                    // Find the first number in the remaining text
                    var parts = remaining.Split(' ', ',', '\t');
                    foreach (var part in parts)
                    {
                        if (double.TryParse(part, out double crash) && crash > 0)
                        {
                            crashes.Add(crash);
                            break;
                        }
                    }
                }
            }
            
            return crashes;
        }
        
        private List<OriginalBet> LoadOriginalBetsFromLog(string logPath)
        {
            var bets = new List<OriginalBet>();
            var lines = File.ReadAllLines(logPath);
            
            foreach (var line in lines)
            {
                if (line.Contains("WON:") || line.Contains("LOST:"))
                {
                    var isWon = line.Contains("WON:");
                    var parts = line.Split(' ');
                    
                    for (int i = 0; i < parts.Length - 1; i++)
                    {
                        if (double.TryParse(parts[i], out double betAmount))
                        {
                            var profit = isWon ? betAmount * 1.5 - betAmount : -betAmount; // Simplified calculation
                            bets.Add(new OriginalBet
                            {
                                Status = isWon ? "Won" : "Lost",
                                BetAmount = betAmount,
                                Profit = profit
                            });
                            break;
                        }
                    }
                }
            }
            
            return bets;
        }
        
        private List<OriginalBet> LoadOriginalBetsFromLog(List<double> crashes)
        {
            // This method is for when we only have crashes and need to create dummy original data
            return new List<OriginalBet>();
        }
        
        private List<BetResult> AnalyzeConfigurationDetailed(List<double> crashes, BettingConfig config)
        {
            var results = new List<BetResult>();
            double currentBetAmount = config.BetAmount;
            double runningTotal = 0;
            int consecutiveLowCrashes = 0;
            bool skipBetting = false;
            
            foreach (var crash in crashes)
            {
                var result = new BetResult
                {
                    CrashValue = crash,
                    ConsecutiveLowCrashes = consecutiveLowCrashes,
                    SkipBetting = skipBetting
                };
                
                // Check resume condition
                if (skipBetting && crash >= config.ResumeAt)
                {
                    skipBetting = false;
                    consecutiveLowCrashes = 0;
                    result.SkipBetting = false;
                }
                
                // Place bet or skip
                if (!skipBetting)
                {
                    result.BetPlaced = true;
                    result.BetAmount = currentBetAmount;
                    result.Won = crash >= config.CashoutAt;
                    
                    if (result.Won)
                    {
                        result.Profit = (currentBetAmount * config.CashoutAt) - currentBetAmount;
                        runningTotal += result.Profit;
                        currentBetAmount = Math.Max(config.BetAmount, currentBetAmount * (1 + config.OnWin / 100.0));
                        consecutiveLowCrashes = 0;
                    }
                    else
                    {
                        result.Profit = -currentBetAmount;
                        runningTotal += result.Profit;
                        currentBetAmount = currentBetAmount * (1 + config.OnLoss / 100.0);
                        
                        if (crash < config.CrashAt)
                        {
                            consecutiveLowCrashes++;
                            if (consecutiveLowCrashes >= config.CrashTimes)
                            {
                                skipBetting = true;
                            }
                        }
                        else
                        {
                            consecutiveLowCrashes = 0;
                        }
                    }
                }
                
                result.RunningTotal = runningTotal;
                result.ConsecutiveLowCrashes = consecutiveLowCrashes;
                result.SkipBetting = skipBetting;
                results.Add(result);
            }
            
            return results;
        }
        
        private void ExportDetailedResults(List<BetResult> results, string fileName)
        {
            var csv = new StringBuilder();
            csv.AppendLine("Crash,Status,Bet Amount,Profit,Running Total,Consecutive Low,Skip Mode");
            
            foreach (var result in results)
            {
                csv.AppendLine($"{result.CrashValue:F2}x," +
                             $"{(result.BetPlaced ? (result.Won ? "Won" : "Lost") : "Skipped")}," +
                             $"{(result.BetPlaced ? result.BetAmount.ToString("F2") : "")}," +
                             $"{(result.BetPlaced ? result.Profit.ToString("F2") : "")}," +
                             $"{result.RunningTotal:F2}," +
                             $"{result.ConsecutiveLowCrashes}," +
                             $"{(result.SkipBetting ? "Yes" : "No")}");
            }
            
            File.WriteAllText(fileName, csv.ToString());
        }
    }
    
    public class BettingConfig
    {
        public string Name { get; set; }
        public double BetAmount { get; set; }
        public double CashoutAt { get; set; }
        public double OnLoss { get; set; }
        public double OnWin { get; set; }
        public double CrashAt { get; set; }
        public int CrashTimes { get; set; }
        public double ResumeAt { get; set; }
        public double ResumeAdjust { get; set; }
        public double ResumeBelowAt { get; set; }
        public int ResumeBelowTimes { get; set; }
        public double ResetThreshold { get; set; }
        public int ProfitTimes { get; set; }
        public double LossResetAmount { get; set; }
        public double WalletStopLoss { get; set; }
        public int DecimalPlaces { get; set; }
    }
    
    public class BetResult
    {
        public double CrashValue { get; set; }
        public bool BetPlaced { get; set; }
        public bool Won { get; set; }
        public double BetAmount { get; set; }
        public double Profit { get; set; }
        public double RunningTotal { get; set; }
        public int ConsecutiveLowCrashes { get; set; }
        public bool SkipBetting { get; set; }
    }
    
    public class OriginalBet
    {
        public string Status { get; set; }
        public double BetAmount { get; set; }
        public double Profit { get; set; }
    }
}