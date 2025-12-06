using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows;
using System.Text.Json;

namespace CrashAnalyzer
{
    public partial class MainWindow : Window
    {
        private List<double> crashes = new List<double>();
        private List<DateTime> crashTimestamps = new List<DateTime>();
        private List<BetResult> betResults = new List<BetResult>();

        public MainWindow()
        {
            InitializeComponent();
            Loaded += MainWindow_Loaded;
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            // Set default values directly
            txtBetAmount.Text = "5";
            txtCashoutAt.Text = "2.9";
            txtOnLoss.Text = "35";
            txtOnWin.Text = "-50";
            txtCrashAt.Text = "2.9";
            txtCrashTimes.Text = "3";
            txtResumeAt.Text = "0";
            txtResumeAdjust.Text = "35";
            txtResumeBelowAt.Text = "2.9";
            txtResumeBelowTimes.Text = "5";
            txtResetThreshold.Text = "-40";
            txtProfitTimes.Text = "3";
            txtLossResetAmount.Text = "5000";
            txtWalletStopLoss.Text = "0";
            txtDecimalPlaces.Text = "2";

            LoadConfiguration();
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
            SaveConfiguration();
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

        private System.Windows.Controls.ScrollViewer? GetScrollViewer(System.Windows.Controls.DataGrid dataGrid)
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

        private System.Windows.Controls.ScrollViewer? FindScrollViewer(System.Windows.DependencyObject parent)
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

        private bool _isScrollSyncing = false;

        private void OnOriginalGridScrollChanged(object sender, System.Windows.Controls.ScrollChangedEventArgs e)
        {
            if (!_isScrollSyncing)
            {
                _isScrollSyncing = true;
                var targetScrollViewer = GetScrollViewer(dgvAnalyzed);
                if (targetScrollViewer != null)
                {
                    targetScrollViewer.ScrollToVerticalOffset(e.VerticalOffset);
                }
                _isScrollSyncing = false;
            }
        }

        private void OnAnalyzedGridScrollChanged(object sender, System.Windows.Controls.ScrollChangedEventArgs e)
        {
            if (!_isScrollSyncing)
            {
                _isScrollSyncing = true;
                var targetScrollViewer = GetScrollViewer(dgvOriginal);
                if (targetScrollViewer != null)
                {
                    targetScrollViewer.ScrollToVerticalOffset(e.VerticalOffset);
                }
                _isScrollSyncing = false;
            }
        }

        private void AttachScrollSynchronization()
        {
            var originalScrollViewer = GetScrollViewer(dgvOriginal);
            var analyzedScrollViewer = GetScrollViewer(dgvAnalyzed);

            if (originalScrollViewer != null)
            {
                originalScrollViewer.ScrollChanged -= OnOriginalGridScrollChanged;
                originalScrollViewer.ScrollChanged += OnOriginalGridScrollChanged;
            }

            if (analyzedScrollViewer != null)
            {
                analyzedScrollViewer.ScrollChanged -= OnAnalyzedGridScrollChanged;
                analyzedScrollViewer.ScrollChanged += OnAnalyzedGridScrollChanged;
            }
        }

        private void ShowOriginalData(List<OriginalBet> originalBets)
        {
            var originalData = crashes.Select((crash, index) => new
            {
                No = (object)(index + 1),
                Timestamp = index < crashTimestamps.Count ? crashTimestamps[index].ToString("HH:mm:ss") : "-",
                Crash = $"{crash:F2}x",
                Status = index < originalBets.Count ? originalBets[index].Status : "No Bet",
                BetAmount = index < originalBets.Count ?
                    (originalBets[index].Status == "Skipped" ? "-" : $"${originalBets[index].BetAmount:F2}") : "-",
                Profit = index < originalBets.Count ?
                    (originalBets[index].Status == "Skipped" ? "-" : $"${originalBets[index].Profit:F2}") : "-"
            }).ToList();

            // Update summary displays
            if (originalBets.Any(b => b.Status != "Skipped"))
            {
                var betsPlaced = originalBets.Where(b => b.Status != "Skipped");
                var totalBets = betsPlaced.Count();
                var wins = betsPlaced.Count(b => b.Status == "Won");
                var losses = betsPlaced.Count(b => b.Status == "Lost");
                var totalProfit = betsPlaced.Sum(b => b.Profit);
                var maxProfit = betsPlaced.Max(b => b.Profit);
                var minProfit = betsPlaced.Min(b => b.Profit);
                
                txtOriginalMaxProfit.Text = $"Total: ${totalProfit:F2}";
                txtOriginalMaxLoss.Text = $"Bets: {totalBets} (W:{wins} L:{losses})";
                txtOriginalMaxSingle.Text = $"Max Profit: ${maxProfit:F2}";
                txtOriginalSkipped.Text = $"Skipped: {originalBets.Count(b => b.Status == "Skipped")}";
                txtOriginalLoss.Text = $"Max Loss: ${Math.Abs(minProfit):F2}";
            }
            else
            {
                txtOriginalMaxProfit.Text = "Total: $0.00";
                txtOriginalMaxLoss.Text = "Bets: 0";
                txtOriginalMaxSingle.Text = "Max Profit: $0.00";
                txtOriginalSkipped.Text = "Skipped: 0";
                txtOriginalLoss.Text = "Max Loss: $0.00";
            }

            dgvOriginal.ItemsSource = originalData;
            dgvAnalyzed.ItemsSource = null;

            // Attach scroll synchronization
            AttachScrollSynchronization();

            // Update log settings display
            UpdateLogSettingsDisplay();
        }

        private void ShowComparisonData(List<BetResult> newResults)
        {
            var analyzedData = crashes.Select((crash, index) => new
            {
                No = (object)(index + 1),
                Timestamp = index < crashTimestamps.Count ? crashTimestamps[index].ToString("HH:mm:ss") : "-",
                Crash = $"{crash:F2}x",
                Status = index < newResults.Count ? (newResults[index].BetPlaced ? (newResults[index].Won ? "Won" : "Lost") : "Skipped") : "-",
                BetAmount = index < newResults.Count && newResults[index].BetPlaced ? $"${newResults[index].BetAmount:F2}" : "-",
                Profit = index < newResults.Count && newResults[index].BetPlaced ? $"${newResults[index].Profit:F2}" : "-"
            }).ToList();

            // Update summary displays
            if (newResults.Any(r => r.BetPlaced))
            {
                var betsPlaced = newResults.Where(r => r.BetPlaced);
                var totalBets = betsPlaced.Count();
                var wins = betsPlaced.Count(r => r.Won);
                var losses = betsPlaced.Count(r => !r.Won);
                var totalProfit = betsPlaced.Sum(r => r.Profit);
                var maxProfit = betsPlaced.Max(r => r.Profit);
                var minProfit = betsPlaced.Min(r => r.Profit);
                
                txtAnalyzedMaxProfit.Text = $"Total: ${totalProfit:F2}";
                txtAnalyzedMaxLoss.Text = $"Bets: {totalBets} (W:{wins} L:{losses})";
                txtAnalyzedMaxSingle.Text = $"Max Profit: ${maxProfit:F2}";
                txtAnalyzedSkipped.Text = $"Skipped: {newResults.Count(r => !r.BetPlaced)}";
                txtAnalyzedLoss.Text = $"Max Loss: ${Math.Abs(minProfit):F2}";
            }
            else
            {
                txtAnalyzedMaxProfit.Text = "Total: $0.00";
                txtAnalyzedMaxLoss.Text = "Bets: 0";
                txtAnalyzedMaxSingle.Text = "Max Profit: $0.00";
                txtAnalyzedSkipped.Text = "Skipped: 0";
                txtAnalyzedLoss.Text = "Max Loss: $0.00";
            }

            dgvAnalyzed.ItemsSource = analyzedData;

            // Attach scroll synchronization
            AttachScrollSynchronization();

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
            crashTimestamps = new List<DateTime>();
            var lines = File.ReadAllLines(logPath);
            bool firstBetPlaced = false;

            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i];

                // Start collecting crashes after first bet is placed
                if (!firstBetPlaced && line.Contains("=== PLACING BET ==="))
                {
                    firstBetPlaced = true;
                    continue;
                }

                if (firstBetPlaced && line.Contains("New crash detected:"))
                {
                    var match = System.Text.RegularExpressions.Regex.Match(line, @"New crash detected: ([\d\.]+)×?");
                    if (match.Success)
                    {
                        if (double.TryParse(match.Groups[1].Value, out double crash))
                        {
                            crashes.Add(crash);
                            // Extract timestamp from log line
                            var timestamp = ExtractTimestampFromLine(line);
                            crashTimestamps.Add(timestamp);
                        }
                    }
                }
            }

