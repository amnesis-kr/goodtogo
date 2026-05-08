import { NextResponse } from 'next/server';
import axios from 'axios';

const TICKERS = [
  // 한국
  '069500.KS', // KODEX 200
  '102110.KS', // TIGER 코스피
  '229200.KS', // KODEX 코스닥150
  // 미국
  'SPY', 'QQQ', 'SCHD', 'VTI',
  // 중국
  'FXI', 'MCHI',
  // 일본
  'EWJ', 'DXJ',
];

export async function GET() {
  const results = await Promise.allSettled(
    TICKERS.map(async (ticker) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5y`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000,
      });
      const meta = res.data.chart.result[0].meta;
      const closes: number[] = res.data.chart.result[0].indicators.quote[0].close;
      const valid = closes.filter(Boolean);
      const latest = valid[valid.length - 1];
      const y1 = valid[valid.length - 252] ?? valid[0];
      const y3 = valid[valid.length - 756] ?? valid[0];
      const y5 = valid[0];
      return {
        ticker,
        price: latest,
        currency: meta.currency,
        return1y: +((( latest - y1) / y1) * 100).toFixed(2),
        return3y: +((( latest - y3) / y3) * 100).toFixed(2),
        return5y: +((( latest - y5) / y5) * 100).toFixed(2),
      };
    })
  );

  const data: Record<string, unknown> = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') data[TICKERS[i]] = r.value;
    else data[TICKERS[i]] = null;
  });

  return NextResponse.json(data);
}
