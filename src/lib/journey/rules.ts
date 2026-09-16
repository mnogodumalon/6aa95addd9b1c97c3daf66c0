/**
 * Field rules — GENERATED from the app metadata. Do not edit.
 *
 * The mechanical truth about every field: what kind it is, whether the
 * platform's base view marks it required, which lookup keys exist, where an
 * applookup points, what the label is. `useStepForm` validates against these
 * rules and phrases its messages with the real labels; `toWirePayload` uses
 * them to shape the create payload; `SHAPES` tells a page which input FORM
 * fits the data (a date pair wants a calendar, not two fields) — it is a
 * signal, not a gate.
 */
import { appLabel, fieldLabel, lookupLabel } from '@/i18n';
import { LOOKUP_OPTIONS } from '@/types/app';

export type EntityKey = 'abteilungen' | 'mitglieder' | 'beitraege' | 'veranstaltungen' | 'anmeldungen' | 'helferschichten';

/** The text fields of each entity — what a search may run over (generated;
 *  `never` for an entity without text of its own, e.g. a link table). */
export interface StringFields {
  "abteilungen": never;
  "mitglieder": "mitgliedsnummer" | "vorname" | "nachname" | "email" | "telefon" | "strasse" | "hausnummer" | "plz" | "ort" | "notizen";
  "beitraege": never;
  "veranstaltungen": "titel" | "beschreibung" | "ort";
  "anmeldungen": "bemerkung";
  "helferschichten": "bezeichnung" | "bemerkung";
}
export type StringFieldKey<E extends EntityKey> = E extends keyof StringFields ? StringFields[E] : never;

/** The applookup fields of each entity (generated). A pick stored through
 *  `form.set` on one of these must carry its display name — at compile time
 *  (`StepForm.set`), because the review would otherwise show the id. */
export interface RecordFields {
  "abteilungen": "abteilungsleiter";
  "mitglieder": "abteilung";
  "beitraege": "mitglied";
  "veranstaltungen": "abteilung";
  "anmeldungen": "veranstaltung" | "mitglied";
  "helferschichten": "veranstaltung" | "helfer";
}
export type RecordFieldKey<E extends EntityKey> = E extends keyof RecordFields ? RecordFields[E] : never;

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'lookup'
  | 'multilookup'
  | 'record'
  | 'multirecord'
  | 'file'
  | 'geo';

export interface FieldRule {
  key: string;
  fulltype: string;
  kind: FieldKind;
  /** From the app's base view. A public page may override this per field. */
  required: boolean;
  /** Build-time label — `labelOf()` prefers the runtime i18n bundle. */
  label: string;
  /** Whether a journey may write it (`file` is upload-only, never via a journey). */
  writable: boolean;
  maxLength?: number;
  /** lookup / multilookup: the ONLY valid write values. */
  options?: string[];
  /** record / multirecord: the target app (always) and its entity key (when inside this appgroup). */
  targetAppId?: string;
  targetEntity?: EntityKey;
  format?: 'currency';
  /** HTML autocomplete token derived from the field name (given-name, email, tel, …). */
  autoComplete?: string;
}

export interface EntityInfo {
  key: EntityKey;
  appId: string;
  label: string;
  /** PascalCase plural — `get<pascal>()` on the service. */
  pascal: string;
  /** The single-record suffix — `create<single>()` on the service. */
  single: string;
}

/** Input-form signals per entity: which data shape each field (pair) has.
 *  `range`  — two date fields that form a stay/period → AvailabilityRangePicker
 *  `choice` — a lookup with few options → ChoiceGroup pills instead of a select
 *  `record` — an applookup → EntitySelectStep with search, never a raw id field
 *  `stock`  — a quantity that has a stock/capacity counterpart → show it, warn on overshoot */
export type Shape =
  | { kind: 'range'; from: string; to: string }
  | { kind: 'choice'; field: string; count: number }
  | { kind: 'record'; field: string; targetEntity?: EntityKey }
  | { kind: 'stock'; field: string };

