import type { ChangeMetric, StatsBundle } from '@/lib/stats/types';

type Row = {
  label: string;
  value: string;
  source: string;
  // Alternative source values shown beneath the row in muted text.
  alternatives?: Array<{ label: string; value: string; source: string }>;
  // Optional note (e.g. "consumption needs Mixpanel").
  note?: string;
  // Optional delta vs. previous window — rendered as a small badge.
  delta?: number | null;
  // When true, the row is unconfigurable today (LinkedIn) and we
  // render it muted.
  manual?: boolean;
};

type Section = {
  title: string;
  subtitle?: string;
  rows: Row[];
};

const FMT_INT = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const FMT_DEC1 = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

function intOrDash(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return FMT_INT.format(v);
}

function pctOrDash(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${FMT_DEC1.format(v)}%`;
}

function dur(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}د ${s}ث` : `${s}ث`;
}

function dateOrDash(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA');
}

function deltaPct(cm: ChangeMetric): number | null {
  if (cm.prev == null || cm.prev === 0) return null;
  return ((cm.value - cm.prev) / cm.prev) * 100;
}

function buildSections(b: StatsBundle): Section[] {
  const days = b.range.days;

  // ---- المجتمع ----
  const community: Section = {
    title: 'المجتمع',
    subtitle: 'الوصول والتفاعل عبر القنوات الرئيسية',
    rows: [
      {
        label: 'معدّل فتح آخر حملة',
        value: pctOrDash(b.newsletter?.lastCampaign?.openRate),
        source: b.newsletter?.lastCampaign
          ? `MailerLite — ${b.newsletter.lastCampaign.name} (${dateOrDash(b.newsletter.lastCampaign.sentAt)})`
          : 'MailerLite — لا توجد حملات مرسلة',
        alternatives: [
          {
            label: 'معدّل النقر لآخر حملة',
            value: pctOrDash(b.newsletter?.lastCampaign?.clickRate),
            source: 'MailerLite',
          },
          {
            label: 'عدد المرسَل إليهم',
            value: intOrDash(b.newsletter?.lastCampaign?.sent),
            source: 'MailerLite',
          },
          {
            label: 'فتحات فريدة',
            value: intOrDash(b.newsletter?.lastCampaign?.opens),
            source: 'MailerLite',
          },
        ],
      },
      {
        label: 'متوسط فتح النشرة (آخر 7 أيام)',
        value: b.newsletter && b.newsletter.last7Days.count > 0
          ? pctOrDash(b.newsletter.last7Days.avgOpenRate)
          : '—',
        source: b.newsletter
          ? `MailerLite — ${b.newsletter.last7Days.count} ${b.newsletter.last7Days.count === 1 ? 'حملة' : 'حملات'} في النافذة`
          : 'MailerLite',
        note:
          b.newsletter && b.newsletter.last7Days.count === 0
            ? 'لا حملات مرسلة في الأسبوع الماضي — لا يمكن حساب متوسط'
            : undefined,
        alternatives: [
          {
            label: 'متوسط النقر (آخر 7 أيام)',
            value: b.newsletter && b.newsletter.last7Days.count > 0
              ? pctOrDash(b.newsletter.last7Days.avgClickRate)
              : '—',
            source: 'MailerLite',
          },
          {
            label: 'إجمالي المرسَل في النافذة',
            value: intOrDash(b.newsletter?.last7Days.totalSent),
            source: 'MailerLite',
          },
        ],
      },
      {
        label: 'مشتركون نشطون',
        value: intOrDash(b.newsletter?.activeSubscribers),
        source: 'MailerLite — إجمالي تراكمي',
      },
      {
        label: `تفاعل المنتدى (آخر ${days} أيام)`,
        value: intOrDash(b.forum?.newPosts),
        source: 'Flarum: posts.created_at في النافذة',
        alternatives: [
          {
            label: 'نقاشات جديدة',
            value: intOrDash(b.forum?.newDiscussions),
            source: 'Flarum: discussions',
          },
          {
            label: 'أعضاء جدد',
            value: intOrDash(b.forum?.newUsers),
            source: 'Flarum: users.joined_at',
          },
          {
            label: 'مستخدمون نشطون',
            value: intOrDash(b.forum?.activeUsers),
            source: 'Flarum: users.last_seen_at',
          },
          {
            label: 'متوسط الردود/نقاش (تراكمي)',
            value:
              b.forum?.avgPostsPerDiscussion != null
                ? FMT_DEC1.format(b.forum.avgPostsPerDiscussion)
                : '—',
            source: 'Flarum',
          },
        ],
      },
      {
        label: `زيارات itqan.dev (آخر ${days} أيام)`,
        value: intOrDash(b.analytics?.pageviews.value),
        source: 'GA4: screenPageViews',
        delta: b.analytics ? deltaPct(b.analytics.pageviews) : null,
        alternatives: [
          {
            label: 'زوّار فريدون',
            value: intOrDash(b.analytics?.activeUsers.value),
            source: 'GA4: activeUsers',
          },
          {
            label: 'جلسات',
            value: intOrDash(b.analytics?.sessions.value),
            source: 'GA4: sessions',
          },
          {
            label: 'متوسط الجلسة',
            value: dur(b.analytics?.avgSessionSeconds),
            source: 'GA4: averageSessionDuration',
          },
          {
            label: 'معدّل الارتداد',
            value: pctOrDash(b.analytics?.bounceRate),
            source: 'GA4: bounceRate',
          },
        ],
      },
      {
        label: 'الوصول عبر الشبكات الاجتماعية',
        value: '—',
        source: 'LinkedIn / X / Instagram / YouTube',
        note: 'لا توجد API tokens — تتطلب رفع تقارير يدوية لاحقاً',
        manual: true,
      },
    ],
  };

  // ---- المنصة (CMS) ----
  const platform: Section = {
    title: 'المنصة (CMS)',
    subtitle: 'الناشرون والمستفيدون والمحتوى المنشور',
    rows: [
      {
        label: 'عدد الناشرين',
        value: intOrDash(b.cms?.totalPublishers),
        source: 'CMS: publishers_publisher',
        alternatives: [
          {
            label: 'الموثَّقون',
            value: intOrDash(b.cms?.verifiedPublishers),
            source: 'CMS: is_verified=true',
          },
          {
            label: 'الجدد آخر 30 يوم',
            value: intOrDash(b.cms?.newPublishers30d),
            source: 'CMS: created_at >= now-30d',
          },
          {
            label: 'الأعضاء الكلّي',
            value: intOrDash(b.cms?.totalPublisherMembers),
            source: 'CMS: publishers_publishermember',
          },
        ],
      },
      {
        label: 'عدد المستفيدين',
        value: intOrDash(b.cms?.totalUsers),
        source: 'CMS: users_user حيث is_active=true',
        alternatives: [
          {
            label: 'الجدد آخر 30 يوم',
            value: intOrDash(b.cms?.newUsers30d),
            source: 'CMS: created_at >= now-30d',
          },
          {
            label: 'مستخدمون نشطون (GA)',
            value: intOrDash(b.analytics?.activeUsers.value),
            source: `GA4: آخر ${days} أيام`,
          },
          {
            label: 'مستخدمو المنتدى',
            value: intOrDash(b.forum?.totalUsers),
            source: 'Flarum',
          },
          {
            label: 'مشتركو النشرة',
            value: intOrDash(b.newsletter?.activeSubscribers),
            source: 'MailerLite',
          },
          {
            label: 'المطوّرون',
            value: intOrDash(b.cms?.totalDevelopers),
            source: 'CMS: users_developer',
          },
        ],
      },
      {
        label: 'استهلاك المواد المنشورة',
        value: intOrDash(b.cms?.totalAssets),
        source: 'CMS: content_asset (إجمالي)',
        note:
          'هذا حجم المحتوى لا الاستهلاك الفعلي. الاستهلاك الحقيقي يتطلّب تفعيل MIXPANEL_PROJECT_ID/SERVICE_USERNAME/SERVICE_SECRET',
        alternatives: [
          {
            label: 'الجاهز للنشر',
            value: intOrDash(b.cms?.readyAssets),
            source: 'CMS: status=ready',
          },
          {
            label: 'مشاهدات تطبيقات القرآن (تراكمي)',
            value: intOrDash(b.quranApps?.totalViews),
            source: 'Quran Apps Directory',
          },
          {
            label: 'تطبيقات منشورة',
            value: intOrDash(b.quranApps?.publishedApps),
            source: 'Quran Apps Directory',
          },
        ],
      },
      {
        label: `مشاركات المجتمع (آخر ${days} أيام)`,
        value: intOrDash(
          (b.forum?.newPosts ?? 0) +
            (b.forum?.newDiscussions ?? 0) +
            (b.github?.commits ?? 0) +
            (b.github?.prsMerged ?? 0),
        ),
        source: 'مجموع: forum.newPosts + newDiscussions + GitHub.commits + prsMerged',
        alternatives: [
          {
            label: 'منتدى: ردود',
            value: intOrDash(b.forum?.newPosts),
            source: 'Flarum',
          },
          {
            label: 'منتدى: نقاشات',
            value: intOrDash(b.forum?.newDiscussions),
            source: 'Flarum',
          },
          {
            label: 'GitHub: commits',
            value: intOrDash(b.github?.commits),
            source: `${b.github?.org ?? 'org'} في النافذة`,
          },
          {
            label: 'GitHub: PRs مدمجة',
            value: intOrDash(b.github?.prsMerged),
            source: 'GitHub search',
          },
          {
            label: 'GitHub: PRs مفتوحة',
            value: intOrDash(b.github?.prsOpened),
            source: 'GitHub search',
          },
          {
            label: 'GitHub: issues',
            value: intOrDash(b.github?.issuesOpened),
            source: 'GitHub search',
          },
        ],
      },
    ],
  };

  // ---- معلومات إضافية (للتحقّق) ----
  const extras: Section = {
    title: 'مؤشرات إضافية متاحة',
    subtitle: 'بيانات لم تطلبها صراحةً لكنها متوفرة من نفس المصادر',
    rows: [
      {
        label: 'مستودعات المنظمة',
        value: intOrDash(
          (b.github?.publicRepos ?? 0) + (b.github?.privateRepos ?? 0),
        ),
        source: `GitHub orgs/${b.github?.org ?? '…'}/repos`,
        alternatives: [
          {
            label: 'عامّة',
            value: intOrDash(b.github?.publicRepos),
            source: 'GitHub',
          },
          {
            label: 'خاصة',
            value: intOrDash(b.github?.privateRepos),
            source: 'GitHub',
          },
          {
            label: 'إجمالي النجوم',
            value: intOrDash(b.github?.totalStars),
            source: 'GitHub',
          },
        ],
      },
      {
        label: 'تطبيقات القرآن',
        value: intOrDash(b.quranApps?.totalApps),
        source: 'Quran Apps Directory',
        alternatives: [
          {
            label: 'منشورة',
            value: intOrDash(b.quranApps?.publishedApps),
            source: 'apps.status=published',
          },
          {
            label: 'مميّزة',
            value: intOrDash(b.quranApps?.featuredApps),
            source: 'apps.featured=true',
          },
          {
            label: 'مطوّرون',
            value: intOrDash(b.quranApps?.totalDevelopers),
            source: 'developers',
          },
          {
            label: 'متوسط التقييم',
            value:
              b.quranApps?.avgRating != null
                ? FMT_DEC1.format(b.quranApps.avgRating)
                : '—',
            source: 'apps.avg_rating',
          },
        ],
      },
    ],
  };

  return [community, platform, extras];
}