            return crashes;
        }

        private DateTime ExtractTimestampFromLine(string line)
        {
            // Try to extract timestamp from various formats
            var timestampMatch = System.Text.RegularExpressions.Regex.Match(line, @"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)");
            if (timestampMatch.Success)
            {
                if (DateTime.TryParse(timestampMatch.Groups[1].Value, out DateTime timestamp))
                    return timestamp;
            }
            
            // Try simpler format
            timestampMatch = System.Text.RegularExpressions.Regex.Match(line, @"(\d{2}:\d{2}:\d{2})");
            if (timestampMatch.Success)
            {
                if (TimeSpan.TryParse(timestampMatch.Groups[1].Value, out TimeSpan time))
                    return DateTime.Today.Add(time);
            }
            
            return DateTime.Now;
        }

        private List<OriginalBet> LoadOriginalBetsFromLog(string logPath)
        {
            var bets = new List<OriginalBet>();
            var lines = File.ReadAllLines(logPath);
            bool bettingStarted = false;

            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i];

                if (line.Contains("AUTO-BETTING STARTED"))
                {
                    bettingStarted = true;
                    continue;
                }

                if (!bettingStarted) continue;

                // Handle bet placement
                if (line.Contains("=== PLACING BET ==="))
                {
                    double betAmount = 0;
                    for (int j = i + 1; j < Math.Min(i + 5, lines.Length); j++)
                    {
                        if (lines[j].Contains("Current bet amount:"))
                        {
                            var betMatch = System.Text.RegularExpressions.Regex.Match(lines[j], @"Current bet amount: ([\d\.]+)");
                            if (betMatch.Success)
                            {
                                betAmount = double.Parse(betMatch.Groups[1].Value);
                                break;
                            }
                        }
                    }

                    var bet = new OriginalBet
                    {
                        Status = "Placed",
                        BetAmount = betAmount,
                        Profit = 0
                    };

                    // Look ahead for result
                    for (int j = i + 1; j < Math.Min(i + 50, lines.Length); j++)
                    {
                        if (lines[j].Contains("Profit this round:"))
                        {
                            var profitMatch = System.Text.RegularExpressions.Regex.Match(lines[j], @"Profit this round: ([\d\.]+)");
                            if (profitMatch.Success)
                            {
                                bet.Status = "Won";
                                bet.Profit = double.Parse(profitMatch.Groups[1].Value);
                            }
                            break;
                        }
                        else if (lines[j].Contains("Loss this round:"))
                        {
                            var lossMatch = System.Text.RegularExpressions.Regex.Match(lines[j], @"Loss this round: ([\d\.]+)");
                            if (lossMatch.Success)
                            {
                                bet.Status = "Lost";
                                bet.Profit = -double.Parse(lossMatch.Groups[1].Value);
                            }
                            break;
                        }
                        else if (lines[j].Contains("=== PLACING BET ==="))
                        {
                            break; // Next bet found, stop looking
                        }
                    }

                    bets.Add(bet);
                }
                // Handle skipped bets
                else if (line.Contains("BET SKIPPED"))
                {
                    bets.Add(new OriginalBet
                    {
                        Status = "Skipped",
                        BetAmount = 0,
                        Profit = 0
                    });
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

            // Initialize variables exactly like content.js
            double currentBetAmount = config.BetAmount;
            double originalBetAmount = config.BetAmount;
            double lastBetAmount = 0;
            double totalProfit = 0;
            double runningTotal = 0;
            int consecutiveLowCrashes = 0;
            int consecutiveResumeBelowCrashes = 0;
            bool skipBetting = false;
            bool currentBetExists = false;

            for (int i = 0; i < crashes.Count; i++)
            {
                var crash = crashes[i];
                var result = new BetResult 
                { 
                    CrashValue = crash,
                    Timestamp = i < crashTimestamps.Count ? crashTimestamps[i] : DateTime.Now
                };
                currentBetExists = false; // Reset each round

                if (i == 20)
                {
                    Console.WriteLine("");
                }

                // Step 1: Handle stop/resume logic (matches handleStopResumeLogic)
                if (skipBetting)
                {
                    // Check resume logic first (matches checkResumeLogic)
                    if (config.ResumeAt > 0 && crash >= config.ResumeAt)
                    {
                        // Resume betting (matches resumeBetting)
                        if (config.ResumeAdjust != 0)
                        {
                            currentBetAmount = AdjustBetAmount(lastBetAmount, config.ResumeAdjust, config.DecimalPlaces);
                        }
                        else
                        {
                            currentBetAmount = lastBetAmount;
                        }
                        skipBetting = false;
                        consecutiveLowCrashes = 0;
                        consecutiveResumeBelowCrashes = 0;
                    }
                    // Alternative resume logic
                    else if (config.ResumeBelowAt > 0 && config.ResumeBelowTimes > 0)
                    {
                        if (consecutiveResumeBelowCrashes >= config.ResumeBelowTimes)
                        {
                            // Resume betting
                            if (config.ResumeAdjust != 0)
                            {
                                currentBetAmount = AdjustBetAmount(lastBetAmount, config.ResumeAdjust, config.DecimalPlaces);
                            }
                            else
                            {
                                currentBetAmount = lastBetAmount;
                            }
                            skipBetting = false;
                            consecutiveLowCrashes = 0;
                            consecutiveResumeBelowCrashes = 0;
                        }
                        
                        if (crash < config.ResumeBelowAt)
                        {
                            consecutiveResumeBelowCrashes++;
                        }
                        else
                        {
                            consecutiveResumeBelowCrashes = 0;
                        }
                    }
                }

                // Step 2: Place bet or skip (matches betWatcher logic)
                if (!skipBetting)
                {
                    result.BetPlaced = true;
                    result.BetAmount = currentBetAmount;
                    lastBetAmount = currentBetAmount;
                    currentBetExists = true;
                    result.Won = crash >= config.CashoutAt;

                    // Process bet result (matches adjustBetAmountBasedOnResult)
                    if (result.Won)
                    {
                        result.Profit = (currentBetAmount * config.CashoutAt) - currentBetAmount;
                        totalProfit += result.Profit;
                        runningTotal += result.Profit;

                        // Check profit reset threshold
                        if (config.ProfitTimes > 0 && totalProfit >= originalBetAmount * config.ProfitTimes)
                        {
                            currentBetAmount = originalBetAmount;
                            totalProfit = 0;
                        }
                        else if (config.OnWin == 0)
                        {
                            currentBetAmount = originalBetAmount;
                        }
                        else
                        {
                            currentBetAmount = AdjustBetAmount(currentBetAmount, -Math.Abs(config.OnWin), config.DecimalPlaces);
                        }
                    }
                    else
                    {
                        result.Profit = -currentBetAmount;
                        totalProfit -= currentBetAmount;
                        runningTotal += result.Profit;

                        currentBetAmount = AdjustBetAmount(currentBetAmount, Math.Abs(config.OnLoss), config.DecimalPlaces);
                    }

                    // Check reset thresholds
                    if (config.ResetThreshold != 0)
                    {
                        double changePercent = ((currentBetAmount - originalBetAmount) / originalBetAmount) * 100;
                        bool thresholdExceeded = config.ResetThreshold > 0 ?
                            changePercent >= config.ResetThreshold :
                            changePercent <= config.ResetThreshold;

                        if (thresholdExceeded)
                        {
                            currentBetAmount = originalBetAmount;
                        }
                    }

                    if (config.LossResetAmount > 0 && totalProfit < 0)
                    {
                        double currentLoss = Math.Abs(totalProfit);
                        if (currentLoss >= config.LossResetAmount)
                        {
                            currentBetAmount = originalBetAmount;
                            lastBetAmount = originalBetAmount;
                            totalProfit = 0;
                        }
                    }
                }

                // Step 3: Process crash patterns AFTER bet result (matches checkCrashPattern)
                if (currentBetExists && config.CrashAt > 0 && config.CrashTimes > 0)
                {
                    if (crash < config.CrashAt)
                    {
                        consecutiveLowCrashes++;
                        if (consecutiveLowCrashes >= config.CrashTimes)
                        {
                            skipBetting = true;
                            consecutiveResumeBelowCrashes = 0;
                        }
                    }
                    else
                    {
                        consecutiveLowCrashes = 0;
                    }
                }

                result.RunningTotal = runningTotal;
                result.ConsecutiveLowCrashes = consecutiveLowCrashes;
                result.SkipBetting = skipBetting;
                results.Add(result);
            }

            return results;
        }

