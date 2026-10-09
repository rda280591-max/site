// ORBIT — منبع واحد حقیقت برای «آیا این کاربر ادمین است؟»
//
// FIX (جابه‌جایی داشبورد): قبلاً فقط requireAdmin در گارد /admin نقش را می‌خواند؛
// سایت عمومی هیچ راهی برای نمایش لینک «پنل مدیریت» نداشت. این ماژول همان منطق
// گارد را به‌صورت غیرمخرب (بدون redirect) و کش‌شده در اختیار هر دو طرف می‌گذارد:
//   - src/app/admin/layout.tsx        → گارد سمت سرور (source of truth)
//   - [locale]/layout.tsx             → تزریق flag در seed سراسری (hydration-safe)
//   - DashboardLayout                 → خواندن همان seed برای رندر لینک ادمین
import { getAdminClient } from './serverClient';

export interface AdminRoleState {
  readonly isAdmin: boolean;
  /** وضعیت نشست: signed-in با پروفایل قابل‌خواندن. */
  readonly signedIn: boolean;
}

const NO_SESSION: AdminRoleState = { isAdmin: false, signedIn: false };

/**
 * کش ماژول-اسکوپ کوتاه (۶۰ ثانیه) به ازای هر کاربر.
 * چرا: لینک ادمین در هدر/سایدبار در هر رندر RSC سایت چک می‌شد؛ بدون کش این
 * یعنی ۲ کوئری اضافه به Supabase برای هر بازدیدکننده لاگین‌کرده. خطای شبکه
 * هم نباید رندر صفحه را بشکند → fallback به NO_SESSION.
 * SECURITY: اینجا هرگز redirect نمی‌کنیم؛ فقط بولین برمی‌گردانیم. تصمیم
 * «ممنوعیت دسترسی» همچنان فقط با requireAdmin در گارد /admin گرفته می‌شود —
 * پس حتی اگر این تابع روی edge کش شود، گارد اصلی دست‌نخورده است.
 */
interface CacheEntry { at: number; state: AdminRoleState }
const roleCache = new Map<string, CacheEntry>();
const ROLE_TTL_MS = 60_000;

/** نسخه بدون redirect — برای مصرف در کامپوننت‌های عمومی (هدر/سایدبار/صفحات). */
export async function checkAdminRole(): Promise<AdminRoleState> {
  const supabase = await getAdminClient();
  if (!supabase) return NO_SESSION;

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    return NO_SESSION;
  }
  if (!userId) return { isAdmin: false, signedIn: false };

  const hit = roleCache.get(userId);
  if (hit && Date.now() - hit.at < ROLE_TTL_MS) return hit.state;

  let state: AdminRoleState = { isAdmin: false, signedIn: true };
  try {
    // ستون status اختیاری است (اسکیمای دستی بعضی پروژه‌ها ندارد) — مثل گارد،
    // اول role؛ banned عمداً.isAdmin=false می‌شود تا لینک پنل هم مخفی شود.
    const { data, error } = await supabase
      .from('profiles')
      .select('role,status')
      .eq('id', userId)
      .maybeSingle<{ role: string; status: string | null }>();
    if (error || !data) {
      state = { isAdmin: false, signedIn: true };
    } else {
      state = { isAdmin: data.role === 'admin' && data.status !== 'banned', signedIn: true };
    }
  } catch {
    state = { isAdmin: false, signedIn: true };
  }

  // سقف ساده برای جلوگیری از رشد بی‌حد Map در نمونه‌های طولانی‌مدت.
  if (roleCache.size > 500) roleCache.clear();
  roleCache.set(userId, { at: Date.now(), state });
  return state;
}
