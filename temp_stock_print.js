
// Function to print stock report
window.printStockReport = () => {
    const stockItems = Storage.get('stock') || [];

    // Sort logic (can be enhanced if needed, currently just alphabetical by name or similar)
    // Let's sort simply by name A-Z for the report
    stockItems.sort((a, b) => a.name.localeCompare(b.name));

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    let html = `
        <html>
        <head>
            <title>Stock Report</title>
            <style>
                body { 
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif; 
                    font-size: 11px; 
                    width: 300px; 
                    margin: 0 auto; 
                    padding: 5px;
                    color: black;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: bold; }
                .header { margin-bottom: 5px; text-align: center;}
                .header h1 { font-size: 18px; margin: 0; font-weight: 900; }
                .header p { margin: 1px 0; font-size: 11px; }
                .divider { border-bottom: 1px dashed black; margin: 3px 0; }
                .report-title { font-size: 14px; font-weight: bold; text-decoration: underline; margin: 3px 0; text-transform: uppercase;}
                .meta-info { font-size: 11px; margin-bottom: 3px; }
                
                .section-title { font-size: 13px; font-weight: bold; margin: 5px 0 2px 0; border-bottom: 1px solid black;}
                
                .item-row { margin-bottom: 2px; }
                .item-name { font-weight: 600; font-size: 12px; }
                .item-details { display: flex; justify-content: space-between; font-size: 11px; }

                @media print {
                    body { width: 100%; margin: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Khyber Charsi Tikka Karahi & Restaurant</h1>
                <p>Stock Report</p>
                <p>${dateStr} ${timeStr}</p>
            </div>
            
            <div class="divider"></div>
            
            <div class="section-title">Item Stock</div>
            <div style="margin-top: 5px;">
    `;

    if (stockItems.length === 0) {
        html += `<div class="text-center">No stock items found.</div>`;
    } else {
        stockItems.forEach(item => {
            const quantity = parseFloat(item.quantity) || 0;
            // Format to remove trailing zeros if possible, or just standard fixed if needed.
            // Using parseFloat again on toFixed usually removes trailing zeros effectively for non-integers.
            const qtyDisplay = Number(quantity.toFixed(2));

            html += `
                <div class="item-row">
                    <div class="item-name">${item.name}</div>
                    <div class="item-details">
                        <span>Available: ${qtyDisplay} ${item.unit}</span>
                    </div>
                </div>
            `;
        });
    }

    html += `
            </div>
            <div class="divider"></div>
            <div class="text-center" style="font-size: 10px; margin-top: 5px;">End of Report</div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow.document.write(html);
    printWindow.document.close();

    // Auto print
    printWindow.onload = function () {
        setTimeout(function () {
            printWindow.print();
            // printWindow.close(); // Optional: close after print
        }, 500);
    };
};
