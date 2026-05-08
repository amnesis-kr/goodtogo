'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Fund, FundPrice } from '@/types/fund';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const COUNTRY_LABEL: Record<string, string> = {
  KR: '🇰🇷 한국',
  US: '🇺🇸 미국',
  CN: '🇨🇳 중국',
  JP: '🇯🇵 일본',
};

function ReturnBadge({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-gray-400">-</span>;
  if (value > 0) return (
    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
      <TrendingUp size={14} />{value.toFixed(2)}%
    </span>
  );
  if (value < 0) return (
    <span className="flex items-center gap-1 text-red-500 font-semibold">
      <TrendingDown size={14} />{value.toFixed(2)}%
    </span>
  );
  return <span className="flex items-center gap-1 text-gray-500"><Minus size={14} />0%</span>;
}

export default function FundsPage() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [prices, setPrices] = useState<Record<string, FundPrice>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCountry, setActiveCountry] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchFunds();
  }, []);

  async function fetchFunds() {
    setLoading(true);
    const { data } = await supabase.from('funds').select('*').order('country');
    if (data) setFunds(data);
    setLoading(false);
  }

  async function fetchPrices() {
    setRefreshing(true);
    const res = await fetch('/api/funds');
    const data = await res.json();
    setPrices(data);
    setRefreshing(false);
  }

  const countries = ['ALL', ...Array.from(new Set(funds.map((f) => f.country)))];
  const filtered = activeCountry === 'ALL' ? funds : funds.filter((f) => f.country === activeCountry);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">인덱스 펀드 비교</h1>
            <p className="text-sm text-gray-500 mt-0.5">국내외 ETF 수익률 및 장단점 한눈에 보기</p>
          </div>
          <button
            onClick={fetchPrices}
            disabled={refreshing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '업데이트 중...' : '수익률 업데이트'}
          </button>
        </div>

        {/* 국가 필터 */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2">
          {countries.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCountry(c)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                activeCountry === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c === 'ALL' ? '전체' : COUNTRY_LABEL[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      {/* 펀드 목록 */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            데이터가 없습니다.<br />
            <span className="text-sm">아래 SQL을 Supabase에서 실행해 데이터를 추가해주세요.</span>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((fund) => {
              const p = prices[fund.ticker];
              const isExpanded = expandedId === fund.id;
              return (
                <div
                  key={fund.id}
                  className="bg-white rounded-xl border hover:border-blue-300 transition cursor-pointer shadow-sm"
                  onClick={() => setExpandedId(isExpanded ? null : fund.id)}
                >
                  <div className="p-5 grid grid-cols-2 md:grid-cols-6 gap-4 items-center">
                    {/* 펀드명 */}
                    <div className="col-span-2 md:col-span-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{fund.ticker}</span>
                        <span className="text-xs text-gray-400">{COUNTRY_LABEL[fund.country] ?? fund.country}</span>
                      </div>
                      <div className="font-semibold text-gray-900 mt-1">{fund.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{fund.index_name}</div>
                    </div>

                    {/* 보수율 */}
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">보수율</div>
                      <div className="font-semibold text-gray-800">{fund.expense_ratio}%</div>
                    </div>

                    {/* 수익률 */}
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">1년</div>
                      <ReturnBadge value={p?.return1y} />
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">3년</div>
                      <ReturnBadge value={p?.return3y} />
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">5년</div>
                      <ReturnBadge value={p?.return5y} />
                    </div>
                  </div>

                  {/* 장단점 펼치기 */}
                  {isExpanded && (
                    <div className="px-5 pb-5 grid md:grid-cols-2 gap-4 border-t pt-4">
                      <div className="bg-emerald-50 rounded-lg p-4">
                        <div className="text-sm font-semibold text-emerald-700 mb-2">장점</div>
                        <p className="text-sm text-emerald-800 whitespace-pre-line">{fund.pros}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4">
                        <div className="text-sm font-semibold text-red-700 mb-2">단점</div>
                        <p className="text-sm text-red-800 whitespace-pre-line">{fund.cons}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
