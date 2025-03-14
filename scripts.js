let isFetching = false;
let metricDetails = {};

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

function showDetails(ticker, metricId) {
    const details = metricDetails[ticker]?.[metricId] || 'No details available.';
    document.getElementById('metricModalLabel').innerText = `${ticker} - ${document.getElementById(`${ticker}_${metricId}`).innerText.split(':')[0]} Details`;
    document.getElementById('metricDetails').innerHTML = details;
    $('#metricModal').modal('show');
}

function fetchData() {
    if (isFetching) {
        alert('Please wait a moment before fetching again.');
        return;
    }

    const symbolsInput = document.getElementById('symbols').value.trim().toUpperCase();
    const symbols = symbolsInput.split(',').map(s => s.trim()).filter(s => s).slice(0, 5);
    if (symbols.length < 3) {
        alert('Please enter at least 3 tickers separated by commas (e.g., AMD, NVDA, TSLA)');
        return;
    }
    const displayedSymbols = symbols.slice(0, 3); // Display only 3 for now

    const apikey = 'EUIL8JU2T0UFCZRR';
    const fetchBtn = document.getElementById('fetchBtn');
    document.getElementById('loading').style.display = 'block';
    fetchBtn.disabled = true;
    isFetching = true;
    clearResults();

    const tickerPromises = displayedSymbols.map(symbol => {
        const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apikey}`;
        const cashFlowUrl = `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${symbol}&apikey=${apikey}`;
        const balanceSheetUrl = `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${symbol}&apikey=${apikey}`;
        const incomeStatementUrl = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${apikey}`;
        const dailyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apikey}`;

        return Promise.all([
            fetch(overviewUrl).then(res => res.json()),
            fetch(cashFlowUrl).then(res => res.json()),
            fetch(balanceSheetUrl).then(res => res.json()),
            fetch(incomeStatementUrl).then(res => res.json()),
            fetch(dailyUrl).then(res => res.json())
        ])
        .then(([overviewData, cashFlowData, balanceSheetData, incomeStatementData, dailyData]) => {
            metricDetails[symbol] = {};

            // OVERVIEW
            if (overviewData.Information || overviewData.Note) throw new Error(`API rate limit exceeded for ${symbol}`);
            if (Object.keys(overviewData).length === 0) throw new Error(`No data returned for ${symbol}`);

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
            metricDetails[symbol]['operating_margin'] = `Net Margin: ${netMargin}`;
            metricDetails[symbol]['operating_margin_1yr_change'] = `Net Margin 1-Yr Change: ${netMargin1Yr}`;
            metricDetails[symbol]['operating_margin_3yr_change'] = `Net Margin 3-Yr Change: ${netMargin3Yr}`;
            metricDetails[symbol]['operating_margin_5yr_change'] = `Net Margin 5-Yr Change: ${netMargin5Yr}`;
            metricDetails[symbol]['net_margin'] = `Operating Margin: ${operatingMargin}`;
            metricDetails[symbol]['net_margin_1yr_change'] = `Operating Margin 1-Yr Change: ${operatingMargin1Yr}`;
            metricDetails[symbol]['net_margin_3yr_change'] = `Operating Margin 3-Yr Change: ${operatingMargin3Yr}`;
            metricDetails[symbol]['net_margin_5yr_change'] = `Operating Margin 5-Yr Change: ${operatingMargin5Yr}`;
            metricDetails[symbol]['rsi'] = `RSI: ${rsi}`;
            metricDetails[symbol]['mfi'] = `MFI: ${mfi}`;
            metricDetails[symbol]['price_vs_52wk_high'] = `Price vs 52-Wk High: ${priceVs52WkHigh}`;
            metricDetails[symbol]['price_vs_52wk_low'] = `Price vs 52-Wk Low: ${priceVs52WkLow}`;
            metricDetails[symbol]['bollinger_percent_20'] = `Bollinger Percent 20: ${bollinger20}`;
            metricDetails[symbol]['bollinger_percent_50'] = `Bollinger Percent 50: ${bollinger50}`;
            metricDetails[symbol]['price_vs_50day_avg'] = `Price vs 50-Day Avg: ${priceVs50DayAvg}`;
            metricDetails[symbol]['price_vs_200day_avg'] = `Price vs 200-Day Avg: ${priceVs200DayAvg}`;

            return { symbol, currentPrice: currentPriceFinal, marketCap, peTTM, peForward, priceToSales, priceToBook, evEbitda, priceToFCF, evFCF,
                sales1Yr, sales3Yr: sales3Yr.value, sales5Yr: sales5Yr.value,
                eps1Yr, eps3Yr: eps3Yr.value, eps5Yr: eps5Yr.value,
                ebitda1Yr, ebitda3Yr: ebitda3Yr.value, ebitda5Yr: ebitda5Yr.value,
                grossMargin, grossMargin1Yr, grossMargin3Yr, grossMargin5Yr,
                operatingMargin, operatingMargin1Yr, operatingMargin3Yr, operatingMargin5Yr,
                netMargin, netMargin1Yr, netMargin3Yr, netMargin5Yr,
                rsi, mfi, priceVs52WkHigh, priceVs52WkLow, bollinger20, bollinger50, priceVs50DayAvg, priceVs200DayAvg };
        });
    });

    Promise.all(tickerPromises)
    .then(results => {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '';
        results.forEach(data => {
            const column = `
                <div class="ticker-column">
                    <h2 class="text-warning">${data.symbol}</h2>
                    <div class="prominent-metric">
                        Stock Price: $${data.currentPrice.toFixed(2)} | Market Cap: $${(data.marketCap / 1e9).toFixed(2)}B
                    </div>
                    <div class="metric-box"><span>TTM PE</span><span class="value">${data.peTTM}</span><span class="comparison">Many Stocks Trade At 20-28</span></div>
                    <div class="metric-box"><span>Forward PE</span><span class="value">${data.peForward}</span><span class="comparison">Many Stocks Trade At 18-26</span></div>
                    <div class="metric-box"><span>2 Year Forward PE</span><span class="value">22.07</span><span class="comparison">Many Stocks Trade At 16-24</span></div>
                    <div class="metric-box"><span>TTM EPS Growth</span><span class="value">${data.eps1Yr}</span><span class="comparison">Many Stocks Trade At 8-12%</span></div>
                    <div class="metric-box"><span>Current Yr Exp EPS Growth</span><span class="value">${data.eps3Yr}</span><span class="comparison">Many Stocks Trade At 8-12%</span></div>
                    <div class="metric-box"><span>Next Year EPS Growth</span><span class="value">${data.eps5Yr}</span><span class="comparison">Many Stocks Trade At 8-12%</span></div>
                    <div class="metric-box"><span>TTM Rev Growth</span><span class="value">${data.sales1Yr}</span><span class="comparison">Many Stocks Trade At 4.5-5.5%</span></div>
                    <div class="metric-box"><span>Current Yr Exp Rev Growth</span><span class="value">${data.sales3Yr}</span><span class="comparison">Many Stocks Trade At 4.5-5.5%</span></div>
                    <div class="metric-box"><span>Next Year Rev Growth</span><span class="value">${data.sales5Yr}</span><span class="comparison">Many Stocks Trade At 4.5-5.5%</span></div>
                    <div class="metric-box"><span>Gross Margin</span><span class="value">${data.grossMargin}</span><span class="comparison">Many Stocks Trade At 40-48%</span></div>
                    <div class="metric-box"><span>Net Margin</span><span class="value">${data.netMargin}</span><span class="comparison">Many Stocks Trade At 8-10%</span></div>
                    <div class="metric-box"><span>TTM P/S Ratio</span><span class="value">${data.priceToSales}</span><span class="comparison">Many Stocks Trade At 1.8-2.6</span></div>
                    <div class="metric-box"><span>Forward P/S Ratio</span><span class="value">${data.priceToSales}</span><span class="comparison">Many Stocks Trade At 1.8-2.6</span></div>
                </div>
            `;
            resultsDiv.innerHTML += column;
        });
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
}

document.getElementById('fetchBtn').addEventListener('click', fetchData);