        private double AdjustBetAmount(double amount, double percentage, int decimalPlaces)
        {
            double percent = percentage;
            double multiplier = 1 + percent / 100.0;
            double adjustedAmount = amount * multiplier;
            return Math.Round(adjustedAmount, decimalPlaces);
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

        private void SaveConfiguration()
        {
            try
            {
                var config = new
                {
                    BetAmount = txtBetAmount.Text,
                    CashoutAt = txtCashoutAt.Text,
                    OnLoss = txtOnLoss.Text,
                    OnWin = txtOnWin.Text,
                    CrashAt = txtCrashAt.Text,
                    CrashTimes = txtCrashTimes.Text,
                    ResumeAt = txtResumeAt.Text,
                    ResumeAdjust = txtResumeAdjust.Text,
                    ResumeBelowAt = txtResumeBelowAt.Text,
                    ResumeBelowTimes = txtResumeBelowTimes.Text,
                    ResetThreshold = txtResetThreshold.Text,
                    ProfitTimes = txtProfitTimes.Text,
                    LossResetAmount = txtLossResetAmount.Text,
                    WalletStopLoss = txtWalletStopLoss.Text,
                    DecimalPlaces = txtDecimalPlaces.Text
                };

                var json = System.Text.Json.JsonSerializer.Serialize(config, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                File.WriteAllText(configPath, json);
            }
            catch { }
        }

        private void LoadConfiguration()
        {
            // Temporarily disable TextChanged events
            txtBetAmount.TextChanged -= OnConfigChanged;
            txtCashoutAt.TextChanged -= OnConfigChanged;
            txtOnLoss.TextChanged -= OnConfigChanged;
            txtOnWin.TextChanged -= OnConfigChanged;
            txtCrashAt.TextChanged -= OnConfigChanged;
            txtCrashTimes.TextChanged -= OnConfigChanged;
            txtResumeAt.TextChanged -= OnConfigChanged;
            txtResumeAdjust.TextChanged -= OnConfigChanged;
            txtResumeBelowAt.TextChanged -= OnConfigChanged;
            txtResumeBelowTimes.TextChanged -= OnConfigChanged;
            txtResetThreshold.TextChanged -= OnConfigChanged;
            txtProfitTimes.TextChanged -= OnConfigChanged;
            txtLossResetAmount.TextChanged -= OnConfigChanged;
            txtWalletStopLoss.TextChanged -= OnConfigChanged;
            txtDecimalPlaces.TextChanged -= OnConfigChanged;

            try
            {
                var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                if (File.Exists(configPath))
                {
                    var json = File.ReadAllText(configPath);
                    var config = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(json);

                    txtBetAmount.Text = config["BetAmount"].GetString();
                    txtCashoutAt.Text = config["CashoutAt"].GetString();
                    txtOnLoss.Text = config["OnLoss"].GetString();
                    txtOnWin.Text = config["OnWin"].GetString();
                    txtCrashAt.Text = config["CrashAt"].GetString();
                    txtCrashTimes.Text = config["CrashTimes"].GetString();
                    txtResumeAt.Text = config["ResumeAt"].GetString();
                    txtResumeAdjust.Text = config["ResumeAdjust"].GetString();
                    txtResumeBelowAt.Text = config["ResumeBelowAt"].GetString();
                    txtResumeBelowTimes.Text = config["ResumeBelowTimes"].GetString();
                    txtResetThreshold.Text = config["ResetThreshold"].GetString();
                    txtProfitTimes.Text = config["ProfitTimes"].GetString();
                    txtLossResetAmount.Text = config["LossResetAmount"].GetString();
                    txtWalletStopLoss.Text = config["WalletStopLoss"].GetString();
                    txtDecimalPlaces.Text = config["DecimalPlaces"].GetString();
                }
                else
                {
                    // Set default configuration
                    txtBetAmount.Text = "5";
                    txtCashoutAt.Text = "2.9";
                    txtOnLoss.Text = "35";
                    txtOnWin.Text = "-50";
                    txtCrashAt.Text = "2.9";
                    txtCrashTimes.Text = "3";
                    txtResumeAt.Text = "0";
                    txtResumeAdjust.Text = "35";
                    txtResumeBelowAt.Text = "2.9";
                    txtResumeBelowTimes.Text = "5";
                    txtResetThreshold.Text = "-40";
                    txtProfitTimes.Text = "3";
                    txtLossResetAmount.Text = "5000";
                    txtWalletStopLoss.Text = "0";
                    txtDecimalPlaces.Text = "2";
                }
            }
            catch
            {
                // Set default configuration on error
                txtBetAmount.Text = "5";
                txtCashoutAt.Text = "2.9";
                txtOnLoss.Text = "35";
                txtOnWin.Text = "-50";
                txtCrashAt.Text = "2.9";
                txtCrashTimes.Text = "3";
                txtResumeAt.Text = "0";
                txtResumeAdjust.Text = "35";
                txtResumeBelowAt.Text = "2.9";
                txtResumeBelowTimes.Text = "5";
                txtResetThreshold.Text = "-40";
                txtProfitTimes.Text = "3";
                txtLossResetAmount.Text = "5000";
                txtWalletStopLoss.Text = "0";
                txtDecimalPlaces.Text = "2";
            }

            // Re-enable TextChanged events
            txtBetAmount.TextChanged += OnConfigChanged;
            txtCashoutAt.TextChanged += OnConfigChanged;
            txtOnLoss.TextChanged += OnConfigChanged;
            txtOnWin.TextChanged += OnConfigChanged;
            txtCrashAt.TextChanged += OnConfigChanged;
            txtCrashTimes.TextChanged += OnConfigChanged;
            txtResumeAt.TextChanged += OnConfigChanged;
            txtResumeAdjust.TextChanged += OnConfigChanged;
            txtResumeBelowAt.TextChanged += OnConfigChanged;
            txtResumeBelowTimes.TextChanged += OnConfigChanged;
            txtResetThreshold.TextChanged += OnConfigChanged;
            txtProfitTimes.TextChanged += OnConfigChanged;
            txtLossResetAmount.TextChanged += OnConfigChanged;
            txtWalletStopLoss.TextChanged += OnConfigChanged;
            txtDecimalPlaces.TextChanged += OnConfigChanged;

            // Save configuration after loading
            SaveConfiguration();
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
        public DateTime Timestamp { get; set; }
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
        public DateTime Timestamp { get; set; }
    }
}