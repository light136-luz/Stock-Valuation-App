let isFetching = false;

function calculateGrowthRate(current, previous) {
    if (!current || !previous || previous === 0) return 'N/A';
    return (((current - previous) / previous) * 100).toFixed(2) + '%';
}

function calculateAvgGrowth(data, years, field) {
    if (data.length < years + 1) return 'N/A';
    let totalGrowth = 0;
    for (let i = 0; i < years; i++) {
        const current = parseFloat(data[i][field]) || 0;
        const previous = parseFloat(data[i + 1][field]) || 0;
        if (previous === 0) return 'N/A';
        totalGrowth += (current - previous) / previous;
    }
    return ((totalGrowth / years) * 100).toFixed(2) + '%';
}

function calculateMarginChange(currentMargin, pastMargin) {
    if (!currentMargin || !pastMargin) return 'N/A';
    return (currentMargin - pastMargin).toFixed(2) + '%';
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

async function fetchTickerData(symbol, apikey) {
    const urls = [
        `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apikey}`,
        `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${symbol}&apikey=${apikey}`,
        `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${symbol}&apikey=${apikey}`,
        `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${apikey}`,
        `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apikey}`
    ];

    const responses = await Promise.all(urls.map(url => fetch(url).then(res => res.json())));
    const [overviewData, cashFlowData, balanceSheetData, incomeStatementData, dailyData] = responses;

    if (overviewData.Information || overviewData.Note) throw new Error(`API rate limit exceeded for ${symbol}`);
    if (Object.keys(overviewData).length === 0) throw new Error(`No data for ${symbol}`);

    // Valuation Metrics
    const metrics = {
        pe_ttm: overviewData.TrailingPE || 'N/A',
        pe_forward: overviewData.ForwardPE || 'N/A',
        price_to_sales: overviewData.PriceToSalesRatioTTM || 'N/A',
        price_to_book: overviewData.PriceToBookRatio || 'N/A',
        ev_ebitda: overviewData.EVToEBITDA || 'N/A'
    };
    const marketCap = parseFloat(overviewData.MarketCapitalization) || 0;

    // Balance Sheet & Cash Flow
    const latestBalance = balanceSheetData.annualReports?.[0] || {};
    const longTermDebt = parseFloat(latestBalance.longTermDebt) || 0;
    const shortTermDebt = parseFloat(latestBalance.shortLongTermDebtTotal) || 0;
    const cash = parseFloat(latestBalance.cashAndCashEquivalentsAtCarryingValue) || 0;
    const totalDebt = longTermDebt + shortTermDebt;
    const ev = marketCap + totalDebt - cash;

    const fcf = parseFloat(cashFlowData.annualReports?.[0]?.operatingCashflow) || 0;
    metrics.price_to_fcf = (fcf && marketCap) ? (marketCap / fcf).toFixed(2) : 'N/A';
    metrics.ev_fcf = (fcf && ev) ? (ev / fcf).toFixed(2) : 'N/A';

    // Income Statement & Growth
    const incomeReports = incomeStatementData.annualReports || [];
    const balanceReports = balanceSheetData.annualReports || [];
    const epsData = incomeReports.map((income, i) => {
        const matchingBalance = balanceReports.find(b => b.fiscalDateEnding === income.fiscalDateEnding) || {};
        const netIncome = parseFloat(income.netIncome) || 0;
        const shares = parseFloat(matchingBalance.commonStockSharesOutstanding) || parseFloat(overviewData.SharesOutstanding) || 0;
        return shares ? netIncome / shares : 0;
    });

    const sales = incomeReports.map(r => parseFloat(r.totalRevenue) || 0);
    const ebitda = incomeReports.map(r => parseFloat(r.ebitda) || (parseFloat(r.operatingIncome) + parseFloat(r.depreciationAndAmortization)) || 0);
    metrics.sales_growth_1yr = calculateGrowthRate(sales[0], sales[1]);
    metrics.sales_growth_3yr = calculateAvgGrowth(incomeReports, 3, 'totalRevenue');
    metrics.sales_growth_5yr = calculateAvgGrowth(incomeReports, 5, 'totalRevenue');
    metrics.eps_growth_1yr = calculateGrowthRate(epsData[0], epsData[1]);
    metrics.eps_growth_3yr = calculateAvgGrowth(epsData.map((eps, i) => ({ eps, fiscalDateEnding: incomeReports[i]?.fiscalDateEnding })), 3, 'eps');
    metrics.eps_growth_5yr = calculateAvgGrowth(epsData.map((eps, i) => ({ eps, fiscalDateEnding: incomeReports[i]?.fiscalDateEnding })), 5, 'eps');
    metrics.ebitda_growth_1yr = calculateGrowthRate(ebitda[0], ebitda[1]);
    metrics.ebitda_growth_3yr = calculateAvgGrowth(incomeReports, 3, 'ebitda');
    metrics.ebitda_growth_5yr = calculateAvgGrowth(incomeReports, 5, 'ebitda');

    // Profitability
    const grossProfit = incomeReports.map(r => parseFloat(r.grossProfit) || 0);
    const operatingIncome = incomeReports.map(r => parseFloat(r.operatingIncome) || 0);
    const netIncome = incomeReports.map(r => parseFloat(r.netIncome) || 0);
    const revenue = incomeReports.map(r => parseFloat(r.totalRevenue) || 0);

    const grossMargins = revenue.map((rev, i) => rev ? (grossProfit[i] / rev * 100) : 0);
    const operatingMargins = revenue.map((rev, i) => rev ? (operatingIncome[i] / rev * 100) : 0);
    const netMargins = revenue.map((rev, i) => rev ? (netIncome[i] / rev * 100) : 0);

    metrics.gross_margin = grossMargins[0] ? grossMargins[0].toFixed(2) + '%' : 'N/A';
    metrics.gross_margin_1yr_change = calculateMarginChange(grossMargins[0], grossMargins[1]);
    metrics.gross_margin_3yr_change = calculateMarginChange(grossMargins[0], grossMargins[2]);
    metrics.gross_margin_5yr_change = calculateMarginChange(grossMargins[0], grossMargins[4]);
    metrics.operating_margin = operatingMargins[0] ? operatingMargins[0].toFixed(2) + '%' : 'N/A';
    metrics.operating_margin_1yr_change = calculateMarginChange(operatingMargins[0], operatingMargins[1]);
    metrics.operating_margin_3yr_change = calculateMarginChange(operatingMargins[0], operatingMargins[2]);
    metrics.operating_margin_5yr_change = calculateMarginChange(operatingMargins[0], operatingMargins[4]);
    metrics.net_margin = netMargins[0] ? netMargins[0].toFixed(2) + '%' : 'N/A';
    metrics.net_margin_1yr_change = calculateMarginChange(netMargins[0], netMargins[1]);
    metrics.net_margin_3yr_change = calculateMarginChange(netMargins[0], netMargins[2]);
    metrics.net_margin_5yr_change = calculateMarginChange(netMargins[0], netMargins[4]);

    // Technical Metrics
    const timeSeries = dailyData['Time Series (Daily)'] || {};
    const dates = Object.keys(timeSeries).sort().reverse();
    const closes = dates.map(date => parseFloat(timeSeries[date]['4. close']) || 0);
    const highs = dates.map(date => parseFloat(timeSeries[date]['2. high']) || 0);
    const lows = dates.map(date => parseFloat(timeSeries[date]['3. low']) || 0);
    const volumes = dates.map(date => parseFloat(timeSeries[date]['5. volume']) || 0);

    const currentPrice = closes[0] || 0;
    metrics.rsi = calculateRSI(closes);
    metrics.mfi = calculateMFI(highs, lows, closes, volumes);
    const yearHigh = closes.length > 252 ? Math.max(...closes.slice(0, 252)) : 0;
    const yearLow = closes.length > 252 ? Math.min(...closes.slice(0, 252)) : 0;
    metrics.price_vs_52wk_high = yearHigh ? ((currentPrice / yearHigh) * 100 - 100).toFixed(2) + '%' : 'N/A';
    metrics.price_vs_52wk_low = yearLow ? ((currentPrice / yearLow) * 100 - 100).toFixed(2) + '%' : 'N/A';
    metrics.bollinger_percent_20 = calculateBollingerPercent(closes, 20);
    metrics.bollinger_percent_50 = calculateBollingerPercent(closes, 50);
    const sma50 = calculateSMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);
    metrics.price_vs_50day_avg = sma50 ? ((currentPrice / sma50) * 100 - 100).toFixed(2) + '%' : 'N/A';
    metrics.price_vs_200day_avg = sma200 ? ((currentPrice / sma200) * 100 - 100).toFixed(2) + '%' : 'N/A';

    return metrics;
}