export const ENTITIES: Record<EntityKey, EntityInfo> = {
  "abteilungen": {
    "key": "abteilungen",
    "appId": "6aa95a8cacc606abe540d51b",
    "label": "Abteilungen",
    "pascal": "Abteilungen",
    "single": "AbteilungenEntry"
  },
  "mitglieder": {
    "key": "mitglieder",
    "appId": "6aa95a95f2a4e541ade76e40",
    "label": "Mitglieder",
    "pascal": "Mitglieder",
    "single": "MitgliederEntry"
  },
  "beitraege": {
    "key": "beitraege",
    "appId": "6aa95a96e59ab89fb6c811d8",
    "label": "Beiträge",
    "pascal": "Beitraege",
    "single": "BeitraegeEntry"
  },
  "veranstaltungen": {
    "key": "veranstaltungen",
    "appId": "6aa95a979c04a57ddb5cb28d",
    "label": "Veranstaltungen",
    "pascal": "Veranstaltungen",
    "single": "VeranstaltungenEntry"
  },
  "anmeldungen": {
    "key": "anmeldungen",
    "appId": "6aa95a9820e5f397b441c6bb",
    "label": "Anmeldungen",
    "pascal": "Anmeldungen",
    "single": "AnmeldungenEntry"
  },
  "helferschichten": {
    "key": "helferschichten",
    "appId": "6aa95a99a402ee527ca028ee",
    "label": "Helferschichten",
    "pascal": "Helferschichten",
    "single": "HelferschichtenEntry"
  }
};

