import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'veranstaltung',
    'mitglied',
    'angemeldet_am',
    'anzahl_personen',
    'status',
    'bemerkung',
  ],
  defaults: {
    angemeldet_am: { kind: 'today' },
    anzahl_personen: { kind: 'literal', value: 1 },
    status: { kind: 'lookup', key: 'angemeldet', label: 'Angemeldet' },
  },
  computed: {
    'gesamtkosten': { op: 'mul', left: { kind: 'field', key: 'anzahl_personen' }, right: { kind: 'applookup', ownKey: 'veranstaltung', lookupKey: 'kostenbeitrag' } },
  },
  numberFields: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