function fetchData() {
    if (isFetching) {
        alert('Please wait a moment before fetching again.');
        return;
    }

    const symbols = [
        document.getElementById('symbol1').value.trim().toUpperCase(),
        document.getElementById('symbol2').value.trim().toUpperCase(),
        document.getElementById('symbol3').value.trim().toUpperCase(),
        document.getElementById('symbol4').value.trim().toUpperCase(),
        document.getElementById('symbol5').value.trim().toUpperCase()
    ].filter(symbol => symbol);

    if (symbols.length === 0) {
        alert('Please enter at least one stock symbol!');
        return;
    }

    const apikey = 'EUIL8JU2T0UFCZRR';
    const fetchBtn = document.getElementById('fetchBtn');
    document.getElementById('loading').style.display = 'block';
    fetchBtn.disabled = true;
    isFetching = true;
    document.getElementById('resultsBody').innerHTML = '';

    // Set ticker headers
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`ticker${i}`).innerText = symbols[i - 1] || `Ticker ${i}`;
    }

    Promise.all(symbols.map(symbol => fetchTickerData(symbol, apikey).catch(err => ({ error: err.message, symbol }))))
        .then(results => {
            const metricOrder = [
                'pe_ttm', 'pe_forward', 'price_to_sales', 'price_to_book', 'ev_ebitda', 'price_to_fcf', 'ev_fcf',
                'sales_growth_1yr', 'sales_growth_3yr', 'sales_growth_5yr',
                'eps_growth_1yr', 'eps_growth_3yr', 'eps_growth_5yr',
                'ebitda_growth_1yr', 'ebitda_growth_3yr', 'ebitda_growth_5yr',
                'gross_margin', 'gross_margin_1yr_change', 'gross_margin_3yr_change', 'gross_margin_5yr_change',
                'operating_margin', 'operating_margin_1yr_change', 'operating_margin_3yr_change', 'operating_margin_5yr_change',
                'net_margin', 'net_margin_1yr_change', 'net_margin_3yr_change', 'net_margin_5yr_change',
                'rsi', 'mfi', 'price_vs_52wk_high', 'price_vs_52wk_low',
                'bollinger_percent_20', 'bollinger_percent_50', 'price_vs_50day_avg', 'price_vs_200day_avg'
            ];

            const metricLabels = {
                pe_ttm: 'PE TTM', pe_forward: 'PE Forward', price_to_sales: 'Price to Sales', price_to_book: 'Price to Book',
                ev_ebitda: 'EV / EBITDA', price_to_fcf: 'Price to FCF', ev_fcf: 'EV / FCF',
                sales_growth_1yr: 'Sales Growth 1-Yr', sales_growth_3yr: 'Sales Growth 3-Yr', sales_growth_5yr: 'Sales Growth 5-Yr',
                eps_growth_1yr: 'EPS Growth 1-Yr', eps_growth_3yr: 'EPS Growth 3-Yr', eps_growth_5yr: 'EPS Growth 5-Yr',
                ebitda_growth_1yr: 'EBITDA Growth 1-Yr', ebitda_growth_3yr: 'EBITDA Growth 3-Yr', ebitda_growth_5yr: 'EBITDA Growth 5-Yr',
                gross_margin: 'Gross Margin', gross_margin_1yr_change: 'Gross Margin 1-Yr Change', gross_margin_3yr_change: 'Gross Margin 3-Yr Change',
                gross_margin_5yr_change: 'Gross Margin 5-Yr Change', operating_margin: 'Operating Margin',
                operating_margin_1yr_change: 'Operating Margin 1-Yr Change', operating_margin_3yr_change: 'Operating Margin 3-Yr Change',
                operating_margin_5yr_change: 'Operating Margin 5-Yr Change', net_margin: 'Net Margin',
                net_margin_1yr_change: 'Net Margin 1-Yr Change', net_margin_3yr_change: 'Net Margin 3-Yr Change',
                net_margin_5yr_change: 'Net Margin 5-Yr Change', rsi: 'RSI', mfi: 'MFI',
                price_vs_52wk_high: 'Price vs 52-Wk High', price_vs_52wk_low: 'Price vs 52-Wk Low',
                bollinger_percent_20: 'Bollinger Percent 20', bollinger_percent_50: 'Bollinger Percent 50',
                price_vs_50day_avg: 'Price vs 50-Day Avg', price_vs_200day_avg: 'Price vs 200-Day Avg'
            };

            const tbody = document.getElementById('resultsBody');
            metricOrder.forEach(metric => {
                const row = document.createElement('tr');
                const labelCell = document.createElement('td');
                labelCell.className = 'metric-label';
                labelCell.innerText = metricLabels[metric];
                row.appendChild(labelCell);

                for (let i = 0; i < 5; i++) {
                    const cell = document.createElement('td');
                    if (i < results.length) {
                        const result = results[i];
                        cell.innerText = result.error ? `Error: ${result.error}` : (result[metric] || 'N/A');
                    } else {
                        cell.innerText = '';
                    }
                    row.appendChild(cell);
                }
                tbody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Fetch Error:', error);
            alert('An error occurred. Check console for details.');
        })
        .finally(() => {
            document.getElementById('loading').style.display = 'none';
            fetchBtn.disabled = false;
            setTimeout(() => { isFetching = false; }, 15000);
        });
}