export const FIELD_RULES: Record<EntityKey, Record<string, FieldRule>> = {
  "abteilungen": {
    "name": {
      "key": "name",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Name der Abteilung",
      "writable": true,
      "options": [
        "fussball",
        "turnen",
        "tennis",
        "leichtathletik",
        "schach"
      ]
    },
    "jahresbeitrag_erwachsene": {
      "key": "jahresbeitrag_erwachsene",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Jahresbeitrag Erwachsene (€)",
      "writable": true,
      "format": "currency"
    },
    "jahresbeitrag_kinder": {
      "key": "jahresbeitrag_kinder",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Jahresbeitrag Kinder (€)",
      "writable": true,
      "format": "currency"
    },
    "abteilungsleiter": {
      "key": "abteilungsleiter",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Abteilungsleiter",
      "writable": true,
      "targetAppId": "6aa95a95f2a4e541ade76e40",
      "targetEntity": "mitglieder"
    }
  },
  "mitglieder": {
    "mitgliedsnummer": {
      "key": "mitgliedsnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Mitgliedsnummer",
      "writable": true,
      "maxLength": 4000
    },
    "vorname": {
      "key": "vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "nachname": {
      "key": "nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "geburtsdatum": {
      "key": "geburtsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Geburtsdatum",
      "writable": true,
      "autoComplete": "bday"
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": false,
      "label": "E-Mail",
      "writable": true,
      "autoComplete": "email"
    },
    "telefon": {
      "key": "telefon",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefon",
      "writable": true,
      "autoComplete": "tel"
    },
    "strasse": {
      "key": "strasse",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Straße",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-line1"
    },
    "hausnummer": {
      "key": "hausnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Hausnummer",
      "writable": true,
      "maxLength": 4000
    },
    "plz": {
      "key": "plz",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Postleitzahl",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "postal-code"
    },
    "ort": {
      "key": "ort",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Ort",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-level2"
    },
    "eintrittsdatum": {
      "key": "eintrittsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Eintrittsdatum",
      "writable": true
    },
    "austrittsdatum": {
      "key": "austrittsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Austrittsdatum",
      "writable": true
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "aktiv",
        "passiv",
        "ausgetreten"
      ]
    },
    "beitragsklasse": {
      "key": "beitragsklasse",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Beitragsklasse",
      "writable": true,
      "options": [
        "erwachsener",
        "kind",
        "familie",
        "ehrenmitglied"
      ]
    },
    "sepa_mandat": {
      "key": "sepa_mandat",
      "fulltype": "bool",
      "kind": "bool",
      "required": false,
      "label": "SEPA-Mandat vorhanden",
      "writable": true
    },
    "notizen": {
      "key": "notizen",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Notizen",
      "writable": true
    },
    "abteilung": {
      "key": "abteilung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Abteilung",
      "writable": true,
      "targetAppId": "6aa95a8cacc606abe540d51b",
      "targetEntity": "abteilungen"
    }
  },
  "beitraege": {
    "jahr": {
      "key": "jahr",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Jahr",
      "writable": true
    },
    "betrag": {
      "key": "betrag",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Betrag (€)",
      "writable": true,
      "format": "currency"
    },
    "faellig_am": {
      "key": "faellig_am",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Fällig am",
      "writable": true
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "offen",
        "bezahlt",
        "erlassen",
        "gemahnt"
      ]
    },
    "bezahlt_am": {
      "key": "bezahlt_am",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Bezahlt am",
      "writable": true
    },
    "zahlungsart": {
      "key": "zahlungsart",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": false,
      "label": "Zahlungsart",
      "writable": true,
      "options": [
        "lastschrift",
        "ueberweisung",
        "bar"
      ]
    },
    "mitglied": {
      "key": "mitglied",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Mitglied",
      "writable": true,
      "targetAppId": "6aa95a95f2a4e541ade76e40",
      "targetEntity": "mitglieder"
    }
  },
  "veranstaltungen": {
    "titel": {
      "key": "titel",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Titel",
      "writable": true,
      "maxLength": 4000
    },
    "beschreibung": {
      "key": "beschreibung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Beschreibung",
      "writable": true
    },
    "datum": {
      "key": "datum",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Datum und Uhrzeit",
      "writable": true
    },
    "ort": {
      "key": "ort",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Ort",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-level2"
    },
    "maximale_teilnehmer": {
      "key": "maximale_teilnehmer",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Maximale Teilnehmer",
      "writable": true
    },
    "anmeldeschluss": {
      "key": "anmeldeschluss",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Anmeldeschluss",
      "writable": true
    },
    "kostenbeitrag": {
      "key": "kostenbeitrag",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Kostenbeitrag (€)",
      "writable": true,
      "format": "currency"
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "geplant",
        "offen_anmeldung",
        "ausgebucht",
        "abgesagt",
        "durchgefuehrt"
      ]
    },
    "abteilung": {
      "key": "abteilung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Abteilung (optional)",
      "writable": true,
      "targetAppId": "6aa95a8cacc606abe540d51b",
      "targetEntity": "abteilungen"
    }
  },
  "anmeldungen": {
    "angemeldet_am": {
      "key": "angemeldet_am",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Angemeldet am",
      "writable": true
    },
    "anzahl_personen": {
      "key": "anzahl_personen",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Anzahl Personen",
      "writable": true
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "angemeldet",
        "warteliste",
        "abgemeldet",
        "teilgenommen"
      ]
    },
    "bemerkung": {
      "key": "bemerkung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Bemerkung",
      "writable": true
    },
    "veranstaltung": {
      "key": "veranstaltung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Veranstaltung",
      "writable": true,
      "targetAppId": "6aa95a979c04a57ddb5cb28d",
      "targetEntity": "veranstaltungen"
    },
    "mitglied": {
      "key": "mitglied",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Mitglied",
      "writable": true,
      "targetAppId": "6aa95a95f2a4e541ade76e40",
      "targetEntity": "mitglieder"
    }
  },
  "helferschichten": {
    "bezeichnung": {
      "key": "bezeichnung",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Bezeichnung",
      "writable": true,
      "maxLength": 4000
    },
    "beginn": {
      "key": "beginn",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Beginn",
      "writable": true
    },
    "ende": {
      "key": "ende",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Ende",
      "writable": true
    },
    "benoetigte_helfer": {
      "key": "benoetigte_helfer",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Benötigte Helfer",
      "writable": true
    },
    "bemerkung": {
      "key": "bemerkung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Bemerkung",
      "writable": true
    },
    "veranstaltung": {
      "key": "veranstaltung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Veranstaltung",
      "writable": true,
      "targetAppId": "6aa95a979c04a57ddb5cb28d",
      "targetEntity": "veranstaltungen"
    },
    "helfer": {
      "key": "helfer",
      "fulltype": "multipleapplookup/select",
      "kind": "multirecord",
      "required": false,
      "label": "Helfer",
      "writable": true,
      "targetAppId": "6aa95a95f2a4e541ade76e40",
      "targetEntity": "mitglieder"
    }
  }
};

