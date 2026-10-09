-- ORBIT — افزودن ستون‌های موردنیاز پنل ادمین به جدول profiles
-- (ساخته‌شده بر اساس اسکریپت دستی که کاربر در Supabase اجرا کرده بود)

alter table public.profiles add column if not exists role   text not null default 'user';
alter table public.profiles add column if not exists status text not null default 'active';

-- تریگر handle_new_user فعلی فقط (id,email) را insert می‌کند؛ با defaultها مشکلی ندارد.
-- اگر پروفایل شما از قبل هست، نقش مستقیم ست شود (ایمیل مالک):
update public.profiles set role='admin', status='active'
where id = (select id from auth.users where email='rda280591@gmail.com');
