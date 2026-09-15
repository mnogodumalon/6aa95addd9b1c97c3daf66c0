import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'mitgliedsnummer',
    { row: ['vorname', 'nachname'] },
    'geburtsdatum',
    'email',
    'telefon',
    { row: ['strasse', 'hausnummer'], cols: '2fr 1fr' },
    { row: ['plz', 'ort'], cols: '1fr 2fr' },
    'eintrittsdatum',
    'austrittsdatum',
    'status',
    'beitragsklasse',
    'sepa_mandat',
    'abteilung',
    'notizen',
  ],
  defaults: {
    eintrittsdatum: { kind: 'today' },
    status: { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
    beitragsklasse: { kind: 'lookup', key: 'erwachsener', label: 'Erwachsener' },
  },
  computed: {},
  numberFields: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
