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
        private List<OriginalBet> originalBets = new List<OriginalBet>();

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
                        allBetResults = new List<BetResult>(betResults);
                        ShowComparisonData(betResults);
                        AutoFillDateTimeRange();
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

        private List<double> originalCrashes = new List<double>();
        private List<DateTime> originalCrashTimestamps = new List<DateTime>();
        private List<OriginalBet> allOriginalBets = new List<OriginalBet>();
        private List<BetResult> allBetResults = new List<BetResult>();

        private void BtnFilter_Click(object sender, RoutedEventArgs e)
        {
            if (originalCrashes.Count == 0)
            {
                MessageBox.Show("No data loaded. Please load a log file first.", "No Data", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!DateTime.TryParse(txtFromDateTime.Text, out DateTime fromDate) || 
                !DateTime.TryParse(txtToDateTime.Text, out DateTime toDate))
            {
                MessageBox.Show("Please enter valid date-time format (YYYY-MM-DD HH:MM).", "Invalid Date Format", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var filteredIndices = originalCrashTimestamps
                .Select((timestamp, index) => new { timestamp, index })
                .Where(x => x.timestamp >= fromDate && x.timestamp <= toDate)
                .Select(x => x.index)
                .ToList();

            if (!filteredIndices.Any())
            {
                MessageBox.Show("No data found in the selected date range.", "No Data", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            crashes = filteredIndices.Select(i => originalCrashes[i]).ToList();
            crashTimestamps = filteredIndices.Select(i => originalCrashTimestamps[i]).ToList();
            var filteredOriginalBets = filteredIndices.Select(i => i < allOriginalBets.Count ? allOriginalBets[i] : new OriginalBet()).ToList();

            ShowOriginalData(filteredOriginalBets);
            
            // Filter analyzed data if it exists
            if (allBetResults.Any())
            {
                betResults = filteredIndices.Select(i => i < allBetResults.Count ? allBetResults[i] : new BetResult()).ToList();
                ShowComparisonData(betResults);
            }
            else
            {
                betResults.Clear();
                dgvAnalyzed.ItemsSource = null;
                
                // Clear analyzed summary badges
                txtAnalyzedMaxProfit.Text = "Total: $0.00";
                txtAnalyzedMaxLoss.Text = "Bets: 0";
                txtAnalyzedMaxSingle.Text = "Max Profit: $0.00";
                txtAnalyzedSkipped.Text = "Skipped: 0";
                txtAnalyzedLoss.Text = "Max Loss: $0.00";
            }
        }

        private void BtnClearFilter_Click(object sender, RoutedEventArgs e)
        {
            crashes = new List<double>(originalCrashes);
            crashTimestamps = new List<DateTime>(originalCrashTimestamps);
            ShowOriginalData(allOriginalBets);
            
            // Restore analyzed data if it exists
            if (allBetResults.Any())
            {
                betResults = new List<BetResult>(allBetResults);
                ShowComparisonData(betResults);
            }
            else
            {
                betResults.Clear();
                dgvAnalyzed.ItemsSource = null;
            }
            
            AutoFillDateTimeRange();
        }

        private void AutoFillDateTimeRange()
        {
            if (crashTimestamps.Any())
            {
                var startTime = crashTimestamps.Min();
                var endTime = crashTimestamps.Max();
                txtFromDateTime.Text = startTime.ToString("yyyy-MM-dd HH:mm");
                txtToDateTime.Text = endTime.ToString("yyyy-MM-dd HH:mm");
            }
        }

        private void ShowOriginalData(List<OriginalBet> originalBetsParam)
        {
            // Store original data only on first load (when original arrays are empty)
            if (originalCrashes.Count == 0 && crashes.Count > 0)
            {
                originalCrashes = new List<double>(crashes);
                originalCrashTimestamps = new List<DateTime>(crashTimestamps);
                allOriginalBets = new List<OriginalBet>(originalBetsParam);
            }
            this.originalBets = originalBetsParam;
            var decimalPlaces = int.TryParse(txtDecimalPlaces.Text, out int dp) ? dp : 2;
            var originalData = crashes.Select((crash, index) => new
            {
                No = (object)(index + 1),
                Timestamp = index < crashTimestamps.Count ? crashTimestamps[index].ToString("HH:mm:ss") : "-",
                Crash = $"{crash.ToString($"F{decimalPlaces}")}x",
                Status = index < originalBetsParam.Count ? originalBetsParam[index].Status : "No Bet",
                BetAmount = index < originalBetsParam.Count ?
                    (originalBetsParam[index].Status == "Skipped" ? "-" : $"${originalBetsParam[index].BetAmount.ToString($"F{decimalPlaces}")}") : "-",
                Profit = index < originalBetsParam.Count ?
                    (originalBetsParam[index].Status == "Skipped" ? "-" : $"${originalBetsParam[index].Profit.ToString($"F{decimalPlaces}")}") : "-"
            }).ToList();

            // Update summary displays
            if (originalBetsParam.Any(b => b.Status != "Skipped"))
            {
                var betsPlaced = originalBetsParam.Where(b => b.Status != "Skipped");
                var totalBets = betsPlaced.Count();
                var wins = betsPlaced.Count(b => b.Status == "Won");
                var losses = betsPlaced.Count(b => b.Status == "Lost");
                var totalProfit = betsPlaced.Sum(b => b.Profit);
                var maxProfit = betsPlaced.Max(b => b.Profit);
                var minProfit = betsPlaced.Min(b => b.Profit);
                
                txtOriginalMaxProfit.Text = $"Total: ${totalProfit.ToString($"F{decimalPlaces}")}";
                txtOriginalMaxLoss.Text = $"Bets: {totalBets} (W:{wins} L:{losses})";
                txtOriginalMaxSingle.Text = $"Max Profit: ${maxProfit.ToString($"F{decimalPlaces}")}";
                txtOriginalSkipped.Text = $"Skipped: {originalBetsParam.Count(b => b.Status == "Skipped")}";
                txtOriginalLoss.Text = $"Max Loss: ${Math.Abs(minProfit).ToString($"F{decimalPlaces}")}";
            }
            else
            {
                txtOriginalMaxProfit.Text = "Total: $0.00";
                txtOriginalMaxLoss.Text = "Bets: 0";
                txtOriginalMaxSingle.Text = "Max Profit: $0.00";
                txtOriginalSkipped.Text = "Skipped: 0";
                txtOriginalLoss.Text = "Max Loss: $0.00";
            }

            dgvOriginal.ItemsSource = null;
            dgvOriginal.ItemsSource = originalData;
            dgvAnalyzed.ItemsSource = null;

            // Attach scroll synchronization
            AttachScrollSynchronization();

            // Update log settings display
            UpdateLogSettingsDisplay();
        }

        private void ShowComparisonData(List<BetResult> newResults)
        {
            var decimalPlaces = int.TryParse(txtDecimalPlaces.Text, out int dp) ? dp : 2;
            var analyzedData = crashes.Select((crash, index) => new
            {
                No = (object)(index + 1),
                Timestamp = index < crashTimestamps.Count ? crashTimestamps[index].ToString("HH:mm:ss") : "-",
                Crash = $"{crash.ToString($"F{decimalPlaces}")}x",
                Status = index < newResults.Count ? (newResults[index].BetPlaced ? (newResults[index].Won ? "Won" : "Lost") : "Skipped") : "-",
                BetAmount = index < newResults.Count && newResults[index].BetPlaced ? $"${newResults[index].BetAmount.ToString($"F{decimalPlaces}")}" : "-",
                Profit = index < newResults.Count && newResults[index].BetPlaced ? $"${newResults[index].Profit.ToString($"F{decimalPlaces}")}" : "-"
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
                
                txtAnalyzedMaxProfit.Text = $"Total: ${totalProfit.ToString($"F{decimalPlaces}")}";
                txtAnalyzedMaxLoss.Text = $"Bets: {totalBets} (W:{wins} L:{losses})";
                txtAnalyzedMaxSingle.Text = $"Max Profit: ${maxProfit.ToString($"F{decimalPlaces}")}";
                txtAnalyzedSkipped.Text = $"Skipped: {newResults.Count(r => !r.BetPlaced)}";
                txtAnalyzedLoss.Text = $"Max Loss: ${Math.Abs(minProfit).ToString($"F{decimalPlaces}")}";
            }
            else
            {
                txtAnalyzedMaxProfit.Text = "Total: $0.00";
                txtAnalyzedMaxLoss.Text = "Bets: 0";
                txtAnalyzedMaxSingle.Text = "Max Profit: $0.00";
                txtAnalyzedSkipped.Text = "Skipped: 0";
                txtAnalyzedLoss.Text = "Max Loss: $0.00";
            }

            dgvAnalyzed.ItemsSource = null;
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
                        else
                        {
                            currentBetAmount = AdjustBetAmount(currentBetAmount, config.OnWin, config.DecimalPlaces);
                        }
                    }
                    else
                    {
                        result.Profit = -currentBetAmount;
                        totalProfit -= currentBetAmount;
                        runningTotal += result.Profit;

                        currentBetAmount = AdjustBetAmount(currentBetAmount, config.OnLoss, config.DecimalPlaces);
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

                    // Wallet stop loss check
                    if (config.WalletStopLoss > 0)
                    {
                        double lossPercentage = (Math.Abs(runningTotal) / (originalBetAmount * 100)) * 100;
                        if (runningTotal < 0 && lossPercentage >= config.WalletStopLoss)
                        {
                            skipBetting = true;
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
                txtLogSettings.Text = $"Bet: ${logFileConfig.BetAmount} | Cashout: {logFileConfig.CashoutAt}x | OnLoss: {logFileConfig.OnLoss}% | OnWin: {logFileConfig.OnWin}% | Skip: {logFileConfig.CrashTimes}@{logFileConfig.CrashAt}x | Resume: {logFileConfig.ResumeAt}x | ResumeAdj: {logFileConfig.ResumeAdjust}% | ResumeBelow: {logFileConfig.ResumeBelowTimes}@{logFileConfig.ResumeBelowAt}x | Reset: {logFileConfig.ResetThreshold}% | ProfitReset: {logFileConfig.ProfitTimes}x | LossReset: ${logFileConfig.LossResetAmount} | WalletStop: {logFileConfig.WalletStopLoss}% | Decimals: {logFileConfig.DecimalPlaces}";
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
                txtCurrentSettings.Text = $"Bet: ${txtBetAmount.Text} | Cashout: {txtCashoutAt.Text}x | OnLoss: {txtOnLoss.Text}% | OnWin: {txtOnWin.Text}% | Skip: {txtCrashTimes.Text}@{txtCrashAt.Text}x | Resume: {txtResumeAt.Text}x | ResumeAdj: {txtResumeAdjust.Text}% | ResumeBelow: {txtResumeBelowTimes.Text}@{txtResumeBelowAt.Text}x | Reset: {txtResetThreshold.Text}% | ProfitReset: {txtProfitTimes.Text}x | LossReset: ${txtLossResetAmount.Text} | WalletStop: {txtWalletStopLoss.Text}% | Decimals: {txtDecimalPlaces.Text}";
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

        private void BtnSaveConfig_Click(object sender, RoutedEventArgs e)
        {
            var saveFileDialog = new Microsoft.Win32.SaveFileDialog
            {
                Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*",
                Title = "Save Configuration",
                DefaultExt = "json"
            };

            if (saveFileDialog.ShowDialog() == true)
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
                    File.WriteAllText(saveFileDialog.FileName, json);
                    MessageBox.Show("Configuration saved successfully!", "Success", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Error saving configuration: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private void BtnLoadConfig_Click(object sender, RoutedEventArgs e)
        {
            var openFileDialog = new Microsoft.Win32.OpenFileDialog
            {
                Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*",
                Title = "Load Configuration"
            };

            if (openFileDialog.ShowDialog() == true)
            {
                try
                {
                    var json = File.ReadAllText(openFileDialog.FileName);
                    var config = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(json);

                    // Handle both string and numeric values from JSON
                    txtBetAmount.Text = GetConfigValue(config, "BetAmount");
                    txtCashoutAt.Text = GetConfigValue(config, "CashoutAt");
                    txtOnLoss.Text = GetConfigValue(config, "OnLoss");
                    txtOnWin.Text = GetConfigValue(config, "OnWin");
                    txtCrashAt.Text = GetConfigValue(config, "CrashAt");
                    txtCrashTimes.Text = GetConfigValue(config, "CrashTimes");
                    txtResumeAt.Text = GetConfigValue(config, "ResumeAt");
                    txtResumeAdjust.Text = GetConfigValue(config, "ResumeAdjust");
                    txtResumeBelowAt.Text = GetConfigValue(config, "ResumeBelowAt");
                    txtResumeBelowTimes.Text = GetConfigValue(config, "ResumeBelowTimes");
                    txtResetThreshold.Text = GetConfigValue(config, "ResetThreshold");
                    txtProfitTimes.Text = GetConfigValue(config, "ProfitTimes");
                    txtLossResetAmount.Text = GetConfigValue(config, "LossResetAmount");
                    txtWalletStopLoss.Text = GetConfigValue(config, "WalletStopLoss");
                    txtDecimalPlaces.Text = GetConfigValue(config, "DecimalPlaces");

                    MessageBox.Show("Configuration loaded successfully!", "Success", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Error loading configuration: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private void BtnDeepAnalysis_Click(object sender, RoutedEventArgs e)
        {
            if (betResults.Count == 0)
            {
                MessageBox.Show("Please analyze a file first.", "No Data", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var analysis = PerformDeepAnalysis();
            ShowDeepAnalysisResults(analysis);
        }

        private DeepAnalysisResult PerformDeepAnalysis()
        {
            var result = new DeepAnalysisResult();
            var betsPlaced = betResults.Where(r => r.BetPlaced).ToList();
            
            if (!betsPlaced.Any()) return result;

            // Profit Distribution
            result.ProfitDistribution = AnalyzeProfitDistribution(betsPlaced);
            
            // Time-based Analysis
            result.TimeAnalysis = AnalyzeTimePatterns(betsPlaced);
            
            return result;
        }



        private List<string> AnalyzeProfitDistribution(List<BetResult> betsPlaced)
        {
            var distribution = new List<string>();
            var profits = betsPlaced.Select(b => b.Profit).ToList();
            
            var ranges = new[] { (-1000, -100), (-100, -10), (-10, 0), (0, 10), (10, 100), (100, 1000) };
            
            distribution.Add("💰 Profit Distribution:");
            foreach (var (min, max) in ranges)
            {
                var count = profits.Count(p => p > min && p <= max);
                var percentage = (count * 100.0 / profits.Count);
                if (count > 0)
                {
                    distribution.Add($"• ${min} to ${max}: {count} bets ({percentage:F1}%)");
                }
            }
            
            return distribution;
        }

        private List<string> AnalyzeTimePatterns(List<BetResult> betsPlaced)
        {
            var timeAnalysis = new List<string>();
            var hourlyStats = betsPlaced.GroupBy(b => b.Timestamp.Hour)
                .Select(g => new { Hour = g.Key, Profit = g.Sum(b => b.Profit), Count = g.Count() })
                .OrderByDescending(h => h.Profit)
                .ToList();
            
            timeAnalysis.Add("⏰ Time-based Analysis:");
            if (hourlyStats.Any())
            {
                timeAnalysis.Add("🟢 Best Performing Hours:");
                foreach (var hour in hourlyStats.Take(3))
                {
                    timeAnalysis.Add($"• {hour.Hour:D2}:00 - Profit: ${hour.Profit:F2} ({hour.Count} bets)");
                }
                
                timeAnalysis.Add("🔴 Worst Performing Hours:");
                foreach (var hour in hourlyStats.TakeLast(3).Reverse())
                {
                    timeAnalysis.Add($"• {hour.Hour:D2}:00 - Profit: ${hour.Profit:F2} ({hour.Count} bets)");
                }
            }
            else
            {
                timeAnalysis.Add("• Insufficient data for time analysis");
            }
            
            return timeAnalysis;
        }



        private void ShowDeepAnalysisResults(DeepAnalysisResult analysis)
        {
            var window = new Window
            {
                Title = "🔍 Deep Analysis Results",
                Width = 1200,
                Height = 800,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                Owner = this,
                Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(15, 23, 42))
            };

            var scrollViewer = new System.Windows.Controls.ScrollViewer
            {
                VerticalScrollBarVisibility = System.Windows.Controls.ScrollBarVisibility.Auto,
                Padding = new Thickness(20)
            };

            var mainPanel = new System.Windows.Controls.StackPanel();

            // Create visual sections with charts
            CreateCrashPatternsHeatmap(mainPanel);
            CreateProfitDistributionChart(mainPanel);
            CreateCrashLineChart(mainPanel);

            scrollViewer.Content = mainPanel;
            window.Content = scrollViewer;
            window.ShowDialog();
        }

        private void CreateProfitDistributionChart(System.Windows.Controls.StackPanel parent)
        {
            var betsPlaced = betResults.Where(r => r.BetPlaced).ToList();
            if (!betsPlaced.Any()) return;

            var sectionBorder = new System.Windows.Controls.Border
            {
                Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(30, 41, 59)),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(15),
                Margin = new Thickness(0, 0, 0, 15)
            };

            var sectionPanel = new System.Windows.Controls.StackPanel();

            var titleBlock = new System.Windows.Controls.TextBlock
            {
                Text = "💰 Profit Distribution Chart",
                FontSize = 16,
                FontWeight = FontWeights.Bold,
                Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)),
                Margin = new Thickness(0, 0, 0, 10)
            };
            sectionPanel.Children.Add(titleBlock);

            var canvas = new System.Windows.Controls.Canvas
            {
                Width = 1000,
                Height = 200,
                Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(15, 23, 42))
            };

            var profits = betsPlaced.Select(b => b.Profit).ToList();
            var ranges = new[] { (-1000, -100), (-100, -10), (-10, 0), (0, 10), (10, 100), (100, 1000) };

            var rangeCounts = new List<int>();
            foreach (var (min, max) in ranges)
            {
                var count = profits.Count(p => p > min && p <= max);
                rangeCounts.Add(count);
            }

            var maxCount = rangeCounts.Max();
            var width = 950;
            var height = 150;
            var stepX = width / (double)(ranges.Length - 1);

            var polyline = new System.Windows.Shapes.Polyline
            {
                Stroke = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 185, 129)),
                StrokeThickness = 3,
                Fill = System.Windows.Media.Brushes.Transparent
            };

            for (int i = 0; i < ranges.Length; i++)
            {
                var x = i * stepX + 25;
                var y = height - (rangeCounts[i] / (double)maxCount * height) + 25;
                polyline.Points.Add(new System.Windows.Point(x, y));

                var label = new System.Windows.Controls.TextBlock
                {
                    Text = $"${ranges[i].Item1}\nto\n${ranges[i].Item2}",
                    Foreground = System.Windows.Media.Brushes.White,
                    FontSize = 9,
                    TextAlignment = TextAlignment.Center
                };
                System.Windows.Controls.Canvas.SetLeft(label, x - 20);
                System.Windows.Controls.Canvas.SetTop(label, height + 30);
                canvas.Children.Add(label);

                var countLabel = new System.Windows.Controls.TextBlock
                {
                    Text = rangeCounts[i].ToString(),
                    Foreground = System.Windows.Media.Brushes.White,
                    FontSize = 10,
                    FontWeight = FontWeights.Bold
                };
                System.Windows.Controls.Canvas.SetLeft(countLabel, x - 10);
                System.Windows.Controls.Canvas.SetTop(countLabel, y - 20);
                canvas.Children.Add(countLabel);
            }

            canvas.Children.Add(polyline);

            sectionPanel.Children.Add(canvas);
            sectionBorder.Child = sectionPanel;
            parent.Children.Add(sectionBorder);
        }

        private void CreateCrashPatternsHeatmap(System.Windows.Controls.StackPanel parent)
        {
            if (!crashes.Any()) return;

            var sectionBorder = new System.Windows.Controls.Border
            {
                Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(30, 41, 59)),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(15),
                Margin = new Thickness(0, 0, 0, 15)
            };

            var sectionPanel = new System.Windows.Controls.StackPanel();

            var titleBlock = new System.Windows.Controls.TextBlock
            {
                Text = "🔥 Crash Patterns Heatmap",
                FontSize = 16,
                FontWeight = FontWeights.Bold,
                Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(249, 115, 22)),
                Margin = new Thickness(0, 0, 0, 10)
            };
            sectionPanel.Children.Add(titleBlock);

            var canvas = new System.Windows.Controls.Canvas
            {
                Width = 800,
                Height = 200,
                Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(15, 23, 42))
            };

            var crashRanges = new[] 
            {
                (1.0, 1.2, "1.0-1.2x"),
                (1.2, 1.5, "1.2-1.5x"),
                (1.5, 2.0, "1.5-2.0x"),
                (2.0, 3.0, "2.0-3.0x"),
                (3.0, 5.0, "3.0-5.0x"),
                (5.0, 10.0, "5.0-10x"),
                (10.0, 20.0, "10-20x"),
                (20.0, 50.0, "20-50x"),
                (50.0, 100.0, "50-100x"),
                (100.0, double.MaxValue, "100x+")
            };

            var crashCounts = new Dictionary<int, int>();
            var maxCount = 0;
            
            for (int i = 0; i < crashRanges.Length; i++)
            {
                var (min, max, _) = crashRanges[i];
                var count = crashes.Count(c => c >= min && c < max);
                crashCounts[i] = count;
                maxCount = Math.Max(maxCount, count);
            }

            var cellWidth = 75;
            var cellHeight = 80;
            var cols = 5;
            var rows = 2;

            for (int i = 0; i < Math.Min(crashRanges.Length, cols * rows); i++)
            {
                var row = i / cols;
                var col = i % cols;
                var count = crashCounts[i];
                var intensity = maxCount > 0 ? (double)count / maxCount : 0;
                
                var color = intensity > 0.7 ? 
                    System.Windows.Media.Color.FromRgb((byte)(220 + intensity * 35), (byte)(38), (byte)(38)) :
                    intensity > 0.4 ?
                    System.Windows.Media.Color.FromRgb((byte)(251), (byte)(146), (byte)(60)) :
                    System.Windows.Media.Color.FromRgb((byte)(34), (byte)(197), (byte)(94));

                var rect = new System.Windows.Shapes.Rectangle
                {
                    Width = cellWidth,
                    Height = cellHeight,
                    Fill = new System.Windows.Media.SolidColorBrush(color),
                    Stroke = System.Windows.Media.Brushes.Gray,
                    StrokeThickness = 1
                };
                System.Windows.Controls.Canvas.SetLeft(rect, col * (cellWidth + 5) + 20);
                System.Windows.Controls.Canvas.SetTop(rect, row * (cellHeight + 10) + 20);
                canvas.Children.Add(rect);

                var rangeLabel = new System.Windows.Controls.TextBlock
                {
                    Text = crashRanges[i].Item3,
                    Foreground = System.Windows.Media.Brushes.White,
                    FontSize = 10,
                    FontWeight = FontWeights.Bold,
                    TextAlignment = TextAlignment.Center
                };
                System.Windows.Controls.Canvas.SetLeft(rangeLabel, col * (cellWidth + 5) + 25);
                System.Windows.Controls.Canvas.SetTop(rangeLabel, row * (cellHeight + 10) + 30);
                canvas.Children.Add(rangeLabel);

                var countLabel = new System.Windows.Controls.TextBlock
                {
                    Text = count.ToString(),
                    Foreground = System.Windows.Media.Brushes.White,
                    FontSize = 14,
                    FontWeight = FontWeights.Bold,
                    TextAlignment = TextAlignment.Center
                };
                System.Windows.Controls.Canvas.SetLeft(countLabel, col * (cellWidth + 5) + 45);
                System.Windows.Controls.Canvas.SetTop(rangeLabel, row * (cellHeight + 10) + 50);
                canvas.Children.Add(countLabel);

                var percentage = crashes.Count > 0 ? (count * 100.0 / crashes.Count) : 0;
                var percentLabel = new System.Windows.Controls.TextBlock
                {
                    Text = $"{percentage:F1}%",
                    Foreground = System.Windows.Media.Brushes.LightGray,
                    FontSize = 9,
                    TextAlignment = TextAlignment.Center
                };
                System.Windows.Controls.Canvas.SetLeft(percentLabel, col * (cellWidth + 5) + 40);
                System.Windows.Controls.Canvas.SetTop(percentLabel, row * (cellHeight + 10) + 70);
                canvas.Children.Add(percentLabel);
            }

            sectionPanel.Children.Add(canvas);
            sectionBorder.Child = sectionPanel;
            parent.Children.Add(sectionBorder);
        }

        private void CreateCrashLineChart(System.Windows.Controls.StackPanel parent)
        {
            if (!betResults.Any()) return;

            var sectionBorder = new System.Windows.Controls.Border
            {
                Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(30, 41, 59)),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(15),
                Margin = new Thickness(0, 0, 0, 15)
            };

            var sectionPanel = new System.Windows.Controls.StackPanel();

            var titleBlock = new System.Windows.Controls.TextBlock
            {
                Text = "📈 All Crashes Line Chart",
                FontSize = 16,
                FontWeight = FontWeights.Bold,
                Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(59, 130, 246)),
                Margin = new Thickness(0, 0, 0, 10)
            };
            sectionPanel.Children.Add(titleBlock);

            var canvas = new System.Windows.Controls.Canvas
            {
                Width = 1000,
                Height = 200,
                Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(15, 23, 42))
            };

            var crashes = betResults.Select(r => r.CrashValue).ToList();
            var maxCrash = crashes.Max();
            var minCrash = crashes.Min();
            var range = maxCrash - minCrash;
            var width = 980;
            var height = 160;
            var stepX = width / (double)(crashes.Count - 1);

            var polyline = new System.Windows.Shapes.Polyline
            {
                Stroke = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(34, 197, 94)),
                StrokeThickness = 2,
                Fill = System.Windows.Media.Brushes.Transparent
            };

            for (int i = 0; i < crashes.Count; i++)
            {
                var x = i * stepX + 10;
                var y = height - ((crashes[i] - minCrash) / range * height) + 20;
                polyline.Points.Add(new System.Windows.Point(x, y));
            }

            canvas.Children.Add(polyline);

            var maxLabel = new System.Windows.Controls.TextBlock
            {
                Text = $"Max: {maxCrash:F2}x",
                Foreground = System.Windows.Media.Brushes.White,
                FontSize = 10
            };
            System.Windows.Controls.Canvas.SetLeft(maxLabel, 10);
            System.Windows.Controls.Canvas.SetTop(maxLabel, 5);
            canvas.Children.Add(maxLabel);

            var minLabel = new System.Windows.Controls.TextBlock
            {
                Text = $"Min: {minCrash:F2}x",
                Foreground = System.Windows.Media.Brushes.White,
                FontSize = 10
            };
            System.Windows.Controls.Canvas.SetLeft(minLabel, 10);
            System.Windows.Controls.Canvas.SetTop(minLabel, height + 5);
            canvas.Children.Add(minLabel);

            sectionPanel.Children.Add(canvas);
            sectionBorder.Child = sectionPanel;
            parent.Children.Add(sectionBorder);
        }



        private string GetConfigValue(Dictionary<string, System.Text.Json.JsonElement> config, string key)
        {
            if (!config.ContainsKey(key)) return "0";
            
            var element = config[key];
            return element.ValueKind == System.Text.Json.JsonValueKind.String 
                ? element.GetString() ?? "0"
                : element.ToString();
        }

        private void CreateAnalysisSection(System.Windows.Controls.StackPanel parent, string title, List<string> data, string colorHex)
        {
            var sectionBorder = new System.Windows.Controls.Border
            {
                Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(30, 41, 59)),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(15),
                Margin = new Thickness(0, 0, 0, 15)
            };

            var sectionPanel = new System.Windows.Controls.StackPanel();

            var titleBlock = new System.Windows.Controls.TextBlock
            {
                Text = title,
                FontSize = 16,
                FontWeight = FontWeights.Bold,
                Foreground = new System.Windows.Media.SolidColorBrush((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString(colorHex)),
                Margin = new Thickness(0, 0, 0, 10)
            };
            sectionPanel.Children.Add(titleBlock);

            foreach (var item in data.Skip(1))
            {
                var itemBlock = new System.Windows.Controls.TextBlock
                {
                    Text = item,
                    FontSize = 12,
                    Foreground = System.Windows.Media.Brushes.White,
                    Margin = new Thickness(0, 2, 0, 2),
                    TextWrapping = TextWrapping.Wrap
                };
                
                if (item.Contains("$") || item.Contains("%") || item.Contains("times"))
                {
                    itemBlock.FontWeight = FontWeights.SemiBold;
                }
                
                sectionPanel.Children.Add(itemBlock);
            }

            sectionBorder.Child = sectionPanel;
            parent.Children.Add(sectionBorder);
        }
    }

    public class DeepAnalysisResult
    {
        public List<string> ProfitDistribution { get; set; } = new List<string>();
        public List<string> TimeAnalysis { get; set; } = new List<string>();
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
