import { NextResponse } from 'next/server';
import axios from 'axios';

const TICKERS = [
  '069500.KS', '102110.KS', '229200.KS',
  'SPY', 'QQQ', 'SCHD', 'VTI',
  'FXI', 'MCHI',
  'EWJ', 'DXJ',
];

export async function GET() {
  const results = await Promise.allSettled(
    TICKERS.map(async (ticker) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1wk&range=5y`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });
      const result = res.data.chart.result[0];
      const meta = result.meta;
      const timestamps: number[] = result.timestamp ?? [];
      const closes: number[] = result.indicators.quote[0].close ?? [];

      // 주간 차트 데이터 (최근 52주)
      const chartData = timestamps
        .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), close: closes[i] }))
        .filter((d) => d.close != null)
        .slice(-52);

      const valid = closes.filter(Boolean);
      const latest = valid[valid.length - 1];
      const y1 = valid[valid.length - 52] ?? valid[0];
      const y3 = valid[valid.length - 156] ?? valid[0];
      const y5 = valid[0];

      return {
        ticker,
        price: +latest.toFixed(2),
        currency: meta.currency,
        return1y: +((( latest - y1) / y1) * 100).toFixed(2),
        return3y: +((( latest - y3) / y3) * 100).toFixed(2),
        return5y: +((( latest - y5) / y5) * 100).toFixed(2),
        chartData,
      };
    })
  );

  const data: Record<string, unknown> = {};
  results.forEach((r, i) => {
    data[TICKERS[i]] = r.status === 'fulfilled' ? r.value : null;
  });

  return NextResponse.json(data);
}
