import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 /* ORBIT — locale-aware navigation
 *
 * این ماژول جایگزین مستقیم next/link و next/navigation است تا پیشوند زبان
 * (و مسیرهای بومی‌شده) خودکار مدیریت شوند.
 * مثال: <Link href="/login"> به /fa/ورود یا /en/login ترجمه می‌شود.
 */
export const { Link, usePathname, useRouter } = createNavigation(routing)
