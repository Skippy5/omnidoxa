/**
 * Briefing Layout Helper Functions
 * 
 * Generates consistent HTML layouts for market futures and stock tables
 * across all briefings (Dad, Skip, Therese)
 */

import type { FutureData, StockData } from '@/types/briefing';

/**
 * Generate 3-box market futures layout (side-by-side)
 */
export function generateFuturesBoxesHTML(futures: FutureData[], context: string): string {
  const boxes = futures.map(f => {
    if (f.error) {
      return `
        <div style="flex: 1; background: #f5f5f5; border-radius: 8px; padding: 15px; text-align: center; margin: 0 5px;">
          <div style="font-size: 0.9em; color: #666; font-weight: 600;">${f.name || f.symbol}</div>
          <div style="font-size: 1.4em; color: #999; margin: 8px 0;">--</div>
          <div style="font-size: 0.9em; color: #999;">Unavailable</div>
        </div>
      `;
    }
    
    const color = f.change >= 0 ? '#4CAF50' : '#f44336';
    const arrow = f.change >= 0 ? '▲' : '▼';
    const sign = f.change >= 0 ? '+' : '';
    const bgColor = f.change >= 0 ? '#f0fff0' : '#fff0f0';
    
    return `
      <div style="flex: 1; background: ${bgColor}; border-radius: 8px; padding: 15px; text-align: center; margin: 0 5px; border: 1px solid ${color}20;">
        <div style="font-size: 0.9em; color: #666; font-weight: 600; margin-bottom: 5px;">${f.name}</div>
        <div style="font-size: 1.6em; font-weight: bold; margin: 8px 0; color: #333;">${f.price ? f.price.toFixed(0).toLocaleString() : '--'}</div>
        <div style="font-size: 1em; color: ${color}; font-weight: 600;">
          ${arrow} ${sign}${Math.abs(f.change || 0).toFixed(2)} (${sign}${Math.abs(f.changePercent || 0).toFixed(2)}%)
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; flex-wrap: wrap;">
      ${boxes}
    </div>
    <p style="text-align: center; color: #666; font-size: 0.95em; font-style: italic; margin: 10px 0 0 0;">${context}</p>
  `;
}

/**
 * Generate stock table with Ticker | Price | Change | Outlook columns
 */
export function generateStockTableWithOutlook(stocks: StockData[]): string {
  const rows = stocks.map(stock => {
    if (stock.error) {
      return `<tr><td colspan="4" style="padding: 12px 8px; color: #999; text-align: center; border-bottom: 1px solid #eee;">${stock.symbol}: Data unavailable</td></tr>`;
    }
    
    const color = stock.change >= 0 ? '#4CAF50' : '#f44336';
    const arrow = stock.change >= 0 ? '▲' : '▼';
    const sign = stock.change >= 0 ? '+' : '';
    
    // Truncate outlook to ~150 chars for table display
    let outlook = stock.outlook || 'No outlook available';
    if (outlook.length > 150) {
      outlook = outlook.substring(0, 147) + '...';
    }
    
    return `
      <tr>
        <td style="font-weight: 600; padding: 12px 8px; border-bottom: 1px solid #eee; color: #1a365d;">
          ${stock.symbol}<br>
          <span style="font-size: 0.85em; font-weight: normal; color: #666;">${stock.name || ''}</span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 1.1em; font-weight: 600;">
          $${stock.price ? stock.price.toFixed(2) : '--'}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #eee; color: ${color}; white-space: nowrap; font-weight: 600;">
          ${arrow} ${sign}$${Math.abs(stock.change || 0).toFixed(2)}<br>
          <span style="font-size: 0.85em;">(${sign}${Math.abs(stock.changePercent || 0).toFixed(2)}%)</span>
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 0.9em; color: #555; line-height: 1.4;">
          ${outlook}
        </td>
      </tr>
    `;
  }).join('');
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; background: #fff; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: linear-gradient(135deg, #1a365d, #2563eb); color: white;">
          <th style="text-align: left; padding: 12px 8px; font-size: 0.9em; font-weight: 600;">Ticker</th>
          <th style="text-align: left; padding: 12px 8px; font-size: 0.9em; font-weight: 600;">Price</th>
          <th style="text-align: left; padding: 12px 8px; font-size: 0.9em; font-weight: 600;">Change</th>
          <th style="text-align: left; padding: 12px 8px; font-size: 0.9em; font-weight: 600;">Outlook</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}
