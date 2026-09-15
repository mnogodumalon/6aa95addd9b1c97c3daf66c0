import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'titel',
    'datum',
    'anmeldeschluss',
    'ort',
    'maximale_teilnehmer',
    'kostenbeitrag',
    'abteilung',
    'status',
    'beschreibung',
  ],
  defaults: {
    datum: { kind: 'today', withTime: true },
    status: { kind: 'lookup', key: 'geplant', label: 'Geplant' },
  },
  computed: {},
  numberFields: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
