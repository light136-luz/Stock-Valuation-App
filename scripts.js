let isFetching = false;
let metricDetails = {};
let historicalData = {};

function calculateGrowthRate(current, previous) {
    if (!current || !previous || previous === 0) return 'N/A';
    return (((current - previous) / previous) * 100).toFixed(2) + '%';
}

function calculateAvgGrowth(data, years, field) {
    if (data.length < years + 1) return 'N/A';
    let totalGrowth = 0;
    let details = [];
    for (let i = 0; i < years; i++) {
        const current = parseFloat(data[i][field]) || 0;
        const previous = parseFloat(data[i + 1][field]) || 0;
        if (previous === 0) return 'N/A';
        const growth = (current - previous) / previous;
        totalGrowth += growth;
        details.push(`${data[i].fiscalDateEnding}: ${(growth * 100).toFixed(2)}%`);
    }
    const avg = ((totalGrowth / years) * 100).toFixed(2) + '%';
    return { value: avg, details: details.join('<br>') };
}

function calculateMarginChange(currentMargin, pastMargin, yearsBack) {
    if (!currentMargin || !pastMargin) return 'N/A';
    const change = (currentMargin - pastMargin).toFixed(2);
    return `${change}% (${yearsBack}-Yr Change)`;
}

function calculateRSI(prices) {
    if (prices.length < 15) return 'N/A';
    let gains = 0, losses = 0;
    for (let i = 1; i < 14; i++) {
        const diff = prices[i] - prices[i + 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgGain / (avgLoss || 1);
    return (100 - (100 / (1 + rs))).toFixed(2);
}

function calculateMFI(highs, lows, closes, volumes) {
    if (highs.length < 15) return 'N/A';
    let positiveMF = 0, negativeMF = 0;
    for (let i = 0; i < 14; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        const prevTypicalPrice = (highs[i + 1] + lows[i + 1] + closes[i + 1]) / 3;
        const moneyFlow = typicalPrice * volumes[i];
        if (typicalPrice > prevTypicalPrice) positiveMF += moneyFlow;
        else if (typicalPrice < prevTypicalPrice) negativeMF += moneyFlow;
    }
    const mfr = positiveMF / (negativeMF || 1);
    return (100 - (100 / (1 + mfr))).toFixed(2);
}

function calculateBollingerPercent(prices, period) {
    if (prices.length < period) return 'N/A';
    const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const variance = prices.slice(0, period).reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    const upperBand = sma + 2 * stdDev;
    const lowerBand = sma - 2 * stdDev;
    const currentPrice = prices[0];
    return (((currentPrice - lowerBand) / (upperBand - lowerBand)) * 100).toFixed(2) + '%';
}

function calculateSMA(prices, period) {
    if (prices.length < period) return 0;
    return prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
}

function showDetails(symbol, metricId) {
    const details = metricDetails[symbol]?.[metricId] || 'No details available.';
    document.getElementById('metricModalLabel').innerText = `${symbol} - ${document.getElementById(`${symbol}_${metricId}`).innerText.split(':')[0]} Details`;
    document.getElementById('metricDetails').innerHTML = details;
    $('#metricModal').modal('show');
}

function openChartWindow(symbol, metricId) {
    const metricName = document.getElementById(`${symbol}_${metricId}`).innerText.split(':')[0];
    const chartWindow = window.open('', '_blank', 'width=800,height=600');
    const chartJsScript = `
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    `;
    chartWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${symbol} - ${metricName} Chart</title>
            <style>
                body { font-family: Arial, sans-serif; background-color: #1a1a1a; color: #fff; padding: 20px; }
                .chart-container { background: rgba(0, 0, 0, 0.7); padding: 20px; border-radius: 10px; }
                select { margin-bottom: 20px; padding: 5px; }
            </style>
        </head>
        <body>
            <h2>${symbol} - ${metricName} Chart</h2>
            <select id="chartType" onchange="updateChart('${symbol}', '${metricId}', this.value)">
                <option value="yearly">Yearly (Last 5 Years)</option>
                <option value="quarterly">Quarterly (Last 5 Years)</option>
            </select>
            <div class="chart-container">
                <canvas id="metricChart"></canvas>
            </div>
            ${chartJsScript}
            <script>
                let chart;
                function updateChart(symbol, metricId, type) {
                    const data = window.opener.getChartData(symbol, metricId, type);
                    console.log('Chart Data:', data); // Debug log
                    if (!data || data.labels.length === 0 || data.values.length === 0) {
                        document.body.innerHTML += '<p>No data available for this metric.</p>';
                        return;
                    }
                    const ctx = document.getElementById('metricChart').getContext('2d');
                    if (chart) chart.destroy();
                    chart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: data.labels,
                            datasets: [{
                                label: metricName,
                                data: data.values,
                                borderColor: '#ff8c00',
                                fill: false
                            }]
                        },
                        options: {
                            scales: {
                                x: { title: { display: true, text: 'Date', color: '#fff' }, ticks: { color: '#fff' } },
                                y: { title: { display: true, text: metricName, color: '#fff' }, ticks: { color: '#fff' } }
                            },
                            plugins: {
                                legend: { labels: { color: '#fff' } }
                            }
                        }
                    });
                }
                updateChart('${symbol}', '${metricId}', 'yearly');
            </script>
        </body>
        </html>
    `);
}

function getChartData(symbol, metricId, type) {
    const data = historicalData[symbol] || {};
    let labels = [];
    let values = [];

    if (['current_price', 'rsi', 'mfi', 'price_vs_52wk_high', 'price_vs_52wk_low', 'bollinger_percent_20', 'bollinger_percent_50', 'price_vs_50day_avg', 'price_vs_200day_avg'].includes(metricId)) {
        const dailyData = data.daily || {};
        const dates = Object.keys(dailyData).sort().reverse().slice(0, 1260); // Approx 5 years of trading days
        const closes = dates.map(date => parseFloat(dailyData[date]['4. close']) || 0);
        const highs = dates.map(date => parseFloat(dailyData[date]['2. high']) || 0);
        const lows = dates.map(date => parseFloat(dailyData[date]['3. low']) || 0);
        const volumes = dates.map(date => parseFloat(dailyData[date]['5. volume']) || 0);

        if (metricId === 'current_price') {
            values = closes;
            labels = dates;
        } else if (metricId === 'rsi') {
            for (let i = 0; i < closes.length - 14; i++) {
                values.push(calculateRSI(closes.slice(i, i + 15)));
                labels.push(dates[i]);
            }
        } else if (metricId === 'mfi') {
            for (let i = 0; i < closes.length - 14; i++) {
                values.push(calculateMFI(highs.slice(i, i + 15), lows.slice(i, i + 15), closes.slice(i, i + 15), volumes.slice(i, i + 15)));
                labels.push(dates[i]);
            }
        } else if (metricId === 'price_vs_52wk_high') {
            for (let i = 0; i < closes.length - 252; i++) {
                const yearHigh = Math.max(...closes.slice(i, i + 252));
                values.push(((closes[i] / yearHigh) * 100 - 100).toFixed(2));
                labels.push(dates[i]);
            }
        } else if (metricId === 'price_vs_52wk_low') {
            for (let i = 0; i < closes.length - 252; i++) {
                const yearLow = Math.min(...closes.slice(i, i + 252));
                values.push(((closes[i] / yearLow) * 100 - 100).toFixed(2));
                labels.push(dates[i]);
            }
        } else if (metricId === 'bollinger_percent_20') {
            for (let i = 0; i < closes.length - 20; i++) {
                values.push(calculateBollingerPercent(closes.slice(i, i + 20), 20).replace('%', ''));
                labels.push(dates[i]);
            }
        } else if (metricId === 'bollinger_percent_50') {
            for (let i = 0; i < closes.length - 50; i++) {
                values.push(calculateBollingerPercent(closes.slice(i, i + 50), 50).replace('%', ''));
                labels.push(dates[i]);
            }
        } else if (metricId === 'price_vs_50day_avg') {
            for (let i = 0; i < closes.length - 50; i++) {
                const sma50 = calculateSMA(closes.slice(i, i + 50), 50);
                values.push(((closes[i] / sma50) * 100 - 100).toFixed(2));
                labels.push(dates[i]);
            }
        } else if (metricId === 'price_vs_200day_avg') {
            for (let i = 0; i < closes.length - 200; i++) {
                const sma200 = calculateSMA(closes.slice(i, i + 200), 200);
                values.push(((closes[i] / sma200) * 100 - 100).toFixed(2));
                labels.push(dates[i]);
            }
        }
    } else {
        const incomeReports = data.income || [];
        const balanceReports = data.balance || [];
        const overview = data.overview || {};
        const marketCap = parseFloat(overview.MarketCapitalization) || 0;

        const epsData = incomeReports.map((income, i) => {
            const matchingBalance = balanceReports.find(b => b.fiscalDateEnding === income.fiscalDateEnding) || {};
            const netIncome = parseFloat(income.netIncome) || 0;
            const shares = parseFloat(matchingBalance.commonStockSharesOutstanding) || parseFloat(overview.SharesOutstanding) || 0;
            return shares ? { eps: netIncome / shares, fiscalDateEnding: income.fiscalDateEnding } : { eps: 0, fiscalDateEnding: income.fiscalDateEnding };
        });

        const sales = incomeReports.map(r => parseFloat(r.totalRevenue) || 0);
        const ebitda = incomeReports.map(r => parseFloat(r.ebitda) || (parseFloat(r.operatingIncome) + parseFloat(r.depreciationAndAmortization)) || 0);
        const grossProfit = incomeReports.map(r => parseFloat(r.grossProfit) || 0);
        const operatingIncome = incomeReports.map(r => parseFloat(r.operatingIncome) || 0);
        const netIncome = incomeReports.map(r => parseFloat(r.netIncome) || 0);
        const revenue = incomeReports.map(r => parseFloat(r.totalRevenue) || 0);
        const grossMargins = revenue.map((rev, i) => rev ? (grossProfit[i] / rev * 100) : 0);
        const operatingMargins = revenue.map((rev, i) => rev ? (operatingIncome[i] / rev * 100) : 0);
        const netMargins = revenue.map((rev, i) => rev ? (netIncome[i] / rev * 100) : 0);

        const reports = type === 'yearly' ? incomeReports.slice(0, 5) : data.incomeQuarterly.slice(0, 20);
        labels = reports.map(r => r.fiscalDateEnding);
        if (metricId === 'market_cap') {
            values = reports.map(() => (marketCap / 1e9).toFixed(2));
        } else if (metricId === 'pe_ttm') {
            values = reports.map(r => overview.TrailingPE || 'N/A');
        } else if (metricId === 'pe_forward') {
            values = reports.map(r => overview.ForwardPE || 'N/A');
        } else if (metricId === 'price_to_sales') {
            values = reports.map(r => overview.PriceToSalesRatioTTM || 'N/A');
        } else if (metricId === 'price_to_book') {
            values = reports.map(r => overview.PriceToBookRatio || 'N/A');
        } else if (metricId === 'ev_ebitda') {
            values = reports.map(r => overview.EVToEBITDA || 'N/A');
        } else if (metricId === 'price_to_fcf') {
            const fcf = parseFloat(data.cashFlow?.[0]?.operatingCashflow) || 0;
            values = reports.map(() => fcf ? (marketCap / fcf).toFixed(2) : 'N/A');
        } else if (metricId === 'ev_fcf') {
            const fcf = parseFloat(data.cashFlow?.[0]?.operatingCashflow) || 0;
            const latestBalance = balanceReports[0] || {};
            const longTermDebt = parseFloat(latestBalance.longTermDebt) || 0;
            const shortTermDebt = parseFloat(latestBalance.shortLongTermDebtTotal) || 0;
            const cash = parseFloat(latestBalance.cashAndCashEquivalentsAtCarryingValue) || 0;
            const totalDebt = longTermDebt + shortTermDebt;
            const ev = marketCap + totalDebt - cash;
            values = reports.map(() => fcf ? (ev / fcf).toFixed(2) : 'N/A');
        } else if (metricId === 'sales_growth_1yr' || metricId === 'sales_growth_3yr' || metricId === 'sales_growth_5yr') {
            for (let i = 0; i < reports.length - 1; i++) {
                const current = parseFloat(reports[i].totalRevenue) || 0;
                const previous = parseFloat(reports[i + 1].totalRevenue) || 0;
                values.push(calculateGrowthRate(current, previous).replace('%', ''));
            }
            labels = labels.slice(0, -1);
        } else if (metricId === 'eps_growth_1yr' || metricId === 'eps_growth_3yr' || metricId === 'eps_growth_5yr') {
            const epsReports = type === 'yearly' ? epsData.slice(0, 5) : data.incomeQuarterly.map((income, i) => {
                const matchingBalance = balanceReports.find(b => b.fiscalDateEnding === income.fiscalDateEnding) || {};
                const netIncome = parseFloat(income.netIncome) || 0;
                const shares = parseFloat(matchingBalance.commonStockSharesOutstanding) || parseFloat(overview.SharesOutstanding) || 0;
                return shares ? { eps: netIncome / shares, fiscalDateEnding: income.fiscalDateEnding } : { eps: 0, fiscalDateEnding: income.fiscalDateEnding };
            }).slice(0, 20);
            for (let i = 0; i < epsReports.length - 1; i++) {
                values.push(calculateGrowthRate(epsReports[i].eps, epsReports[i + 1].eps).replace('%', ''));
            }
            labels = labels.slice(0, -1);
        } else if (metricId === 'ebitda_growth_1yr' || metricId === 'ebitda_growth_3yr' || metricId === 'ebitda_growth_5yr') {
            const ebitdaReports = reports.map(r => parseFloat(r.ebitda) || (parseFloat(r.operatingIncome) + parseFloat(r.depreciationAndAmortization)) || 0);
            for (let i = 0; i < ebitdaReports.length - 1; i++) {
                values.push(calculateGrowthRate(ebitdaReports[i], ebitdaReports[i + 1]).replace('%', ''));
            }
            labels = labels.slice(0, -1);
        } else if (metricId === 'gross_margin' || metricId.includes('gross_margin_')) {
            values = reports.map((r, i) => {
                const rev = parseFloat(r.totalRevenue) || 0;
                const gp = parseFloat(r.grossProfit) || 0;
                return rev ? (gp / rev * 100).toFixed(2) : '0';
            });
        } else if (metricId === 'operating_margin' || metricId.includes('operating_margin_')) {
            values = reports.map((r, i) => {
                const rev = parseFloat(r.totalRevenue) || 0;
                const oi = parseFloat(r.operatingIncome) || 0;
                return rev ? (oi / rev * 100).toFixed(2) : '0';
            });
        } else if (metricId === 'net_margin' || metricId.includes('net_margin_')) {
            values = reports.map((r, i) => {
                const rev = parseFloat(r.totalRevenue) || 0;
                const ni = parseFloat(r.netIncome) || 0;
                return rev ? (ni / rev * 100).toFixed(2) : '0';
            });
        }
    }

    if (type === 'yearly' && !['current_price', 'rsi', 'mfi', 'price_vs_52wk_high', 'price_vs_52wk_low', 'bollinger_percent_20', 'bollinger_percent_50', 'price_vs_50day_avg', 'price_vs_200day_avg'].includes(metricId)) {
        labels = labels.slice(0, 5);
        values = values.slice(0, 5);
    } else if (type === 'quarterly' && !['current_price', 'rsi', 'mfi', 'price_vs_52wk_high', 'price_vs_52wk_low', 'bollinger_percent_20', 'bollinger_percent_50', 'price_vs_50day_avg', 'price_vs_200day_avg'].includes(metricId)) {
        labels = labels.slice(0, 20);
        values = values.slice(0, 20);
    }

    return { labels: labels.reverse(), values: values.reverse() };
}

function fetchData() {
    if (isFetching) {
        alert('Please wait a moment before fetching again.');
        return;
    }

    const symbol = document.getElementById('symbol').value.trim().toUpperCase();
    if (!symbol) {
        alert('Please enter a stock symbol!');
        return;
    }

    const apikey = 'EUIL8JU2T0UFCZRR';
    const fetchBtn = document.getElementById('fetchBtn');
    document.getElementById('loading').style.display = 'block';
    fetchBtn.disabled = true;
    isFetching = true;
    clearResults();

    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apikey}`;
    const cashFlowUrl = `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${symbol}&apikey=${apikey}`;
    const balanceSheetUrl = `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${symbol}&apikey=${apikey}`;
    const incomeStatementUrl = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${apikey}`;
    const dailyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apikey}`;
    const incomeStatementQuarterlyUrl = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${apikey}&interval=quarterly`;

    Promise.all([
        fetch(overviewUrl).then(res => res.json()),
        fetch(cashFlowUrl).then(res => res.json()),
        fetch(balanceSheetUrl).then(res => res.json()),
        fetch(incomeStatementUrl).then(res => res.json()),
        fetch(dailyUrl).then(res => res.json()),
        fetch(incomeStatementQuarterlyUrl).then(res => res.json())
    ])
    .then(([overviewData, cashFlowData, balanceSheetData, incomeStatementData, dailyData, incomeStatementQuarterlyData]) => {
        historicalData[symbol] = {
            overview: overviewData,
            cashFlow: cashFlowData.annualReports,
            balance: balanceSheetData.annualReports,
            income: incomeStatementData.annualReports,
            daily: dailyData['Time Series (Daily)'],
            incomeQuarterly: incomeStatementQuarterlyData.quarterlyReports || []
        };

        metricDetails[symbol] = {};

        // OVERVIEW
        if (overviewData.Information || overviewData.Note) throw new Error('API rate limit exceeded');
        if (Object.keys(overviewData).length === 0) throw new Error('No data returned');

        const currentPrice = parseFloat(dailyData['Time Series (Daily)']?.[Object.keys(dailyData['Time Series (Daily)'] || {})[0]]?.['4. close']) || 0;
        const marketCap = parseFloat(overviewData.MarketCapitalization) || 0;
        const peTTM = overviewData.TrailingPE || 'N/A';
        const peForward = overviewData.ForwardPE || 'N/A';
        const priceToSales = overviewData.PriceToSalesRatioTTM || 'N/A';
        const priceToBook = overviewData.PriceToBookRatio || 'N/A';
        const evEbitda = overviewData.EVToEBITDA || 'N/A';
        const latestBalance = balanceSheetData.annualReports?.[0] || {};
        const longTermDebt = parseFloat(latestBalance.longTermDebt) || 0;
        const shortTermDebt = parseFloat(latestBalance.shortLongTermDebtTotal) || 0;
        const cash = parseFloat(latestBalance.cashAndCashEquivalentsAtCarryingValue) || 0;
        const totalDebt = longTermDebt + shortTermDebt;
        const ev = marketCap + totalDebt - cash;

        let priceToFCF = 'N/A';
        let evFCF = 'N/A';
        if (cashFlowData.annualReports && cashFlowData.annualReports.length > 0) {
            const fcfRaw = cashFlowData.annualReports[0].operatingCashflow || '0';
            const fcf = parseFloat(fcfRaw) || 0;
            if (fcf && marketCap) priceToFCF = (marketCap / fcf).toFixed(2);
            if (fcf && ev) evFCF = (ev / fcf).toFixed(2);
        }

        const incomeReports = incomeStatementData.annualReports || [];
        const balanceReports = balanceSheetData.annualReports || [];
        const epsData = incomeReports.map((income, i) => {
            const matchingBalance = balanceReports.find(b => b.fiscalDateEnding === income.fiscalDateEnding) || {};
            const netIncome = parseFloat(income.netIncome) || 0;
            const shares = parseFloat(matchingBalance.commonStockSharesOutstanding) || parseFloat(overviewData.SharesOutstanding) || 0;
            return shares ? { eps: netIncome / shares, fiscalDateEnding: income.fiscalDateEnding } : { eps: 0, fiscalDateEnding: income.fiscalDateEnding };
        });

        const sales = incomeReports.map(r => parseFloat(r.totalRevenue) || 0);
        const ebitda = incomeReports.map(r => parseFloat(r.ebitda) || (parseFloat(r.operatingIncome) + parseFloat(r.depreciationAndAmortization)) || 0);

        const sales1Yr = calculateGrowthRate(sales[0], sales[1]);
        const sales3Yr = calculateAvgGrowth(incomeReports, 3, 'totalRevenue');
        const sales5Yr = calculateAvgGrowth(incomeReports, 5, 'totalRevenue');
        const eps1Yr = calculateGrowthRate(epsData[0].eps, epsData[1].eps);
        const eps3Yr = calculateAvgGrowth(epsData, 3, 'eps');
        const eps5Yr = calculateAvgGrowth(epsData, 5, 'eps');
        const ebitda1Yr = calculateGrowthRate(ebitda[0], ebitda[1]);
        const ebitda3Yr = calculateAvgGrowth(incomeReports, 3, 'ebitda');
        const ebitda5Yr = calculateAvgGrowth(incomeReports, 5, 'ebitda');

        const grossProfit = incomeReports.map(r => parseFloat(r.grossProfit) || 0);
        const operatingIncome = incomeReports.map(r => parseFloat(r.operatingIncome) || 0);
        const netIncome = incomeReports.map(r => parseFloat(r.netIncome) || 0);
        const revenue = incomeReports.map(r => parseFloat(r.totalRevenue) || 0);
        const grossMargins = revenue.map((rev, i) => rev ? (grossProfit[i] / rev * 100) : 0);
        const operatingMargins = revenue.map((rev, i) => rev ? (operatingIncome[i] / rev * 100) : 0);
        const netMargins = revenue.map((rev, i) => rev ? (netIncome[i] / rev * 100) : 0);

        const grossMargin = grossMargins[0] ? grossMargins[0].toFixed(2) + '%' : 'N/A';
        const grossMargin1Yr = calculateMarginChange(grossMargins[0], grossMargins[1], 1);
        const grossMargin3Yr = calculateMarginChange(grossMargins[0], grossMargins[2], 3);
        const grossMargin5Yr = calculateMarginChange(grossMargins[0], grossMargins[4], 5);
        const operatingMargin = operatingMargins[0] ? operatingMargins[0].toFixed(2) + '%' : 'N/A';
        const operatingMargin1Yr = calculateMarginChange(operatingMargins[0], operatingMargins[1], 1);
        const operatingMargin3Yr = calculateMarginChange(operatingMargins[0], operatingMargins[2], 3);
        const operatingMargin5Yr = calculateMarginChange(operatingMargins[0], operatingMargins[4], 5);
        const netMargin = netMargins[0] ? netMargins[0].toFixed(2) + '%' : 'N/A';
        const netMargin1Yr = calculateMarginChange(netMargins[0], netMargins[1], 1);
        const netMargin3Yr = calculateMarginChange(netMargins[0], netMargins[2], 3);
        const netMargin5Yr = calculateMarginChange(netMargins[0], netMargins[4], 5);

        const timeSeries = dailyData['Time Series (Daily)'] || {};
        const dates = Object.keys(timeSeries).sort().reverse();
        const closes = dates.map(date => parseFloat(timeSeries[date]['4. close']) || 0);
        const highs = dates.map(date => parseFloat(timeSeries[date]['2. high']) || 0);
        const lows = dates.map(date => parseFloat(timeSeries[date]['3. low']) || 0);
        const volumes = dates.map(date => parseFloat(timeSeries[date]['5. volume']) || 0);

        const currentPriceFinal = closes[0] || 0;
        const rsi = calculateRSI(closes);
        const mfi = calculateMFI(highs, lows, closes, volumes);
        const yearHigh = closes.length > 252 ? Math.max(...closes.slice(0, 252)) : 0;
        const yearLow = closes.length > 252 ? Math.min(...closes.slice(0, 252)) : 0;
        const priceVs52WkHigh = yearHigh ? ((currentPriceFinal / yearHigh) * 100 - 100).toFixed(2) + '%' : 'N/A';
        const priceVs52WkLow = yearLow ? ((currentPriceFinal / yearLow) * 100 - 100).toFixed(2) + '%' : 'N/A';
        const bollinger20 = calculateBollingerPercent(closes, 20);
        const bollinger50 = calculateBollingerPercent(closes, 50);
        const sma50 = calculateSMA(closes, 50);
        const sma200 = calculateSMA(closes, 200);
        const priceVs50DayAvg = sma50 ? ((currentPriceFinal / sma50) * 100 - 100).toFixed(2) + '%' : 'N/A';
        const priceVs200DayAvg = sma200 ? ((currentPriceFinal / sma200) * 100 - 100).toFixed(2) + '%' : 'N/A';

        metricDetails[symbol]['current_price'] = `Current Price: $${currentPriceFinal.toFixed(2)}`;
        metricDetails[symbol]['market_cap'] = `Market Cap: $${(marketCap / 1e9).toFixed(2)}B`;
        metricDetails[symbol]['pe_ttm'] = `TTM PE: ${peTTM}`;
        metricDetails[symbol]['pe_forward'] = `Forward PE: ${peForward}`;
        metricDetails[symbol]['price_to_sales'] = `TTM P/S Ratio: ${priceToSales}`;
        metricDetails[symbol]['price_to_book'] = `Price to Book: ${priceToBook}`;
        metricDetails[symbol]['ev_ebitda'] = `EV / EBITDA: ${evEbitda}`;
        metricDetails[symbol]['price_to_fcf'] = `Price to FCF: ${priceToFCF}`;
        metricDetails[symbol]['ev_fcf'] = `EV / FCF: ${evFCF}`;
        metricDetails[symbol]['sales_growth_1yr'] = `TTM Rev Growth: ${sales1Yr}`;
        metricDetails[symbol]['sales_growth_3yr'] = `3-Yr Rev Growth: ${sales3Yr.value}`;
        metricDetails[symbol]['sales_growth_5yr'] = `5-Yr Rev Growth: ${sales5Yr.value}`;
        metricDetails[symbol]['eps_growth_1yr'] = `Current Yr Exp EPS Growth: ${eps1Yr}`;
        metricDetails[symbol]['eps_growth_3yr'] = `3-Yr EPS Growth: ${eps3Yr.value}`;
        metricDetails[symbol]['eps_growth_5yr'] = `5-Yr EPS Growth: ${eps5Yr.value}`;
        metricDetails[symbol]['ebitda_growth_1yr'] = `Next Yr Exp Rev Growth: ${ebitda1Yr}`;
        metricDetails[symbol]['ebitda_growth_3yr'] = `3-Yr EBITDA Growth: ${ebitda3Yr.value}`;
        metricDetails[symbol]['ebitda_growth_5yr'] = `5-Yr EBITDA Growth: ${ebitda5Yr.value}`;
        metricDetails[symbol]['gross_margin'] = `Gross Margin: ${grossMargin}`;
        metricDetails[symbol]['gross_margin_1yr_change'] = `Gross Margin 1-Yr Change: ${grossMargin1Yr}`;
        metricDetails[symbol]['gross_margin_3yr_change'] = `Gross Margin 3-Yr Change: ${grossMargin3Yr}`;
        metricDetails[symbol]['gross_margin_5yr_change'] = `Gross Margin 5-Yr Change: ${grossMargin5Yr}`;
        metricDetails[symbol]['operating_margin'] = `Operating Margin: ${operatingMargin}`;
        metricDetails[symbol]['operating_margin_1yr_change'] = `Operating Margin 1-Yr Change: ${operatingMargin1Yr}`;
        metricDetails[symbol]['operating_margin_3yr_change'] = `Operating Margin 3-Yr Change: ${operatingMargin3Yr}`;
        metricDetails[symbol]['operating_margin_5yr_change'] = `Operating Margin 5-Yr Change: ${operatingMargin5Yr}`;
        metricDetails[symbol]['net_margin'] = `Net Margin: ${netMargin}`;
        metricDetails[symbol]['net_margin_1yr_change'] = `Net Margin 1-Yr Change: ${netMargin1Yr}`;
        metricDetails[symbol]['net_margin_3yr_change'] = `Net Margin 3-Yr Change: ${netMargin3Yr}`;
        metricDetails[symbol]['net_margin_5yr_change'] = `Net Margin 5-Yr Change: ${netMargin5Yr}`;
        metricDetails[symbol]['rsi'] = `RSI: ${rsi}`;
        metricDetails[symbol]['mfi'] = `MFI: ${mfi}`;
        metricDetails[symbol]['price_vs_52wk_high'] = `Price vs 52-Wk High: ${priceVs52WkHigh}`;
        metricDetails[symbol]['price_vs_52wk_low'] = `Price vs 52-Wk Low: ${priceVs52WkLow}`;
        metricDetails[symbol]['bollinger_percent_20'] = `Bollinger Percent 20: ${bollinger20}`;
        metricDetails[symbol]['bollinger_percent_50'] = `Bollinger Percent 50: ${bollinger50}`;
        metricDetails[symbol]['price_vs_50day_avg'] = `Price vs 50-Day Avg: ${priceVs50DayAvg}`;
        metricDetails[symbol]['price_vs_200day_avg'] = `Price vs 200-Day Avg: ${priceVs200DayAvg}`;

        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `
            <div class="ticker-column">
                <h2 class="text-warning">${symbol}</h2>
                <div class="prominent-metric">
                    Stock Price: $${currentPriceFinal.toFixed(2)} | Market Cap: $${(marketCap / 1e9).toFixed(2)}B
                </div>
                <div class="metric-box"><span class="label metric" id="${symbol}_current_price" onclick="openChartWindow('${symbol}', 'current_price')">Current Price</span><span class="value">$${currentPriceFinal.toFixed(2)}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_market_cap" onclick="openChartWindow('${symbol}', 'market_cap')">Market Cap</span><span class="value">$${(marketCap / 1e9).toFixed(2)}B</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_pe_ttm" onclick="openChartWindow('${symbol}', 'pe_ttm')">TTM PE</span><span class="value">${peTTM}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_pe_forward" onclick="openChartWindow('${symbol}', 'pe_forward')">Forward PE</span><span class="value">${peForward}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_price_to_sales" onclick="openChartWindow('${symbol}', 'price_to_sales')">TTM P/S Ratio</span><span class="value">${priceToSales}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_price_to_book" onclick="openChartWindow('${symbol}', 'price_to_book')">Price to Book</span><span class="value">${priceToBook}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_ev_ebitda" onclick="openChartWindow('${symbol}', 'ev_ebitda')">EV / EBITDA</span><span class="value">${evEbitda}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_price_to_fcf" onclick="openChartWindow('${symbol}', 'price_to_fcf')">Price to FCF</span><span class="value">${priceToFCF}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_ev_fcf" onclick="openChartWindow('${symbol}', 'ev_fcf')">EV / FCF</span><span class="value">${evFCF}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_sales_growth_1yr" onclick="openChartWindow('${symbol}', 'sales_growth_1yr')">TTM Rev Growth</span><span class="value">${sales1Yr}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_sales_growth_3yr" onclick="openChartWindow('${symbol}', 'sales_growth_3yr')">3-Yr Rev Growth</span><span class="value">${sales3Yr.value}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_sales_growth_5yr" onclick="openChartWindow('${symbol}', 'sales_growth_5yr')">5-Yr Rev Growth</span><span class="value">${sales5Yr.value}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_eps_growth_1yr" onclick="openChartWindow('${symbol}', 'eps_growth_1yr')">Current Yr Exp EPS Growth</span><span class="value">${eps1Yr}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_eps_growth_3yr" onclick="openChartWindow('${symbol}', 'eps_growth_3yr')">3-Yr EPS Growth</span><span class="value">${eps3Yr.value}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_eps_growth_5yr" onclick="openChartWindow('${symbol}', 'eps_growth_5yr')">5-Yr EPS Growth</span><span class="value">${eps5Yr.value}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_ebitda_growth_1yr" onclick="openChartWindow('${symbol}', 'ebitda_growth_1yr')">Next Yr Exp Rev Growth</span><span class="value">${ebitda1Yr}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_ebitda_growth_3yr" onclick="openChartWindow('${symbol}', 'ebitda_growth_3yr')">3-Yr EBITDA Growth</span><span class="value">${ebitda3Yr.value}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_ebitda_growth_5yr" onclick="openChartWindow('${symbol}', 'ebitda_growth_5yr')">5-Yr EBITDA Growth</span><span class="value">${ebitda5Yr.value}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_gross_margin" onclick="openChartWindow('${symbol}', 'gross_margin')">Gross Margin</span><span class="value">${grossMargin}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_gross_margin_1yr_change" onclick="openChartWindow('${symbol}', 'gross_margin_1yr_change')">Gross Margin 1-Yr Change</span><span class="value">${grossMargin1Yr.split(' ')[0]}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_gross_margin_3yr_change" onclick="openChartWindow('${symbol}', 'gross_margin_3yr_change')">Gross Margin 3-Yr Change</span><span class="value">${grossMargin3Yr.split(' ')[0]}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_gross_margin_5yr_change" onclick="openChartWindow('${symbol}', 'gross_margin_5yr_change')">Gross Margin 5-Yr Change</span><span class="value">${grossMargin5Yr.split(' ')[0]}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_operating_margin" onclick="openChartWindow('${symbol}', 'operating_margin')">Operating Margin</span><span class="value">${operatingMargin}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_operating_margin_1yr_change" onclick="openChartWindow('${symbol}', 'operating_margin_1yr_change')">Operating Margin 1-Yr Change</span><span class="value">${operatingMargin1Yr.split(' ')[0]}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_operating_margin_3yr_change" onclick="openChartWindow('${symbol}', 'operating_margin_3yr_change')">Operating Margin 3-Yr Change</span><span class="value">${operatingMargin3Yr.split(' ')[0]}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_operating_margin_5yr_change" onclick="openChartWindow('${symbol}', 'operating_margin_5yr_change')">Operating Margin 5-Yr Change</span><span class="value">${operatingMargin5Yr.split(' ')[0]}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_net_margin" onclick="openChartWindow('${symbol}', 'net_margin')">Net Margin</span><span class="value">${netMargin}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_net_margin_1yr_change" onclick="openChartWindow('${symbol}', 'net_margin_1yr_change')">Net Margin 1-Yr Change</span><span class="value">${netMargin1Yr.split(' ')[0]}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_net_margin_3yr_change" onclick="openChartWindow('${symbol}', 'net_margin_3yr_change')">Net Margin 3-Yr Change</span><span class="value">${netMargin3Yr.split(' ')[0]}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_net_margin_5yr_change" onclick="openChartWindow('${symbol}', 'net_margin_5yr_change')">Net Margin 5-Yr Change</span><span class="value">${netMargin5Yr.split(' ')[0]}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_rsi" onclick="openChartWindow('${symbol}', 'rsi')">RSI</span><span class="value">${rsi}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_mfi" onclick="openChartWindow('${symbol}', 'mfi')">MFI</span><span class="value">${mfi}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_price_vs_52wk_high" onclick="openChartWindow('${symbol}', 'price_vs_52wk_high')">Price vs 52-Wk High</span><span class="value">${priceVs52WkHigh}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_price_vs_52wk_low" onclick="openChartWindow('${symbol}', 'price_vs_52wk_low')">Price vs 52-Wk Low</span><span class="value">${priceVs52WkLow}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_bollinger_percent_20" onclick="openChartWindow('${symbol}', 'bollinger_percent_20')">Bollinger Percent 20</span><span class="value">${bollinger20}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_bollinger_percent_50" onclick="openChartWindow('${symbol}', 'bollinger_percent_50')">Bollinger Percent 50</span><span class="value">${bollinger50}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_price_vs_50day_avg" onclick="openChartWindow('${symbol}', 'price_vs_50day_avg')">Price vs 50-Day Avg</span><span class="value">${priceVs50DayAvg}</span></div>
                <div class="metric-box"><span class="label metric" id="${symbol}_price_vs_200day_avg" onclick="openChartWindow('${symbol}', 'price_vs_200day_avg')">Price vs 200-Day Avg</span><span class="value">${priceVs200DayAvg}</span></div>
            </div>
        `;
    })
    .catch(error => {
        console.error('Error:', error.message);
        if (error.message.includes('rate limit')) {
            alert('API rate limit exceeded (25 requests/day). Wait until tomorrow or upgrade at alphavantage.co/premium.');
        } else {
            alert(`Error: ${error.message}. Check console for details.`);
        }
    })
    .finally(() => {
        document.getElementById('loading').style.display = 'none';
        fetchBtn.disabled = false;
        setTimeout(() => { isFetching = false; }, 15000);
    });
}

function clearResults() {
    document.getElementById('results').innerHTML = '';
    metricDetails = {};
    historicalData = {};
}

document.getElementById('fetchBtn').addEventListener('click', fetchData);