export const SHAPES: Record<EntityKey, Shape[]> = {
  "abteilungen": [
    {
      "kind": "choice",
      "field": "name",
      "count": 5
    },
    {
      "kind": "record",
      "field": "abteilungsleiter",
      "targetEntity": "mitglieder"
    }
  ],
  "mitglieder": [
    {
      "kind": "choice",
      "field": "status",
      "count": 3
    },
    {
      "kind": "choice",
      "field": "beitragsklasse",
      "count": 4
    },
    {
      "kind": "record",
      "field": "abteilung",
      "targetEntity": "abteilungen"
    }
  ],
  "beitraege": [
    {
      "kind": "choice",
      "field": "status",
      "count": 4
    },
    {
      "kind": "choice",
      "field": "zahlungsart",
      "count": 3
    },
    {
      "kind": "record",
      "field": "mitglied",
      "targetEntity": "mitglieder"
    }
  ],
  "veranstaltungen": [
    {
      "kind": "choice",
      "field": "status",
      "count": 5
    },
    {
      "kind": "record",
      "field": "abteilung",
      "targetEntity": "abteilungen"
    }
  ],
  "anmeldungen": [
    {
      "kind": "choice",
      "field": "status",
      "count": 4
    },
    {
      "kind": "record",
      "field": "veranstaltung",
      "targetEntity": "veranstaltungen"
    },
    {
      "kind": "record",
      "field": "mitglied",
      "targetEntity": "mitglieder"
    }
  ],
  "helferschichten": [
    {
      "kind": "range",
      "from": "beginn",
      "to": "ende"
    },
    {
      "kind": "record",
      "field": "veranstaltung",
      "targetEntity": "veranstaltungen"
    },
    {
      "kind": "record",
      "field": "helfer",
      "targetEntity": "mitglieder"
    }
  ]
};

/** The fields a record of this entity is recognised by (a person: first and
 *  last name; else its title-like text field) — the same choice the dashboard's
 *  enrichment makes for `<key>Name`. `useRecordSearch` resolves an applookup to
 *  this name (`ctx.ref('gast')` in `toItem`). */
export const DISPLAY_FIELDS: Record<EntityKey, string[]> = {
  "abteilungen": [
    "name"
  ],
  "mitglieder": [
    "vorname",
    "nachname"
  ],
  "beitraege": [
    "jahr"
  ],
  "veranstaltungen": [
    "titel"
  ],
  "anmeldungen": [
    "bemerkung"
  ],
  "helferschichten": [
    "bezeichnung"
  ]
};

/** The display name of a record: its display fields joined, else the first
 *  non-empty text value, else ''. */
export function displayNameOf(entity: EntityKey, fields: Record<string, unknown>): string {
  const parts = (DISPLAY_FIELDS[entity] ?? [])
    .map(k => fields[k])
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map(v => v.trim());
  if (parts.length > 0) return parts.join(' ');
  for (const [k, rule] of Object.entries(FIELD_RULES[entity] ?? {})) {
    if (rule.kind !== 'text' && rule.kind !== 'email') continue;
    const v = fields[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

export function ruleOf(entity: EntityKey, key: string): FieldRule | undefined {
  return FIELD_RULES[entity]?.[key];
}

/** The field label as the user sees it — runtime bundle first, generated label second. */
export function labelOf(entity: EntityKey, key: string): string {
  const fromBundle = fieldLabel(entity, key);
  if (fromBundle !== key) return fromBundle;
  return ruleOf(entity, key)?.label ?? key;
}

export function entityLabel(entity: EntityKey): string {
  const fromBundle = appLabel(entity);
  if (fromBundle !== entity) return fromBundle;
  return ENTITIES[entity]?.label ?? entity;
}

/** Lookup options with runtime labels — the only legitimate source of `{key,label}` pairs. */
export function optionsOf(entity: EntityKey, key: string): Array<{ key: string; label: string }> {
  const generated = (LOOKUP_OPTIONS as Record<string, Record<string, Array<{ key: string; label: string }>>>)[entity]?.[key];
  if (generated && generated.length) return generated.map(o => ({ key: o.key, label: o.label }));
  const keys = ruleOf(entity, key)?.options ?? [];
  return keys.map(k => ({ key: k, label: lookupLabel(entity, key, k) ?? k }));
}

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object)) {
    const r = v as { from: unknown; to: unknown };
    return isEmptyValue(r.from) && isEmptyValue(r.to);
  }
  return false;
}
