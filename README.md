# InsolvenzFlow

Kanzleiverwaltung für Insolvenzrecht — Next.js 14 (App Router) + Supabase.

## راه‌اندازی محلی (Local Setup)

```bash
cd insolvenzflow
npm install
cp .env.local.example .env.local
npm run dev
```

سپس به آدرس `http://localhost:3000` برید. فایل `.env.local.example` از قبل با کلیدهای پروژه واقعی Supabase (InsolvenzFlow, eu-central-1) پر شده — کافیه اسمش رو به `.env.local` تغییر بدید.

## ورود اولین کاربر (وکیل)

روی صفحه لاگین، تب **"Konto erstellen"** رو بزنید و یه حساب با ایمیل/پسورد بسازید. به محض ثبت‌نام، یک ردیف تو جدول `profiles` خودکار ساخته می‌شه (از طریق trigger تو دیتابیس).

> نکته: به‌طور پیش‌فرض Supabase ممکنه تأیید ایمیل (email confirmation) رو فعال داشته باشه. اگه بعد از ثبت‌نام نتونستید لاگین کنید، از پنل Supabase → Authentication → Providers، گزینه "Confirm email" رو خاموش کنید (برای تست/توسعه) یا ایمیل تأییدیه رو چک کنید.

## استقرار روی Vercel

1. این پوشه رو به یه ریپوی GitHub پوش کنید.
2. تو Vercel، پروژه رو از اون ریپو import کنید.
3. متغیرهای محیطی زیر رو تو Vercel Project Settings → Environment Variables اضافه کنید:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy بزنید.

## ساختار پروژه

```
app/
  login/           صفحه ورود و ثبت‌نام
  dashboard/
    layout.tsx     نویگیشن کناری + محافظت مسیر (auth)
    page.tsx       داشبورد اصلی (آمار، فرصت‌های نزدیک، آخرین پرونده‌ها)
    cases/new/     فرم ثبت پرونده جدید (مشتری + پرونده)
lib/supabase/      کلاینت‌های Supabase (browser, server, middleware)
middleware.ts      محافظت از مسیرهای /dashboard
```

## دیتابیس (Supabase)

پروژه Supabase به نام **InsolvenzFlow** (region: eu-central-1 / فرانکفورت) از قبل ساخته شده و شامل ۹ جدول با Row Level Security فعاله:
`profiles, clients, cases, creditors, documents, deadlines, tasks, insolvenzplan, activity_log`

فایل‌های SQL این ساختار تو پوشه `supabase/migrations/` قرار دارن. اگه خواستید همین دیتابیس رو روی یه پروژه Supabase دیگه (مثلاً برای dev/staging) بازسازی کنید:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```


## گام‌های بعدی پیشنهادی

- صفحه لیست کامل پرونده‌ها (`/dashboard/cases`) با فیلتر بر اساس وضعیت
- صفحه مدیریت طلبکاران هر پرونده
- اتصال n8n برای Voice-to-Email و تولید خودکار اسناد
- افزودن نقش‌ها (admin/lawyer/paralegal) در RLS policies برای محدود کردن دسترسی