export function StatsTable({ bundle }: { bundle: StatsBundle }) {
  const sections = buildSections(bundle);
  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <SectionBlock key={s.title} section={s} />
      ))}
    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <section
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--rule-soft)', background: 'var(--surface)' }}
    >
      <header
        className="px-4 py-3 border-b"
        style={{ borderColor: 'var(--rule-soft)' }}
      >
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--fg)' }}>
          {section.title}
        </h2>
        {section.subtitle && (
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--muted)' }}>
            {section.subtitle}
          </p>
        )}
      </header>
      <ul className="divide-y" style={{ borderColor: 'var(--rule-soft)' }}>
        {section.rows.map((row, i) => (
          <li
            key={i}
            className="px-4 py-3"
            style={{ borderColor: 'var(--rule-soft)' }}
          >
            <KpiRow row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function KpiRow({ row }: { row: Row }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div
          className="text-[13.5px] font-medium min-w-[180px]"
          style={{ color: row.manual ? 'var(--muted)' : 'var(--fg)' }}
        >
          {row.label}
        </div>
        <div
          className="text-[15px] font-semibold tabular-nums"
          style={{ color: row.manual ? 'var(--muted)' : 'var(--fg)' }}
          dir="ltr"
        >
          {row.value}
        </div>
        {typeof row.delta === 'number' && (
          <span
            className="text-[11.5px] tabular-nums px-1.5 py-0.5 rounded"
            dir="ltr"
            style={{
              color: row.delta >= 0 ? '#16a34a' : '#dc2626',
              background:
                row.delta >= 0
                  ? 'color-mix(in oklch, #16a34a 12%, transparent)'
                  : 'color-mix(in oklch, #dc2626 12%, transparent)',
            }}
          >
            {row.delta >= 0 ? '+' : ''}
            {FMT_DEC1.format(row.delta)}%
          </span>
        )}
        <div
          className="text-[12px] ms-auto"
          style={{ color: 'var(--muted)' }}
          dir="ltr"
        >
          {row.source}
        </div>
      </div>
      {row.note && (
        <div
          className="mt-1.5 text-[12px] rounded px-2 py-1 inline-block"
          style={{
            color: '#92400e',
            background: 'color-mix(in oklch, #d97706 12%, transparent)',
          }}
        >
          ⚠ {row.note}
        </div>
      )}
      {row.alternatives && row.alternatives.length > 0 && (
        <ul className="mt-2 space-y-1 ps-4">
          {row.alternatives.map((alt, i) => (
            <li
              key={i}
              className="flex flex-wrap items-baseline gap-x-3 text-[12.5px]"
              style={{ color: 'var(--muted)' }}
            >
              <span>↳ {alt.label}</span>
              <span className="font-medium tabular-nums" dir="ltr" style={{ color: 'var(--fg)' }}>
                {alt.value}
              </span>
              <span className="ms-auto" dir="ltr">{alt.source}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
