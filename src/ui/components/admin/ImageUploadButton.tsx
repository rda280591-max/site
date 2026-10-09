'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const MAX_BYTES = 2_097_152; // 2MB — هم‌راستا با file_size_limit باکت و محدودیت سرور
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * آپلود تصویر کاور از طریق پروکسی امن /api/admin/upload.
 * چرا پروکسی؟ توکن access_token هرگز در کلاینت دست‌خوردنی نمی‌شود؛
 * احراز هویت+نقش سمت سرور چک می‌شود (route خودش گارد ادمین دارد).
 */
export default function ImageUploadButton({ onUploaded }: { onUploaded: (publicUrl: string) => void }) {
  // FIX (دوزبانه‌سازی): متن‌های این کامپوننت قبلاً انگلیسی هاردکد بود؛ حالا از
  // namespace «admin.imageUpload» (کلیدها از قبل در messages موجود ولی مرده بودند).
  const t = useTranslations('admin.imageUpload');
  const inputRef = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // FIX (فیدبک): وضعیت موفقیت آپلود — قبلاً هیچ نشانه‌ای جز پر شدن فیلد نبود.
  const [uploaded, setUploaded] = useState(false);

  async function pick() { inputRef.current?.click(); }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(null);
    setUploaded(false);
    if (!ALLOWED.includes(file.type)) { setErr(t('unsupported')); return; }
    if (file.size > MAX_BYTES) { setErr(t('tooLarge')); return; }

    setPct(0);
    try {
      // progress واقعی با XHR روی همان endpoint (fetch پیشرفت آپلود نمی‌دهد)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const form = new FormData();
        form.append('file', file);
        xhr.open('POST', '/api/admin/upload');
        xhr.upload.onprogress = (ev) => ev.lengthComputable && setPct(Math.round((ev.loaded / ev.total) * 100));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { onUploaded(JSON.parse(xhr.responseText).url as string); setUploaded(true); resolve(); }
            catch { reject(new Error('bad response')); }
          } else reject(new Error(`HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(form);
      });
    } catch {
      setErr(t('failed'));
    } finally {
      setPct(null);
    }
  }

  return (
    <div className="space-y-1">
      <input ref={inputRef} type="file" accept={ALLOWED.join(',')} onChange={onChange} className="hidden" data-testid="admin-image-file" />
      <button type="button" onClick={pick} disabled={pct !== null} data-testid="admin-upload-btn"
        aria-describedby={pct === null ? undefined : 'admin-upload-hint'}
        className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50">
        {pct !== null ? `${t('uploading')} ${pct}%` : t('button')}
      </button>
      {pct !== null && (
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1 overflow-hidden rounded bg-white/10">
          <span className={`block h-full bg-cyan-400 transition-[width]`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {/* FIX (دوزبانه‌سازی): پیام موفقیت — کلید «done» از قبل موجود ولی بلااستفاده بود */}
      {pct === null && !err && uploaded && <p id="admin-upload-hint" role="status" className="text-xs text-emerald-300">{t('done')}</p>}
      {err && <p role="alert" className="text-xs text-fuchsia-400">{err}</p>}
    </div>
  );
}
