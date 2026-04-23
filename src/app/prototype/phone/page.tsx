'use client';

import { useState } from 'react';
import { PhoneInputLib } from './PhoneInputLib';
import { PhoneInputIntl } from './PhoneInputIntl';
import { resolveDefaultCountry } from '@/lib/phone-detect';

const SAMPLE_INPUTS = [
  '0551234567',
  '+966 55 123 4567',
  '٠٥٥١٢٣٤٥٦٧',
  '00966551234567',
  '+1 555 123 4567',
  '+20 100 123 4567',
];

export default function PhonePrototypePage() {
  const [location, setLocation] = useState('');
  const defaultCountry = resolveDefaultCountry({ location, lang: 'ar' });

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10" dir="rtl">
        <header className="space-y-3">
          <h1 className="text-[clamp(24px,3vw,32px)] font-semibold">
            مقارنة مكتبات إدخال الجوال
          </h1>
          <p className="text-[15px] leading-7" style={{ color: 'var(--muted)' }}>
            صفحة اختبار داخلية — جرّب كلا المكوّنين بالصيغ المختلفة، ثم أخبرني
            أيّهما تجد تجربته أفضل. الهدف: قبول صيغ متعددة من المستخدمين مع
            تخزين E.164 قياسي.
          </p>
        </header>

        <section
          className="rounded-xl p-5 space-y-3 border"
          style={{ borderColor: 'var(--rule)', background: 'var(--rule-soft)' }}
        >
          <label className="block text-[13.5px]" style={{ color: 'var(--muted)' }}>
            حقل &quot;الدولة والمدينة&quot; (يُحاكي ما يُدخله المستخدم في النموذج قبل الجوال)
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="مثال: الرياض، السعودية · Cairo, Egypt · Dubai, UAE"
            className="w-full bg-transparent outline-none text-[16px] pb-2 border-b"
            style={{
              color: 'var(--fg)',
              borderColor: 'var(--rule)',
              caretColor: 'var(--accent)',
            }}
          />
          <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
            البلد الافتراضي المُحتسَب حالياً:{' '}
            <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>
              {defaultCountry}
            </span>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-[18px] font-semibold">صيغ للاختبار (انسخها والصقها)</h2>
          <ul
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13.5px] font-mono"
            dir="ltr"
          >
            {SAMPLE_INPUTS.map((s) => (
              <li
                key={s}
                className="rounded px-3 py-2 border"
                style={{
                  borderColor: 'var(--rule)',
                  background: 'var(--option-bg)',
                }}
              >
                {s}
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <Variant
            badge="A"
            title="libphonenumber-js"
            size="≈ 5KB (min)"
            pros={[
              'شكل الحقل الحالي محفوظ',
              'تحليل ذكي للصيغ المحلية والدولية',
              'يقبل 0551234567 مباشرة (مع البلد الافتراضي)',
              'Bundle صغير جداً',
            ]}
            cons={[
              'لا يوجد dropdown أعلام',
              'المستخدم يكتب + أو 00 يدوياً لدول أخرى',
              'التبديل بين الدول يعتمد على حقل الدولة السابق',
            ]}
          >
            <PhoneInputLib defaultCountry={defaultCountry} />
          </Variant>

          <Variant
            badge="B"
            title="react-international-phone"
            size="≈ 30KB"
            pros={[
              'dropdown أعلام + dial code مرئي',
              'تنسيق حي أثناء الكتابة',
              'تبديل بلد بضغطة',
              'UX مألوف للمستخدمين الدوليين',
            ]}
            cons={[
              'Bundle أكبر بخمس مرات تقريباً',
              'يحتاج تخصيص CSS ليطابق theme الموقع',
              'شكله مختلف عن بقية الحقول (خط تحتي بسيط)',
            ]}
          >
            <PhoneInputIntl defaultCountry={defaultCountry} />
          </Variant>
        </div>

        <footer
          className="text-[13px] leading-7 pt-8 border-t"
          style={{ color: 'var(--muted)', borderColor: 'var(--rule)' }}
        >
          <p>
            بعد التجربة، أخبرني أي الحلّين تفضّل. سيُطبَّق المختار في النموذج
            الفعلي (PhoneInput) مع:
          </p>
          <ul className="list-disc ps-5 mt-2 space-y-1">
            <li>تخزين E.164 فقط في قاعدة البيانات</li>
            <li>رسائل خطأ محدَّدة (قصير / طويل / بلد غير صالح)</li>
            <li>اكتشاف البلد من حقل &quot;الدولة والمدينة&quot; تلقائياً</li>
            <li>تطبيع على الخادم قبل الإدخال (عدم الوثوق بالعميل)</li>
          </ul>
        </footer>
      </div>
    </div>
  );
}

function Variant({
  badge,
  title,
  size,
  pros,
  cons,
  children,
}: {
  badge: string;
  title: string;
  size: string;
  pros: string[];
  cons: string[];
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl p-5 sm:p-6 space-y-5 border"
      style={{ borderColor: 'var(--rule)', background: 'var(--option-bg)' }}
    >
      <header className="flex items-baseline gap-3">
        <span
          className="inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold text-[14px]"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {badge}
        </span>
        <h3 className="text-[20px] font-semibold flex-1">{title}</h3>
        <span className="text-[12px] font-mono" style={{ color: 'var(--muted)' }}>
          {size}
        </span>
      </header>

      {children}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] pt-2">
        <ul className="space-y-1.5">
          {pros.map((p) => (
            <li key={p} className="flex gap-2" style={{ color: 'var(--fg)' }}>
              <span style={{ color: 'var(--accent)' }}>✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <ul className="space-y-1.5">
          {cons.map((c) => (
            <li key={c} className="flex gap-2" style={{ color: 'var(--muted)' }}>
              <span style={{ color: 'var(--danger)' }}>✗</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
