import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '../molecules/Card';
import { useCategoryLabels } from '@/ui/hooks/useCategoryLabels';
import { useFormatters } from '@/ui/hooks/useFormatters';
import type { Article } from '@/types/news';

export const CategoryWidget = React.memo(function CategoryWidget({ articles }: { articles: Article[] }) {
  const t = useTranslations('chart');
  const { categories } = useCategoryLabels();
  const fmt = useFormatters();
  const total = articles.length || 1;

  const distribution = useMemo(() => {
    return categories.map((cat) => {
      const count = articles.filter((a) => a.category === cat.id).length;
      const percent = (count / total) * 100;
      return {
        id: cat.id,
        label: cat.label,
        color: cat.color,
        count,
        percent,
      };
    });
  }, [articles, categories, total]);

  return (
    <Card title={t('distributionTitle')} subtitle={t('distributionSubtitle', { count: articles.length })}>
      <div className="space-y-3">
        {distribution.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                {cat.label}
              </span>
              <span className="text-orbit-text-muted">
                {fmt.number(cat.count)} · {fmt.percent(cat.percent, 0)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full will-change-[width] transform-gpu transition-[width] duration-500 ease-out"
                style={{ width: `${cat.percent}%`, background: cat.color, opacity: 0.85 }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});

export default CategoryWidget;
