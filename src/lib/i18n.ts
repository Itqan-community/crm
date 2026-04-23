import type { Bilingual, Lang } from '@/types/database';

export function pick(value: Bilingual | string | null | undefined, lang: Lang): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.ar ?? value.en ?? '';
}

export const UI = {
  headerSubtitle:   { ar: 'نموذج التواصل والمشاركة',        en: 'Contact form' },
  eyebrow:          { ar: 'نموذج التواصل · إتقان',          en: 'Contact form · Itqan' },
  heroTitle:        { ar: 'شاركنا في خدمة التقنيات القرآنية', en: 'Tell us how we can help' },
  // Three Arabic paragraphs separated by \n\n; CategoryPicker splits and
  // renders them as separate <p> elements. English stays a single paragraph.
  heroBody:         { ar: 'نؤمن بأن الأثر الحقيقي يبدأ بالمشاركة، وإذا كنت شغوفاً بخدمة القرآن الكريم من خلال التقنية، فهذا هو مكانك.\n\nنرحّب بجميع المساهمين على اختلاف تخصصاتهم ومستوياتهم. اختر ما يصفك من الخيارات التالية، وسنوجّهك إلى أسئلة مختصرة تناسب اهتمامك — لن يستغرق الأمر أكثر من دقيقتين بإذن الله — ثم نتواصل معك بفرص واضحة للمساهمة في مشاريعنا أو الانضمام إلى فريق تنظيم المجتمع.\n\nمعاً، نجعل التقنيات القرآنية في متناول الجميع.',
                      en: 'Pick what describes you and we’ll walk you through a short set of questions. It won’t take more than two minutes.' },
  startCta:         { ar: 'ابدأ',                           en: 'Start' },
  requiredBadge:    { ar: 'مطلوب',                          en: 'Required' },
  pickCategory:     { ar: 'اختر الفئة لتبدأ',               en: 'Pick a category to start' },
  done:             { ar: 'تم',                              en: 'Done' },
  back:             { ar: 'السابق',                          en: 'Back' },
  changeCategory:   { ar: 'تغيير الفئة',                     en: 'Change category' },
  next:             { ar: 'التالي',                          en: 'Next' },
  submit:           { ar: 'إرسال',                           en: 'Submit' },
  pressEnter:       { ar: 'اضغط Enter للمتابعة',             en: 'Press Enter to continue' },
  thanksTitle:      { ar: 'وصلتنا رسالتك، بارك الله فيك.',
                      en: 'We’ve received your message — thank you.' },
  threeDays:        { ar: '٣ أيام عمل',                      en: '3 business days' },
  refLabel:         { ar: 'الرقم المرجعي',                   en: 'Reference number' },
  supportQ:         { ar: 'أي استفسار؟',                     en: 'Questions?' },
  sendAnother:      { ar: 'إرسال طلب آخر',                   en: 'Submit another' },
  backToSite:       { ar: 'العودة إلى itqan.dev',            en: 'Back to itqan.dev' },
  exploreMore:      { ar: 'استكشف إتقان',                    en: 'Explore Itqan' },
  visitWebsite:     { ar: 'الموقع الرسمي',                   en: 'Official website' },
  visitWebsiteHint: { ar: 'مشاريعنا، نشرتنا، ومواردنا',
                      en: 'Our projects, newsletter and resources' },
  joinCommunity:    { ar: 'مجتمع إتقان',                     en: 'Itqan community' },
  joinCommunityHint:{ ar: 'انضم للنقاش وفرص التطوع',
                      en: 'Join discussions and volunteer opportunities' },
  errRequired:      { ar: 'هذا الحقل مطلوب',                 en: 'This field is required' },
  errEmail:         { ar: 'صيغة البريد غير صحيحة',           en: 'Invalid email format' },
  errUrl:           { ar: 'رابط غير صالح',                    en: 'Invalid URL' },
  errPhone:         { ar: 'رقم غير صالح — استخدم الصيغة الدولية (مثال: +966551234567)',
                      en: 'Invalid number — use international format (e.g. +966551234567)' },
  errSubmit:        { ar: 'تعذّر إرسال طلبك. حاول مرة أخرى.', en: 'Could not submit. Please try again.' },
  loading:          { ar: 'جارٍ التحميل…',                   en: 'Loading…' },
  submitting:       { ar: 'جارٍ الإرسال…',                   en: 'Submitting…' },
} as const;

export function stepOf(a: number, b: number, lang: Lang): string {
  return lang === 'ar' ? `${a} من ${b}` : `${a} of ${b}`;
}

export function thanksBody(days: string, lang: Lang): [string, string, string] {
  return lang === 'ar'
    ? ['سيراجع فريق إتقان طلبك ويتواصل معك خلال ', days, ' بإذن الله.']
    : ['The Itqan team will review your request and reach out within ', days, '.'];
}
