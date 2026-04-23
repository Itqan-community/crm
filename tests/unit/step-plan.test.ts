import { describe, it, expect } from 'vitest';
import { buildStepPlan, STEP_GROUPS } from '@/lib/step-plan';
import type { FormFieldRow, SemanticRole } from '@/types/database';

function field(
  key: string,
  position: number,
  semantic_role: SemanticRole | null = null,
): FormFieldRow {
  return {
    id: key,
    category_id: 'c1',
    key,
    kind: 'text',
    label_ar: key,
    label_en: key,
    help_ar: null,
    help_en: null,
    placeholder_ar: null,
    placeholder_en: null,
    is_required: false,
    is_multi: true,
    options: [],
    semantic_role,
    position,
    is_active: true,
    created_at: '',
    updated_at: '',
  };
}

describe('STEP_GROUPS', () => {
  it('contains the name/location and email/phone pairs', () => {
    expect(STEP_GROUPS).toContainEqual(['name', 'location']);
    expect(STEP_GROUPS).toContainEqual(['email', 'phone']);
  });
});

describe('buildStepPlan', () => {
  it('groups name + location into one step and email + phone into another', () => {
    const fields = [
      field('name', 10, 'name'),
      field('email', 20, 'email'),
      field('location', 40, 'location'),
      field('phone', 45, 'phone'),
      field('areas', 50, null),
    ];
    const plan = buildStepPlan(fields);
    expect(plan.length).toBe(3);
    expect(plan[0].map((f) => f.key)).toEqual(['name', 'location']);
    expect(plan[1].map((f) => f.key)).toEqual(['email', 'phone']);
    expect(plan[2].map((f) => f.key)).toEqual(['areas']);
  });

  it('emits a single-field step when only one member of a group is present', () => {
    // general category: name + email + phone + message (no location).
    const fields = [
      field('name', 10, 'name'),
      field('email', 20, 'email'),
      field('phone', 25, 'phone'),
      field('message', 30, null),
    ];
    const plan = buildStepPlan(fields);
    expect(plan.map((step) => step.map((f) => f.key))).toEqual([
      ['name'],
      ['email', 'phone'],
      ['message'],
    ]);
  });

  it('leaves ungrouped fields as standalone steps', () => {
    const fields = [
      field('a', 10, null),
      field('b', 20, null),
      field('c', 30, null),
    ];
    const plan = buildStepPlan(fields);
    expect(plan.length).toBe(3);
    expect(plan.flat().map((f) => f.key)).toEqual(['a', 'b', 'c']);
  });

  it('preserves position order within a grouped step', () => {
    // The `name` field is later than `location` by position; StepPlan
    // should still emit them in position order inside the step.
    const fields = [
      field('location', 10, 'location'),
      field('name', 40, 'name'),
    ];
    const plan = buildStepPlan(fields);
    expect(plan.length).toBe(1);
    expect(plan[0].map((f) => f.key)).toEqual(['location', 'name']);
  });

  it('does not duplicate a field across steps', () => {
    const fields = [
      field('name', 10, 'name'),
      field('location', 20, 'location'),
      field('email', 30, 'email'),
      field('phone', 40, 'phone'),
    ];
    const plan = buildStepPlan(fields);
    const allIds = plan.flat().map((f) => f.id);
    const unique = new Set(allIds);
    expect(unique.size).toBe(allIds.length);
    expect(unique.size).toBe(fields.length);
  });

  it('ignores unknown / null semantic roles (no group lookup fails)', () => {
    const fields = [
      field('random', 10, null),
      field('newsletter', 20, 'newsletter'), // newsletter is a role but not in STEP_GROUPS
    ];
    const plan = buildStepPlan(fields);
    expect(plan.map((s) => s.map((f) => f.key))).toEqual([
      ['random'],
      ['newsletter'],
    ]);
  });

  it('returns an empty array for an empty field list', () => {
    expect(buildStepPlan([])).toEqual([]);
  });
});
