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
        details.push(`${data[i].fiscalDateEnding}: ${(growth * 100).toFixed(2)}% (Current: ${current}, Previous: ${previous})`);
    }
    const avg = ((totalGrowth / years) * 100).toFixed(2) + '%';
    return { value: avg, details: details.join('<br>') };
}

function calculateMarginChange(currentMargin, pastMargin, yearsBack) {
    if (!currentMargin || !pastMargin) return 'N/A';
    const change = (currentMargin - pastMargin).toFixed(2);
    return `${change}% (${yearsBack}-Yr Change: Current ${currentMargin.toFixed(2)}% - Past ${pastMargin.toFixed(2)}%)`;
}

function showDetails(metricId) {
    const details = metricDetails[metricId] || 'No details available.';
    document.getElementById('metricModalLabel').innerText = document.getElementById(metricId).innerText.split(':')[0] + ' Details';
    document.getElementById('metricDetails').innerHTML = details;
    $('#metricModal').modal('show');
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
    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apikey}`;
    const cashFlowUrl = `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${symbol}&apikey=${apikey}`;
    const balanceSheetUrl = `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${symbol}&apikey=${apikey}`;
    const incomeStatementUrl = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${apikey}`;
    const fetchBtn = document.getElementById('fetchBtn');

    document.getElementById('loading').style.display = 'block';
    fetchBtn.disabled = true;
    isFetching = true;
    clearResults();

    Promise.all([
        fetch(overviewUrl).then(res => res.json()),
        fetch(cashFlowUrl).then(res => res.json()),
        fetch(balanceSheetUrl).then(res => res.json()),
        fetch(incomeStatementUrl).then(res => res.json())
    ])
    .then(([overviewData, cashFlowData, balanceSheetData, incomeStatementData]) => {
        // OVERVIEW Processing
        if (overviewData.Information || overviewData.Note) throw new Error('API rate limit exceeded');
        if (Object.keys(overviewData).length === 0) throw new Error('No data returned by OVERVIEW');

        const peTTM = overviewData.TrailingPE || 'N/A';
        const peForward = overviewData.ForwardPE || 'N/A';
        const priceToSales = overviewData.PriceToSalesRatioTTM || 'N/A';
        const priceToBook = overviewData.PriceToBookRatio || 'N/A';
        const evEbitda = overviewData.EVToEBITDA || 'N/A';
        const marketCap = parseFloat(overviewData.MarketCapitalization) || 0;

        metricDetails['pe_ttm'] = `Trailing PE: ${peTTM}`;
        metricDetails['pe_forward'] = `Forward PE: ${peForward}`;
        metricDetails['price_to_sales'] = `Price to Sales TTM: ${priceToSales}`;
        metricDetails['price_to_book'] = `Price to Book: ${priceToBook}`;
        metricDetails['ev_ebitda'] = `EV / EBITDA: ${evEbitda}`;

        document.getElementById('pe_ttm').innerText = `PE TTM: ${peTTM}`;
        document.getElementById('pe_forward').innerText = `PE Forward: ${peForward}`;
        document.getElementById('price_to_sales').innerText = `Price to Sales: ${priceToSales}`;
        document.getElementById('price_to_book').innerText = `Price to Book: ${priceToBook}`;
        document.getElementById('ev_ebitda').innerText = `EV / EBITDA: ${evEbitda}`;

        // BALANCE_SHEET Processing
        if (balanceSheetData.Information || balanceSheetData.Note) throw new Error('API rate limit exceeded');
        if (!balanceSheetData.annualReports || balanceSheetData.annualReports.length === 0) throw new Error('No balance sheet data returned');

        const latestBalance = balanceSheetData.annualReports[0];
        const longTermDebt = parseFloat(latestBalance.longTermDebt) || 0;
        const shortTermDebt = parseFloat(latestBalance.shortLongTermDebtTotal) || 0;
        const cash = parseFloat(latestBalance.cashAndCashEquivalentsAtCarryingValue) || 0;
        const totalDebt = longTermDebt + shortTermDebt;
        const ev = marketCap + totalDebt - cash;

        // CASH_FLOW Processing
        if (cashFlowData.Information || cashFlowData.Note) throw new Error('API rate limit exceeded');
        let priceToFCF = 'N/A';
        let evFCF = 'N/A';

        if (cashFlowData.annualReports && cashFlowData.annualReports.length > 0) {
            const fcfRaw = cashFlowData.annualReports[0].operatingCashflow || '0';
            const fcf = parseFloat(fcfRaw) || 0;
            if (fcf && marketCap) {
                priceToFCF = (marketCap / fcf).toFixed(2);
                metricDetails['price_to_fcf'] = `Price to FCF: ${priceToFCF}<br>Market Cap: ${marketCap}<br>Free Cash Flow: ${fcf}`;
            }
            if (fcf && ev) {
                evFCF = (ev / fcf).toFixed(2);
                metricDetails['ev_fcf'] = `EV / FCF: ${evFCF}<br>Enterprise Value: ${ev} (MarketCap: ${marketCap} + Total Debt: ${totalDebt} - Cash: ${cash})<br>Free Cash Flow: ${fcf}`;
            }
        }

        document.getElementById('price_to_fcf').innerText = `Price to FCF: ${priceToFCF}`;
        document.getElementById('ev_fcf').innerText = `EV / FCF: ${evFCF}`;

        // INCOME_STATEMENT Processing
        if (incomeStatementData.Information || incomeStatementData.Note) throw new Error('API rate limit exceeded');
        if (!incomeStatementData.annualReports || incomeStatementData.annualReports.length < 5) {
            console.warn('Not enough income statement data for 5-year analysis');
        }

        const incomeReports = incomeStatementData.annualReports || [];
        const balanceReports = balanceSheetData.annualReports || [];
        const epsData = incomeReports.map((income, i) => {
            const matchingBalance = balanceReports.find(b => b.fiscalDateEnding === income.fiscalDateEnding) || {};
            const netIncome = parseFloat(income.netIncome) || 0;
            const shares = parseFloat(matchingBalance.commonStockSharesOutstanding) || parseFloat(overviewData.SharesOutstanding) || 0;
            return shares ? { eps: netIncome / shares, fiscalDateEnding: income.fiscalDateEnding, netIncome, shares } : { eps: 0, fiscalDateEnding: income.fiscalDateEnding, netIncome, shares: 0 };
        });

        const sales = incomeReports.map(r => parseFloat(r.totalRevenue) || 0);
        const ebitda = incomeReports.map(r => parseFloat(r.ebitda) || (parseFloat(r.operatingIncome) + parseFloat(r.depreciationAndAmortization)) || 0);

        // Growth Metrics
        const sales1Yr = calculateGrowthRate(sales[0], sales[1]);
        const sales3Yr = calculateAvgGrowth(incomeReports, 3, 'totalRevenue');
        const sales5Yr = calculateAvgGrowth(incomeReports, 5, 'totalRevenue');
        metricDetails['sales_growth_1yr'] = `Sales Growth 1-Yr: ${sales1Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${sales[0]}<br>Previous (${incomeReports[1].fiscalDateEnding}): ${sales[1]}`;
        metricDetails['sales_growth_3yr'] = `Sales Growth 3-Yr Avg: ${sales3Yr.value}<br>${sales3Yr.details}`;
        metricDetails['sales_growth_5yr'] = `Sales Growth 5-Yr Avg: ${sales5Yr.value}<br>${sales5Yr.details}`;

        const eps1Yr = calculateGrowthRate(epsData[0].eps, epsData[1].eps);
        const eps3Yr = calculateAvgGrowth(epsData, 3, 'eps');
        const eps5Yr = calculateAvgGrowth(epsData, 5, 'eps');
        metricDetails['eps_growth_1yr'] = `EPS Growth 1-Yr: ${eps1Yr}<br>${epsData[0].fiscalDateEnding}: ${epsData[0].eps.toFixed(2)} (Net Income: ${epsData[0].netIncome}, Shares: ${epsData[0].shares})<br>${epsData[1].fiscalDateEnding}: ${epsData[1].eps.toFixed(2)} (Net Income: ${epsData[1].netIncome}, Shares: ${epsData[1].shares})`;
        metricDetails['eps_growth_3yr'] = `EPS Growth 3-Yr Avg: ${eps3Yr.value}<br>${eps3Yr.details}`;
        metricDetails['eps_growth_5yr'] = `EPS Growth 5-Yr Avg: ${eps5Yr.value}<br>${eps5Yr.details}`;

        const ebitda1Yr = calculateGrowthRate(ebitda[0], ebitda[1]);
        const ebitda3Yr = calculateAvgGrowth(incomeReports, 3, 'ebitda');
        const ebitda5Yr = calculateAvgGrowth(incomeReports, 5, 'ebitda');
        metricDetails['ebitda_growth_1yr'] = `EBITDA Growth 1-Yr: ${ebitda1Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${ebitda[0]}<br>Previous (${incomeReports[1].fiscalDateEnding}): ${ebitda[1]}`;
        metricDetails['ebitda_growth_3yr'] = `EBITDA Growth 3-Yr Avg: ${ebitda3Yr.value}<br>${ebitda3Yr.details}`;
        metricDetails['ebitda_growth_5yr'] = `EBITDA Growth 5-Yr Avg: ${ebitda5Yr.value}<br>${ebitda5Yr.details}`;

        document.getElementById('sales_growth_1yr').innerText = `Sales Growth 1-Yr: ${sales1Yr}`;
        document.getElementById('sales_growth_3yr').innerText = `Sales Growth 3-Yr Avg: ${sales3Yr.value}`;
        document.getElementById('sales_growth_5yr').innerText = `Sales Growth 5-Yr Avg: ${sales5Yr.value}`;
        document.getElementById('eps_growth_1yr').innerText = `EPS Growth 1-Yr: ${eps1Yr}`;
        document.getElementById('eps_growth_3yr').innerText = `EPS Growth 3-Yr Avg: ${eps3Yr.value}`;
        document.getElementById('eps_growth_5yr').innerText = `EPS Growth 5-Yr Avg: ${eps5Yr.value}`;
        document.getElementById('ebitda_growth_1yr').innerText = `EBITDA Growth 1-Yr: ${ebitda1Yr}`;
        document.getElementById('ebitda_growth_3yr').innerText = `EBITDA Growth 3-Yr Avg: ${ebitda3Yr.value}`;
        document.getElementById('ebitda_growth_5yr').innerText = `EBITDA Growth 5-Yr Avg: ${ebitda5Yr.value}`;

        // Profitability Metrics
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
        metricDetails['gross_margin'] = `Gross Margin: ${grossMargin}<br>Gross Profit (${incomeReports[0].fiscalDateEnding}): ${grossProfit[0]}<br>Revenue (${incomeReports[0].fiscalDateEnding}): ${revenue[0]}`;
        metricDetails['gross_margin_1yr_change'] = `Gross Margin 1-Yr Change: ${grossMargin1Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${grossMargins[0] ? grossMargins[0].toFixed(2) : 0}%<br>Previous (${incomeReports[1].fiscalDateEnding}): ${grossMargins[1] ? grossMargins[1].toFixed(2) : 0}%`;
        metricDetails['gross_margin_3yr_change'] = `Gross Margin 3-Yr Change: ${grossMargin3Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${grossMargins[0] ? grossMargins[0].toFixed(2) : 0}%<br>3-Yr Ago (${incomeReports[2].fiscalDateEnding}): ${grossMargins[2] ? grossMargins[2].toFixed(2) : 0}%`;
        metricDetails['gross_margin_5yr_change'] = `Gross Margin 5-Yr Change: ${grossMargin5Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${grossMargins[0] ? grossMargins[0].toFixed(2) : 0}%<br>5-Yr Ago (${incomeReports[4].fiscalDateEnding}): ${grossMargins[4] ? grossMargins[4].toFixed(2) : 0}%`;

        const operatingMargin = operatingMargins[0] ? operatingMargins[0].toFixed(2) + '%' : 'N/A';
        const operatingMargin1Yr = calculateMarginChange(operatingMargins[0], operatingMargins[1], 1);
        const operatingMargin3Yr = calculateMarginChange(operatingMargins[0], operatingMargins[2], 3);
        const operatingMargin5Yr = calculateMarginChange(operatingMargins[0], operatingMargins[4], 5);
        metricDetails['operating_margin'] = `Operating Margin: ${operatingMargin}<br>Operating Income (${incomeReports[0].fiscalDateEnding}): ${operatingIncome[0]}<br>Revenue (${incomeReports[0].fiscalDateEnding}): ${revenue[0]}`;
        metricDetails['operating_margin_1yr_change'] = `Operating Margin 1-Yr Change: ${operatingMargin1Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${operatingMargins[0] ? operatingMargins[0].toFixed(2) : 0}%<br>Previous (${incomeReports[1].fiscalDateEnding}): ${operatingMargins[1] ? operatingMargins[1].toFixed(2) : 0}%`;
        metricDetails['operating_margin_3yr_change'] = `Operating Margin 3-Yr Change: ${operatingMargin3Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${operatingMargins[0] ? operatingMargins[0].toFixed(2) : 0}%<br>3-Yr Ago (${incomeReports[2].fiscalDateEnding}): ${operatingMargins[2] ? operatingMargins[2].toFixed(2) : 0}%`;
        metricDetails['operating_margin_5yr_change'] = `Operating Margin 5-Yr Change: ${operatingMargin5Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${operatingMargins[0] ? operatingMargins[0].toFixed(2) : 0}%<br>5-Yr Ago (${incomeReports[4].fiscalDateEnding}): ${operatingMargins[4] ? operatingMargins[4].toFixed(2) : 0}%`;

        const netMargin = netMargins[0] ? netMargins[0].toFixed(2) + '%' : 'N/A';
        const netMargin1Yr = calculateMarginChange(netMargins[0], netMargins[1], 1);
        const netMargin3Yr = calculateMarginChange(netMargins[0], netMargins[2], 3);
        const netMargin5Yr = calculateMarginChange(netMargins[0], netMargins[4], 5);
        metricDetails['net_margin'] = `Net Margin: ${netMargin}<br>Net Income (${incomeReports[0].fiscalDateEnding}): ${netIncome[0]}<br>Revenue (${incomeReports[0].fiscalDateEnding}): ${revenue[0]}`;
        metricDetails['net_margin_1yr_change'] = `Net Margin 1-Yr Change: ${netMargin1Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${netMargins[0] ? netMargins[0].toFixed(2) : 0}%<br>Previous (${incomeReports[1].fiscalDateEnding}): ${netMargins[1] ? netMargins[1].toFixed(2) : 0}%`;
        metricDetails['net_margin_3yr_change'] = `Net Margin 3-Yr Change: ${netMargin3Yr}<br>Current (${incomeReports[0].fiscalDateEnding}): ${netMargins[0] ? netMargins[0].toFixed(2) : 0}%<br>3-Yr Ago (${incomeReports[2].fiscalDateEnding}): ${netMargins[2] ? netMargins[2].toFixed(2) : 0}%`;
        metricDetails['net_margin_5yr_change'] = `Net Margin 5-Y
