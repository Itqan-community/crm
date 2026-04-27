# إتقان CRM — join.itqan.dev

نموذج تواصل ثنائي اللغة (عربي/إنجليزي) + لوحة تحكم داخلية لفريق إتقان.

- **الواجهة العامة** (`/`): نموذج بأسلوب Typeform، 5 فئات، حقول ديناميكية، شاشة شكر برقم مرجعي.
- **لوحة التحكم** (`/admin`): مراجعة الطلبات، تغيير الحالات، تعيين مسؤول، ملاحظات داخلية، سجل نشاط، تصدير CSV.
- **بناء النموذج** (`/admin/settings/form-builder`): تعديل الفئات والحقول بدون كتابة كود.
- **Stack**: Next.js 15 App Router · TypeScript · Tailwind · Supabase · Resend · Vercel.

---

## 1. التشغيل المحلي

```bash
npm install
cp .env.example .env.local
# املأ المتغيرات (انظر القسم التالي)
npm run dev        # http://localhost:3000
```

---

## 2. متغيرات البيئة

كل المتغيرات موصوفة في [.env.example](.env.example). القيم التي تبدأ بـ `NEXT_PUBLIC_` مرئية في المتصفح؛ الباقي لا يخرج من الخادم.

| المتغير | للمطلوب؟ | المصدر |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | نعم | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | نعم | نفس المكان (publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | نعم | نفس المكان → **Secret keys** (يبدأ بـ `sb_secret_...`). لا تُشارَك ولا تُرفع إلى GitHub. |
| `NEXT_PUBLIC_SITE_URL` | نعم | رابط النشر (`https://join.itqan.dev`) أو رابط Vercel المؤقت |
| `RESEND_API_KEY` | اختياري | [resend.com/api-keys](https://resend.com/api-keys). بدونها لن يُرسَل بريد التأكيد. عنوان المرسِل (`connect@itqan.dev`) واسم المرسِل بالعربي/الإنجليزي يعيشان في `src/lib/notify/email.ts`. |
| `SLACK_WEBHOOK_URL` | اختياري | Slack App → Incoming Webhooks. بدونه لن يُنبَّه الفريق. |
| `NEWSLETTER_PROXY_URL` | اختياري | الافتراضي `https://itqan.dev/api/newsletter/subscribe/` (الـ endpoint الحالي لنشرة إتقان/MailerLite). |
| `MAILERLITE_API_KEY` + `MAILERLITE_GROUP_ID` | اختياري | عند ضبطه يُستخدم مباشرةً بدل البروكسي. |

---

## 3. Supabase — إعداد لمرة واحدة

1. **تطبيق الميجريشنز**: من Supabase Dashboard → SQL Editor شغّل الملفات بالترتيب:
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   - [`supabase/migrations/0002_seed_statuses.sql`](supabase/migrations/0002_seed_statuses.sql)
   - [`supabase/migrations/0003_seed_form_schema.sql`](supabase/migrations/0003_seed_form_schema.sql)

   بديل: شغّلها عبر Supabase CLI أو عبر MCP.

2. **Authentication → URL Configuration**:
   - **Site URL** = `https://join.itqan.dev` (عند الإنتاج)
   - **Redirect URLs**: أضف (كل سطر):
     - `http://localhost:3000/admin/auth/callback`
     - `https://crm-itqan-community.vercel.app/admin/auth/callback` (رابط Vercel المؤقت)
     - `https://join.itqan.dev/admin/auth/callback`

3. **Authentication → Providers → Email**: تأكد أن **Enable Email Provider** مفعّل. اترك OTP/Magic Link افتراضياً.

   **قالب رمز الدخول بالعربي (RTL)**: قالب OTP العربي محفوظ في [`supabase/templates/magic_link.html`](supabase/templates/magic_link.html) وإعداده في [`supabase/config.toml`](supabase/config.toml). لتطبيقه:
   - عبر Supabase CLI: `supabase config push` (يقرأ `supabase/config.toml`).
   - أو يدوياً من الـ Dashboard → Authentication → Email Templates → **Magic Link**: انسخ محتوى الملف والصق في **Message Body**، واضبط **Subject** إلى `رمز الدخول إلى لوحة إتقان`.

4. **بوابة الدخول (allowed_emails)**: يبدأ النظام بـ `abdulrahman@itqan.dev` كأدمن (من seed). تضيف البقية من `/admin/settings` بعد أول دخول.

---

## 4. Slack — تنبيه الفريق بكل طلب جديد

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**.
2. اسم التطبيق: `Itqan CRM`؛ اختر workspace إتقان.
3. القائمة اليسرى → **Incoming Webhooks** → فعّلها → **Add New Webhook to Workspace** → اختر القناة (مثلاً `#new-signups`).
4. انسخ الرابط (`https://hooks.slack.com/services/...`) وضعه في `SLACK_WEBHOOK_URL`.

> بدون هذا المتغير، النظام يعمل طبيعياً ولا يرسل إشعارات Slack.

---

## 5. Resend — بريد تأكيد للمتقدّم

1. أنشئ حساب على [resend.com](https://resend.com).
2. **Domains** → **Add Domain** → `itqan.dev` → أضف سجلات DNS (SPF + DKIM) المطلوبة.
3. بعد التحقق، **API Keys** → **Create API Key** بصلاحية **Sending access**.
4. ضع المفتاح في `RESEND_API_KEY`.
5. تأكد أن `RESEND_FROM_EMAIL` (الافتراضي `connect@itqan.dev`) يشير لنطاق موثّق.

---

## 6. النشر على Vercel

**أول مرة:**

1. [vercel.com/new](https://vercel.com/new) → اختر مستودع GitHub `itqan-community/crm`.
2. Framework Preset: **Next.js** (كشف تلقائي)، Root: `./`.
3. **Environment Variables** → ألصق قيم من [.env.example](.env.example) مع القيم الفعلية. المتغير `NEXT_PUBLIC_SITE_URL` ابدأ بـ `https://<project>.vercel.app` ثم حدّثه لاحقاً.
4. **Deploy**. الدفعات اللاحقة لـ `main` تنشر تلقائياً.

**ربط الدومين `join.itqan.dev`:**

1. Vercel → Project → **Settings → Domains** → **Add** → `join.itqan.dev`.
2. سيعطيك Vercel سجل CNAME (عادةً `cname.vercel-dns.com`). أضفه في DNS مزوّد نطاق `itqan.dev`.
3. بعد التحقق، حدّث `NEXT_PUBLIC_SITE_URL` إلى `https://join.itqan.dev` وأعد النشر.
4. حدّث Supabase Auth → URL Configuration بإضافة الدومين الجديد.

---

## 7. بنية المشروع

```
src/
├── app/
│   ├── page.tsx                          # النموذج العام
│   ├── layout.tsx, globals.css
│   ├── api/submissions/route.ts          # POST → يُدرج في DB + يرسل الإشعارات
│   └── admin/
│       ├── layout.tsx, page.tsx          # قائمة الطلبات
│       ├── login/, auth/callback/        # Magic Link flow
│       ├── submissions/[id]/             # تفاصيل طلب
│       ├── settings/                     # حالات + فريق + form-builder
│       └── export/route.ts               # CSV
├── components/
│   ├── form/                             # يبني النموذج من تعريف قاعدة البيانات
│   └── admin/                            # جداول، حوارات، StatusBadge…
├── lib/
│   ├── supabase/{server,client,admin}.ts
│   ├── form-schema.ts, validation.ts, i18n.ts
│   ├── admin-queries.ts, admin-actions.ts
│   └── notify/{slack,email,newsletter}.ts
├── middleware.ts                         # يحمي /admin/*
└── types/database.ts                     # يطابق الميجريشن الأولى
supabase/migrations/0001_init.sql         # الجداول + RLS + Triggers
supabase/migrations/0002_seed_statuses.sql
supabase/migrations/0003_seed_form_schema.sql
```

---

## 8. لمحة عن قاعدة البيانات

ثلاث كتل مفصولة:

1. **تعريف النموذج** — `form_categories`, `form_fields`. يتحكم بها الأدمن من الـ Form Builder.
2. **بيانات الإرسال** — `submissions` (metadata)، `submission_answers` (إجابة لكل حقل مع snapshot للاسم والعنوان ليبقى العرض صحيحاً حتى بعد تعديل الحقل).
3. **الفريق والتعاون** — `team_members`, `allowed_emails`, `statuses`, `notes`, `activity_log`.

جميع الجداول محمية بـ RLS. الإدراج في `submissions` + `submission_answers` مفتوح للعامة (النموذج عام)، والباقي مقصور على `team_members`. انظر [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) لمزيد من التفاصيل.

---

## 9. سكريبتات مفيدة

```bash
npm run dev         # تطوير
npm run build       # بناء إنتاج
npm run start       # تشغيل بناء إنتاج محلياً
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
```
