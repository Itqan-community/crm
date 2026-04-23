import type { FormFieldRow, SemanticRole } from '@/types/database';

// Semantic roles that should render together as one "page". Order within
// a rendered step follows each field's DB `position`, not the order here.
// Fields whose `semantic_role` is null or not listed stay standalone.
//
// Why hard-coded: the admin only needs two specific groupings today, and
// the pairs are purely presentational (no data schema change). If admin
// flexibility is later needed we'd move to a `step_group` column on
// form_fields; the `buildStepPlan` contract would not change.
export const STEP_GROUPS: SemanticRole[][] = [
  ['name', 'location'],
  ['email', 'phone'],
];

// Group the incoming (sorted-by-position) fields into virtual "steps". A
// step is one or more FormFieldRow objects that share a STEP_GROUPS entry.
// Every field appears in exactly one step. Fields outside any group are
// standalone single-field steps.
export function buildStepPlan(fields: FormFieldRow[]): FormFieldRow[][] {
  const sorted = [...fields].sort((a, b) => a.position - b.position);
  const consumed = new Set<string>();
  const steps: FormFieldRow[][] = [];

  for (const field of sorted) {
    if (consumed.has(field.id)) continue;

    const group = findGroupFor(field.semantic_role);
    if (!group) {
      steps.push([field]);
      consumed.add(field.id);
      continue;
    }

    // Collect siblings present in this category that belong to the same
    // group; keep them in `sorted` (position) order.
    const siblings = sorted.filter(
      (f) => f.semantic_role != null && group.includes(f.semantic_role as SemanticRole),
    );
    steps.push(siblings);
    for (const f of siblings) consumed.add(f.id);
  }

  return steps;
}

function findGroupFor(role: SemanticRole | null): SemanticRole[] | undefined {
  if (!role) return undefined;
  return STEP_GROUPS.find((g) => g.includes(role));
}
