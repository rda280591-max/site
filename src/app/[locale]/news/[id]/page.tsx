import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/routing';
import { DashboardLayout } from '@/ui/layouts/DashboardLayout';
import { NewsArticleDetail } from '@/ui/components/organisms/NewsArticleDetail.client';

/*
 * صفحه جزئیات خبر — با کلیک روی هر جای کارت (تصویر/متن/خود کارت) باز می‌شود.
 * داده از کش in-memory همان سرویس فید خوانده می‌شود؛ اگر نبود، fetch تازه.
 */

export function generateStaticParams() {
  // ids are dynamic; only locale is static so the build does not break.
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale: locale as AppLocale, namespace: 'metaPages' });
  return {
    title: `${t('news.title')} | ORBIT`,
    description: t('news.description'),
    robots: { index: false, follow: true },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale: locale as AppLocale, namespace: 'article' });

  return (
    <DashboardLayout requireAuth={false}>
      <NewsArticleDetail
        articleId={decodeURIComponent(id)}
        labels={{
          back: t('back'),
          readOnSite: t('readOnSite'),
          source: t('source'),
          published: t('published'),
          notFoundTitle: t('notFoundTitle'),
          notFoundBody: t('notFoundBody'),
          loading: t('loading'),
          bookmark: t('bookmark'),
          bookmarked: t('bookmarked'),
          deepDive: t('deepDive'),
          exit: t('exit'),
        }}
      />
    </DashboardLayout>
  );
}
