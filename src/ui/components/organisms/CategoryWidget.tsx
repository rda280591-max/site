import React from 'react';
import { Card } from '../molecules/Card';
import { NEWS_CATEGORIES } from '@/core/config';
import { formatNumber, formatPercent } from '@/utils/formatters';
import type { Article } from '@/types/news';

export function CategoryWidget({ articles }: { articles: Article[] }) {
  const total = articles.length || 1;
  return (
    <Card title="توزیع دسته‌ها" subtitle={`${formatNumber(articles.length)} خبر`}>
      <div className="space-y-3">
        {NEWS_CATEGORIES.map((cat) => {
          const count = articles.filter((a) => a.category === cat.id).length;
          const percent = (count / total) * 100;
          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                  {cat.label}
                </span>
                <span className="text-orbit-text-muted">
                  {formatNumber(count)} · {formatPercent(percent, 0)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, background: cat.color, opacity: 0.85 }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
export default CategoryWidget;