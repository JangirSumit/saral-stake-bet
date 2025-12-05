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
        

        
        private async void BtnLoadLog_Click(object sender, RoutedEventArgs e)
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
                
                var filePath = openFileDialog.FileName;
                
                await System.Threading.Tasks.Task.Run(() =>
                {
                    crashes = LoadCrashesFromLog(filePath);
                    var originalBets = LoadOriginalBetsFromLog(filePath);
                    ExtractLogFileConfig(filePath);
                    
                    Dispatcher.Invoke(() =>
                    {
                        btnLoadLog.Content = $"📁 Loaded {crashes.Count} crashes";
                        btnLoadLog.IsEnabled = true;
                        
                        if (crashes.Count == 0)
                        {
                            MessageBox.Show("No crash data found in the selected file.", "No Data", MessageBoxButton.OK, MessageBoxImage.Warning);
                            return;
                        }
                        
                        ShowOriginalData(originalBets);
                    });
                });
            }
        }
        
        private async void BtnAnalyze_Click(object sender, RoutedEventArgs e)
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
                
                await System.Threading.Tasks.Task.Run(() =>
                {
                    betResults = AnalyzeConfigurationDetailed(crashes, config);
                    
                    Dispatcher.Invoke(() =>
                    {
                        ShowComparisonData(betResults);
                        btnAnalyze.Content = "⚡ Analyze";
                        btnAnalyze.IsEnabled = true;
                    });
                });
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
        
        private bool _isUpdatingSelection = false;
        
        private void DgvOriginal_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
        {
            if (!_isUpdatingSelection && dgvOriginal.SelectedIndex >= 0 && dgvAnalyzed.Items.Count > dgvOriginal.SelectedIndex)
            {
                _isUpdatingSelection = true;
                dgvAnalyzed.SelectedIndex = dgvOriginal.SelectedIndex;
                dgvAnalyzed.ScrollIntoView(dgvAnalyzed.SelectedItem);
                SynchronizeScrollPosition(dgvOriginal, dgvAnalyzed);
                _isUpdatingSelection = false;
            }
        }
        
        private void DgvAnalyzed_SelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
        {
            if (!_isUpdatingSelection && dgvAnalyzed.SelectedIndex >= 0 && dgvOriginal.Items.Count > dgvAnalyzed.SelectedIndex)
            {
                _isUpdatingSelection = true;
                dgvOriginal.SelectedIndex = dgvAnalyzed.SelectedIndex;
                dgvOriginal.ScrollIntoView(dgvOriginal.SelectedItem);
                SynchronizeScrollPosition(dgvAnalyzed, dgvOriginal);
                _isUpdatingSelection = false;
            }
        }
        
        private void SynchronizeScrollPosition(System.Windows.Controls.DataGrid source, System.Windows.Controls.DataGrid target)
        {
            var sourceScrollViewer = GetScrollViewer(source);
            var targetScrollViewer = GetScrollViewer(target);
            
            if (sourceScrollViewer != null && targetScrollViewer != null)
            {
                targetScrollViewer.ScrollToVerticalOffset(sourceScrollViewer.VerticalOffset);
            }
        }
        
        private System.Windows.Controls.ScrollViewer GetScrollViewer(System.Windows.Controls.DataGrid dataGrid)
        {
            if (dataGrid == null) return null;
            
            for (int i = 0; i < System.Windows.Media.VisualTreeHelper.GetChildrenCount(dataGrid); i++)
            {
                var child = System.Windows.Media.VisualTreeHelper.GetChild(dataGrid, i);
                if (child is System.Windows.Controls.ScrollViewer scrollViewer)
                    return scrollViewer;
                
                var result = FindScrollViewer(child);
                if (result != null)
                    return result;
            }
            return null;
        }
        
        private System.Windows.Controls.ScrollViewer FindScrollViewer(System.Windows.DependencyObject parent)
        {
            for (int i = 0; i < System.Windows.Media.VisualTreeHelper.GetChildrenCount(parent); i++)
            {
                var child = System.Windows.Media.VisualTreeHelper.GetChild(parent, i);
                if (child is System.Windows.Controls.ScrollViewer scrollViewer)
                    return scrollViewer;
                
                var result = FindScrollViewer(child);
                if (result != null)
                    return result;
            }
            return null;
        }
        
        private void ShowOriginalData(List<OriginalBet> originalBets)
        {
            var originalData = crashes.Select((crash, index) => new
            {
                No = (object)(index + 1),
                Crash = $"{crash:F2}x",
                Status = index < originalBets.Count ? 
                    (originalBets[index].Status == "Placed" ? "No Bet" : originalBets[index].Status) : "No Bet",
                BetAmount = index < originalBets.Count ? $"${originalBets[index].BetAmount:F2}" : "-",
                Profit = index < originalBets.Count ? $"${originalBets[index].Profit:F2}" : "-"
            }).ToList();
            
            // Update max profit/loss displays
            if (originalBets.Any(b => b.Status != "Skipped"))
            {
                var maxProfit = originalBets.Where(b => b.Status != "Skipped").Max(b => b.Profit);
                var minProfit = originalBets.Where(b => b.Status != "Skipped").Min(b => b.Profit);
                
                txtOriginalMaxProfit.Text = $"Max Profit: ${maxProfit:F2}";
                txtOriginalMaxLoss.Text = $"Max Loss: ${Math.Abs(minProfit):F2}";
            }
            else
            {
                txtOriginalMaxProfit.Text = "Max Profit: $0.00";
                txtOriginalMaxLoss.Text = "Max Loss: $0.00";
            }
            
            // Add net profit row
            var totalProfit = originalBets.Where(b => b.Status != "Skipped").Sum(b => b.Profit);
            originalData.Add(new
            {
                No = (object)"NET",
                Crash = "-",
                Status = totalProfit >= 0 ? "PROFIT" : "LOSS",
                BetAmount = "-",
                Profit = $"${totalProfit:F2}"
            });
            
            dgvOriginal.ItemsSource = originalData;
            dgvAnalyzed.ItemsSource = null;
            
            // Update log settings display
            UpdateLogSettingsDisplay();
        }
        
        private void ShowComparisonData(List<BetResult> newResults)
        {
            var analyzedData = crashes.Select((crash, index) => new
            {
                No = (object)(index + 1),
                Crash = $"{crash:F2}x",
                Status = index < newResults.Count ? (newResults[index].BetPlaced ? (newResults[index].Won ? "Won" : "Lost") : "Skipped") : "-",
                BetAmount = index < newResults.Count && newResults[index].BetPlaced ? $"${newResults[index].BetAmount:F2}" : "-",
                Profit = index < newResults.Count && newResults[index].BetPlaced ? $"${newResults[index].Profit:F2}" : "-"
            }).ToList();
            
            // Update max profit/loss displays
            if (newResults.Any(r => r.BetPlaced))
            {
                var maxProfit = newResults.Where(r => r.BetPlaced).Max(r => r.Profit);
                var minProfit = newResults.Where(r => r.BetPlaced).Min(r => r.Profit);
                
                txtAnalyzedMaxProfit.Text = $"Max Profit: ${maxProfit:F2}";
                txtAnalyzedMaxLoss.Text = $"Max Loss: ${Math.Abs(minProfit):F2}";
            }
            else
            {
                txtAnalyzedMaxProfit.Text = "Max Profit: $0.00";
                txtAnalyzedMaxLoss.Text = "Max Loss: $0.00";
            }
            
            // Add net profit row
            var totalProfit = newResults.Where(r => r.BetPlaced).Sum(r => r.Profit);
            analyzedData.Add(new
            {
                No = (object)"NET",
                Crash = "-",
                Status = totalProfit >= 0 ? "PROFIT" : "LOSS",
                BetAmount = "-",
                Profit = $"${totalProfit:F2}"
            });
            
            dgvAnalyzed.ItemsSource = analyzedData;
            
            // Update current settings display
            UpdateCurrentSettingsDisplay();
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
            
            var fileName = $"crash_analysis_{DateTime.Now:yyyyMMdd_HHmmss}.csv";
            var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var fullPath = Path.Combine(desktopPath, fileName);
            
            ExportDetailedResults(betResults, config, fullPath);
            
            btnExport.Content = "💾 Export CSV";
            btnExport.IsEnabled = true;
            
            MessageBox.Show($"Results exported to Desktop: {fileName}", "Export Complete", MessageBoxButton.OK, MessageBoxImage.Information);
        }
        
        private List<double> LoadCrashesFromLog(string logPath)
        {
            var crashes = new List<double>();
            var lines = File.ReadAllLines(logPath);
            bool bettingStarted = false;
            
            foreach (var line in lines)
            {
                if (line.Contains("AUTO-BETTING STARTED"))
                {
                    bettingStarted = true;
                    continue;
                }
                
                if (bettingStarted && line.Contains("New crash detected:"))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(line, @"New crash detected: ([\d\.]+)×?");
                    if (match.Success)
                    {
                        if (double.TryParse(match.Groups[1].Value, out double crash))
                        {
                            crashes.Add(crash);
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
            var crashCount = 0;
            bool bettingStarted = false;
            
            // First count crashes after AUTO-BETTING STARTED
            foreach (var line in lines)
            {
                if (line.Contains("AUTO-BETTING STARTED"))
                {
                    bettingStarted = true;
                    continue;
                }
                
                if (bettingStarted && line.Contains("New crash detected:"))
                {
                    crashCount++;
                }
            }
            
            // Initialize bets list with "No Bet" entries for all crashes
            for (int i = 0; i < crashCount; i++)
            {
                bets.Add(new OriginalBet
                {
                    Status = "No Bet",
                    BetAmount = 0,
                    Profit = 0
                });
            }
            
            int currentCrashIndex = -1;
            int nextBetCrashIndex = -1;
            bettingStarted = false;
            
            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i];
                
                if (line.Contains("AUTO-BETTING STARTED"))
                {
                    bettingStarted = true;
                    continue;
                }
                
                // Track crash index only after betting started
                if (bettingStarted && line.Contains("New crash detected:"))
                {
                    currentCrashIndex++;
                    
                    // Check if this crash has betting results
                    if (nextBetCrashIndex == currentCrashIndex)
                    {
                        // Look ahead for profit/loss results for this crash
                        for (int j = i + 1; j < Math.Min(i + 20, lines.Length); j++)
                        {
                            if (lines[j].Contains("Profit this round:"))
                            {
                                var profitMatch = System.Text.RegularExpressions.Regex.Match(lines[j], @"Profit this round: ([\d\.]+)");
                                if (profitMatch.Success)
                                {
                                    bets[currentCrashIndex].Status = "Won";
                                    bets[currentCrashIndex].Profit = double.Parse(profitMatch.Groups[1].Value);
                                }
                                break;
                            }
                            else if (lines[j].Contains("Loss this round:"))
                            {
                                var lossMatch = System.Text.RegularExpressions.Regex.Match(lines[j], @"Loss this round: ([\d\.]+)");
                                if (lossMatch.Success)
                                {
                                    bets[currentCrashIndex].Status = "Lost";
                                    bets[currentCrashIndex].Profit = -double.Parse(lossMatch.Groups[1].Value);
                                }
                                break;
                            }
                            else if (lines[j].Contains("BET SKIPPED"))
                            {
                                bets[currentCrashIndex].Status = "Skipped";
                                break;
                            }
                            else if (lines[j].Contains("New crash detected:"))
                            {
                                break; // Next crash found, stop looking
                            }
                        }
                    }
                    continue;
                }
                
                // Check for bet placement - this bet is for the NEXT crash
                if (line.Contains("=== PLACING BET ==="))
                {
                    nextBetCrashIndex = currentCrashIndex + 1;
                    
                    // Look for bet amount in next few lines
                    for (int j = i + 1; j < Math.Min(i + 5, lines.Length); j++)
                    {
                        if (lines[j].Contains("Current bet amount:"))
                        {
                            var betMatch = System.Text.RegularExpressions.Regex.Match(lines[j], @"Current bet amount: ([\d\.]+)");
                            if (betMatch.Success && nextBetCrashIndex < bets.Count)
                            {
                                bets[nextBetCrashIndex].Status = "Placed";
                                bets[nextBetCrashIndex].BetAmount = double.Parse(betMatch.Groups[1].Value);
                                break;
                            }
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
        
        private BettingConfig logFileConfig = null;
        
        private void UpdateLogSettingsDisplay()
        {
            if (logFileConfig != null)
            {
                txtLogSettings.Text = $"Bet: ${logFileConfig.BetAmount} | Cashout: {logFileConfig.CashoutAt}x | Loss: +{logFileConfig.OnLoss}% | Win: {logFileConfig.OnWin}% | Skip: {logFileConfig.CrashTimes} crashes < {logFileConfig.CrashAt}x | Resume: {logFileConfig.ResumeAt}x";
            }
            else
            {
                txtLogSettings.Text = "No configuration found in log file";
            }
        }
        
        private void UpdateCurrentSettingsDisplay()
        {
            try
            {
                txtCurrentSettings.Text = $"Bet: ${txtBetAmount.Text} | Cashout: {txtCashoutAt.Text}x | Loss: +{txtOnLoss.Text}% | Win: {txtOnWin.Text}% | Skip: {txtCrashTimes.Text} crashes < {txtCrashAt.Text}x | Resume: {txtResumeAt.Text}x";
            }
            catch
            {
                txtCurrentSettings.Text = "Invalid configuration values";
            }
        }
        
        private void ExtractLogFileConfig(string logPath)
        {
            var lines = File.ReadAllLines(logPath);
            foreach (var line in lines)
            {
                if (line.Contains("CONFIG:"))
                {
                    try
                    {
                        var configStart = line.IndexOf("{");
                        if (configStart >= 0)
                        {
                            var configJson = line.Substring(configStart);
                            var config = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(configJson);
                            
                            logFileConfig = new BettingConfig
                            {
                                BetAmount = config["amount"].GetDouble(),
                                CashoutAt = config["cashout"].GetDouble(),
                                OnLoss = config["onLoss"].GetDouble(),
                                OnWin = config["onWin"].GetDouble(),
                                CrashAt = config["crashAt"].GetDouble(),
                                CrashTimes = config["crashTimes"].GetInt32(),
                                ResumeAt = config["resumeAt"].GetDouble(),
                                ResumeAdjust = config["resumeAdjust"].GetDouble(),
                                ResumeBelowAt = config["resumeBelowAt"].GetDouble(),
                                ResumeBelowTimes = config["resumeBelowTimes"].GetInt32(),
                                ResetThreshold = config["resetThreshold"].GetDouble(),
                                ProfitTimes = config["profitTimes"].GetInt32(),
                                LossResetAmount = config["lossResetAmount"].GetDouble(),
                                WalletStopLoss = config["walletStopLoss"].GetDouble(),
                                DecimalPlaces = config["decimalPlaces"].GetInt32()
                            };
                            break;
                        }
                    }
                    catch
                    {
                        logFileConfig = null;
                    }
                }
            }
        }
        
        private void ExportDetailedResults(List<BetResult> results, BettingConfig config, string fileName)
        {
            var csv = new StringBuilder();
            
            // Add configuration settings
            csv.AppendLine("Configuration Settings");
            csv.AppendLine($"Bet Amount,{config.BetAmount}");
            csv.AppendLine($"Cashout At,{config.CashoutAt}");
            csv.AppendLine($"On Loss %,{config.OnLoss}");
            csv.AppendLine($"On Win %,{config.OnWin}");
            csv.AppendLine($"Crash At,{config.CrashAt}");
            csv.AppendLine($"Crash Times,{config.CrashTimes}");
            csv.AppendLine($"Resume At,{config.ResumeAt}");
            csv.AppendLine($"Resume Adjust %,{config.ResumeAdjust}");
            csv.AppendLine($"Resume Below At,{config.ResumeBelowAt}");
            csv.AppendLine($"Resume Below Times,{config.ResumeBelowTimes}");
            csv.AppendLine($"Reset Threshold %,{config.ResetThreshold}");
            csv.AppendLine($"Profit Times,{config.ProfitTimes}");
            csv.AppendLine($"Loss Reset Amount,{config.LossResetAmount}");
            csv.AppendLine($"Wallet Stop Loss %,{config.WalletStopLoss}");
            csv.AppendLine($"Decimal Places,{config.DecimalPlaces}");
            csv.AppendLine();
            
            // Add results data
            csv.AppendLine("Analysis Results");
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
        public string Name { get; set; } = "";
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
        public string Status { get; set; } = "";
        public double BetAmount { get; set; }
        public double Profit { get; set; }
    }
}