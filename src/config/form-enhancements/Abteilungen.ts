import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
    'jahresbeitrag_erwachsene',
    'jahresbeitrag_kinder',
    'abteilungsleiter',
  ],
  defaults: {},
  computed: {},
  numberFields: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
