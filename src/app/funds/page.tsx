'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Fund, FundPrice } from '@/types/fund';
import { RefreshCw, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const COUNTRY_LABEL: Record<string, string> = {
  KR: '🇰🇷 한국',
  US: '🇺🇸 미국',
  CN: '🇨🇳 중국',
  JP: '🇯🇵 일본',
};

function ReturnBadge({ value, label }: { value: number | undefined; label: string }) {
  if (value === undefined) return (
    <div className="text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-gray-300 text-sm">-</div>
    </div>
  );
  const color = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-500' : 'text-gray-500';
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : null;
  return (
    <div className="text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`flex items-center justify-center gap-0.5 font-semibold text-sm ${color}`}>
        {Icon && <Icon size={13} />}
        {value > 0 ? '+' : ''}{value.toFixed(2)}%
      </div>
    </div>
  );
}

function MiniChart({ data, positive }: { data: { date: string; close: number }[]; positive: boolean }) {
  if (!data || data.length === 0) return <div className="h-16 flex items-center justify-center text-gray-200 text-xs">데이터 없음</div>;
  const color = positive ? '#10b981' : '#ef4444';
  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${positive}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.5} fill={`url(#grad-${positive})`} dot={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, padding: '2px 8px', borderRadius: 6 }}
          formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : v, '가격']}
          labelFormatter={(l) => l}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function FundsPage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [prices, setPrices] = useState<Record<string, FundPrice>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCountry, setActiveCountry] = useState('ALL');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchFunds().then(() => fetchPrices());
  }, []);

  async function fetchFunds() {
    const { data } = await supabase.from('funds').select('*').order('country');
    if (data) setFunds(data);
    setLoading(false);
  }

  async function fetchPrices() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/funds');
      const data = await res.json();
      setPrices(data);
      setLastUpdated(new Date().toLocaleString('ko-KR'));
    } catch {
      // 실패해도 기존 데이터 유지
    }
    setRefreshing(false);
  }

  const countries = ['ALL', ...Array.from(new Set(funds.map((f) => f.country)))];
  const filtered = activeCountry === 'ALL' ? funds : funds.filter((f) => f.country === activeCountry);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">인덱스 펀드 비교</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {lastUpdated ? `마지막 업데이트: ${lastUpdated}` : '로드 중...'}
            </p>
          </div>
          <button
            onClick={fetchPrices}
            disabled={refreshing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '업데이트 중...' : '새로고침'}
          </button>
        </div>
        {/* 국가 필터 */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 flex-wrap">
          {countries.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCountry(c)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                activeCountry === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c === 'ALL' ? '전체' : COUNTRY_LABEL[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">데이터가 없습니다.</div>
        ) : (
          filtered.map((fund) => {
            const p = prices[fund.ticker];
            const isExpanded = expandedId === fund.id;
            const positive = (p?.return1y ?? 0) >= 0;

            return (
              <div key={fund.id} className="bg-white rounded-2xl border hover:border-blue-200 transition shadow-sm overflow-hidden">
                {/* 메인 행 */}
                <div
                  className="p-5 grid grid-cols-2 md:grid-cols-7 gap-3 items-center cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : fund.id)}
                >
                  {/* 펀드 정보 */}
                  <div className="col-span-2 md:col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">{fund.ticker}</span>
                      <span className="text-xs text-gray-400">{COUNTRY_LABEL[fund.country] ?? fund.country}</span>
                    </div>
                    <div className="font-bold text-gray-900">{fund.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fund.index_name}</div>
                  </div>

                  {/* 미니 차트 */}
                  <div className="col-span-2 md:col-span-2">
                    {refreshing ? (
                      <div className="h-16 flex items-center justify-center text-gray-300 text-xs animate-pulse">로딩 중...</div>
                    ) : (
                      <MiniChart data={p?.chartData ?? []} positive={positive} />
                    )}
                  </div>

                  {/* 현재가 */}
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">현재가</div>
                    <div className="font-semibold text-gray-800 text-sm">
                      {p ? `${p.price.toLocaleString()} ${p.currency}` : '-'}
                    </div>
                  </div>

                  {/* 수익률 */}
                  <ReturnBadge value={p?.return1y} label="1년" />
                  <ReturnBadge value={p?.return3y} label="3년" />

                  {/* 펼치기 버튼 */}
                  <div className="flex justify-end">
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </div>

                {/* 펼쳐진 상세 */}
                {isExpanded && (
                  <div className="border-t px-5 pb-5 pt-4 grid md:grid-cols-3 gap-4">
                    {/* 5년 수익률 + 보수율 */}
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="text-xs text-gray-400 mb-1">5년 수익률</div>
                        <div className={`text-xl font-bold ${(p?.return5y ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {p ? `${p.return5y > 0 ? '+' : ''}${p.return5y.toFixed(2)}%` : '-'}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="text-xs text-gray-400 mb-1">연간 보수율</div>
                        <div className="text-xl font-bold text-gray-800">{fund.expense_ratio}%</div>
                      </div>
                    </div>

                    {/* 장점 */}
                    <div className="bg-emerald-50 rounded-xl p-4">
                      <div className="text-sm font-semibold text-emerald-700 mb-2">장점</div>
                      <p className="text-sm text-emerald-800 leading-relaxed">{fund.pros.split('\\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>
                    </div>

                    {/* 단점 */}
                    <div className="bg-red-50 rounded-xl p-4">
                      <div className="text-sm font-semibold text-red-600 mb-2">단점</div>
                      <p className="text-sm text-red-800 leading-relaxed">{fund.cons.split('\\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
