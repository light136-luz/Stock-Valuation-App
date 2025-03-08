<!DOCTYPE html>
<html>
<head>
    <title>Stock Valuation App</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
</head>
<body>
    <div class="container">
        <h1 class="mt-4">Stock Valuation Metrics</h1>
        <div class="row mt-4">
            <div class="col-md-4">
                <label for="symbol">Enter Stock Symbol:</label>
                <input type="text" id="symbol" class="form-control" placeholder="e.g., AAPL">
            </div>
            <div class="col-md-2">
                <button onclick="fetchData()" class="btn btn-primary mt-4">Fetch Data</button>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-md-6">
                <h3>Valuation Metrics</h3>
                <p id="pe_ttm"></p>
                <p id="pe_forward"></p>
                <p id="price_to_sales"></p>
                <p id="price_to_book"></p>
                <p id="ev_ebitda"></p>
                <p id="price_to_fcf"></p>
                <p id="ev_fcf"></p>
            </div>
        </div>
    </div>
    <script>
        function fetchData() {
            const symbol = document.getElementById('symbol').value;
            const apikey = 'EUIL8JU2T0UFCZRR';  // Replace with your Alpha Vantage API key
            const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apikey}`;
            const cashFlowUrl = `https://www.alphavantage.co/query?function=CASH_FLOW&symbol=${symbol}&apikey=${apikey}`;

            fetch(overviewUrl)
                .then(response => response.json())
                .then(overviewData => {
                    if (overviewData.Note || !overviewData.Symbol) {
                        alert('Invalid symbol or API limit reached. Try again later.');
                        return;
                    }
                    const peTTM = overviewData.TrailingPE || 'N/A';
                    const peForward = overviewData.ForwardPE || 'N/A';
                    const priceToSales = overviewData.PriceToSalesRatioTTM || 'N/A';
                    const priceToBook = overviewData.PriceToBookRatio || 'N/A';
                    const evEbitda = overviewData.EVToEBITDA || 'N/A';
                    const marketCap = overviewData.MarketCapitalization || 'N/A';

                    return fetch(cashFlowUrl)
                        .then(response => response.json())
                        .then(cashFlowData => {
                            if (cashFlowData.annualReports && cashFlowData.annualReports.length > 0) {
                                const fcf = cashFlowData.annualReports[0].freeCashFlow || 'N/A';
                                const priceToFCF = fcf !== 'N/A' ? (marketCap / fcf).toFixed(2) : 'N/A';
                                const ev = overviewData.EnterpriseValue || 'N/A';
                                const evFCF = fcf !== 'N/A' && ev !== 'N/A' ? (ev / fcf).toFixed(2) : 'N/A';

                                document.getElementById('pe_ttm').innerText = `PE TTM: ${peTTM}`;
                                document.getElementById('pe_forward').innerText = `PE Forward: ${peForward}`;
                                document.getElementById('price_to_sales').innerText = `Price to Sales: ${priceToSales}`;
                                document.getElementById('price_to_book').innerText = `Price to Book: ${priceToBook}`;
                                document.getElementById('ev_ebitda').innerText = `EV / EBITDA: ${evEbitda}`;
                                document.getElementById('price_to_fcf').innerText = `Price to FCF: ${priceToFCF}`;
                                document.getElementById('ev_fcf').innerText = `EV / FCF: ${evFCF}`;
                            } else {
                                alert('No cash flow data available for this symbol.');
                            }
                        });
                })
                .catch(error => {
                    alert('An error occurred. Check your internet or try again.');
                    console.error('Error:', error);
                });
        }
    </script>
</body>

</html>