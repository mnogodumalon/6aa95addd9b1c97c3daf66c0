import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'bezeichnung',
    { row: ['beginn', 'ende'] },
    'veranstaltung',
    'benoetigte_helfer',
    'helfer',
    'bemerkung',
  ],
  defaults: {
    beginn: { kind: 'today', withTime: true },
    ende: { kind: 'todayOffset', days: 0, withTime: true },
    benoetigte_helfer: { kind: 'literal', value: 1 },
  },
  computed: {},
  numberFields: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
