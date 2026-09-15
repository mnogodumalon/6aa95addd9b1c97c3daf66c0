import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'jahr',
    'mitglied',
    'betrag',
    'faellig_am',
    'bezahlt_am',
    'status',
    'zahlungsart',
  ],
  defaults: {
    status: { kind: 'lookup', key: 'offen', label: 'Offen' },
    faellig_am: { kind: 'todayOffset', days: 14 },
  },
  computed: {},
  numberFields: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
