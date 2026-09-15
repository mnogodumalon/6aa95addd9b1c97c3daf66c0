import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Abteilungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    name?: LookupValue;
    jahresbeitrag_erwachsene?: number;
    jahresbeitrag_kinder?: number;
    abteilungsleiter?: RecordUrl; // applookup -> URL zu 'Mitglieder' Record
  };
}

export interface Mitglieder {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    mitgliedsnummer?: string;
    vorname?: string;
    nachname?: string;
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    email?: string;
    telefon?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    eintrittsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    austrittsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    beitragsklasse?: LookupValue;
    sepa_mandat?: boolean;
    notizen?: string;
    abteilung?: RecordUrl; // applookup -> URL zu 'Abteilungen' Record
  };
}

export interface Beitraege {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    jahr?: number;
    betrag?: number;
    faellig_am?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    bezahlt_am?: string; // Format: YYYY-MM-DD oder ISO String
    zahlungsart?: LookupValue;
    mitglied?: RecordUrl; // applookup -> URL zu 'Mitglieder' Record
  };
}

export interface Veranstaltungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    beschreibung?: string;
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    ort?: string;
    maximale_teilnehmer?: number;
    anmeldeschluss?: string; // Format: YYYY-MM-DD oder ISO String
    kostenbeitrag?: number;
    status?: LookupValue;
    abteilung?: RecordUrl; // applookup -> URL zu 'Abteilungen' Record
  };
}

export interface Anmeldungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    angemeldet_am?: string; // Format: YYYY-MM-DD oder ISO String
    anzahl_personen?: number;
    status?: LookupValue;
    bemerkung?: string;
    veranstaltung?: RecordUrl; // applookup -> URL zu 'Veranstaltungen' Record
    mitglied?: RecordUrl; // applookup -> URL zu 'Mitglieder' Record
  };
}

export interface Helferschichten {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    beginn?: string; // Format: YYYY-MM-DD oder ISO String
    ende?: string; // Format: YYYY-MM-DD oder ISO String
    benoetigte_helfer?: number;
    bemerkung?: string;
    veranstaltung?: RecordUrl; // applookup -> URL zu 'Veranstaltungen' Record
    helfer?: RecordUrl[];
  };
}

export const APP_IDS = {
  ABTEILUNGEN: '6aa95a8cacc606abe540d51b',
  MITGLIEDER: '6aa95a95f2a4e541ade76e40',
  BEITRAEGE: '6aa95a96e59ab89fb6c811d8',
  VERANSTALTUNGEN: '6aa95a979c04a57ddb5cb28d',
  ANMELDUNGEN: '6aa95a9820e5f397b441c6bb',
  HELFERSCHICHTEN: '6aa95a99a402ee527ca028ee',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'abteilungen': {
    name: [{ key: "fussball", get label() { return lookupLabel('abteilungen', 'name', "fussball") ?? "Fußball"; } }, { key: "turnen", get label() { return lookupLabel('abteilungen', 'name', "turnen") ?? "Turnen"; } }, { key: "tennis", get label() { return lookupLabel('abteilungen', 'name', "tennis") ?? "Tennis"; } }, { key: "leichtathletik", get label() { return lookupLabel('abteilungen', 'name', "leichtathletik") ?? "Leichtathletik"; } }, { key: "schach", get label() { return lookupLabel('abteilungen', 'name', "schach") ?? "Schach"; } }],
  },
  'mitglieder': {
    status: [{ key: "aktiv", get label() { return lookupLabel('mitglieder', 'status', "aktiv") ?? "Aktiv"; } }, { key: "passiv", get label() { return lookupLabel('mitglieder', 'status', "passiv") ?? "Passiv"; } }, { key: "ausgetreten", get label() { return lookupLabel('mitglieder', 'status', "ausgetreten") ?? "Ausgetreten"; } }],
    beitragsklasse: [{ key: "erwachsener", get label() { return lookupLabel('mitglieder', 'beitragsklasse', "erwachsener") ?? "Erwachsener"; } }, { key: "kind", get label() { return lookupLabel('mitglieder', 'beitragsklasse', "kind") ?? "Kind"; } }, { key: "familie", get label() { return lookupLabel('mitglieder', 'beitragsklasse', "familie") ?? "Familie"; } }, { key: "ehrenmitglied", get label() { return lookupLabel('mitglieder', 'beitragsklasse', "ehrenmitglied") ?? "Ehrenmitglied"; } }],
  },
  'beitraege': {
    status: [{ key: "offen", get label() { return lookupLabel('beitraege', 'status', "offen") ?? "Offen"; } }, { key: "bezahlt", get label() { return lookupLabel('beitraege', 'status', "bezahlt") ?? "Bezahlt"; } }, { key: "erlassen", get label() { return lookupLabel('beitraege', 'status', "erlassen") ?? "Erlassen"; } }, { key: "gemahnt", get label() { return lookupLabel('beitraege', 'status', "gemahnt") ?? "Gemahnt"; } }],
    zahlungsart: [{ key: "lastschrift", get label() { return lookupLabel('beitraege', 'zahlungsart', "lastschrift") ?? "Lastschrift"; } }, { key: "ueberweisung", get label() { return lookupLabel('beitraege', 'zahlungsart', "ueberweisung") ?? "Überweisung"; } }, { key: "bar", get label() { return lookupLabel('beitraege', 'zahlungsart', "bar") ?? "Bar"; } }],
  },
  'veranstaltungen': {
    status: [{ key: "geplant", get label() { return lookupLabel('veranstaltungen', 'status', "geplant") ?? "Geplant"; } }, { key: "offen_anmeldung", get label() { return lookupLabel('veranstaltungen', 'status', "offen_anmeldung") ?? "Offen für Anmeldung"; } }, { key: "ausgebucht", get label() { return lookupLabel('veranstaltungen', 'status', "ausgebucht") ?? "Ausgebucht"; } }, { key: "abgesagt", get label() { return lookupLabel('veranstaltungen', 'status', "abgesagt") ?? "Abgesagt"; } }, { key: "durchgefuehrt", get label() { return lookupLabel('veranstaltungen', 'status', "durchgefuehrt") ?? "Durchgeführt"; } }],
  },
  'anmeldungen': {
    status: [{ key: "angemeldet", get label() { return lookupLabel('anmeldungen', 'status', "angemeldet") ?? "Angemeldet"; } }, { key: "warteliste", get label() { return lookupLabel('anmeldungen', 'status', "warteliste") ?? "Warteliste"; } }, { key: "abgemeldet", get label() { return lookupLabel('anmeldungen', 'status', "abgemeldet") ?? "Abgemeldet"; } }, { key: "teilgenommen", get label() { return lookupLabel('anmeldungen', 'status', "teilgenommen") ?? "Teilgenommen"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'abteilungen': {
    'name': 'lookup/select',
    'jahresbeitrag_erwachsene': 'number',
    'jahresbeitrag_kinder': 'number',
    'abteilungsleiter': 'applookup/select',
  },
  'mitglieder': {
    'mitgliedsnummer': 'string/text',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'geburtsdatum': 'date/date',
    'email': 'string/email',
    'telefon': 'string/tel',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'eintrittsdatum': 'date/date',
    'austrittsdatum': 'date/date',
    'status': 'lookup/radio',
    'beitragsklasse': 'lookup/select',
    'sepa_mandat': 'bool',
    'notizen': 'string/textarea',
    'abteilung': 'applookup/select',
  },
  'beitraege': {
    'jahr': 'number',
    'betrag': 'number',
    'faellig_am': 'date/date',
    'status': 'lookup/select',
    'bezahlt_am': 'date/date',
    'zahlungsart': 'lookup/radio',
    'mitglied': 'applookup/select',
  },
  'veranstaltungen': {
    'titel': 'string/text',
    'beschreibung': 'string/textarea',
    'datum': 'date/datetimeminute',
    'ort': 'string/text',
    'maximale_teilnehmer': 'number',
    'anmeldeschluss': 'date/date',
    'kostenbeitrag': 'number',
    'status': 'lookup/select',
    'abteilung': 'applookup/select',
  },
  'anmeldungen': {
    'angemeldet_am': 'date/date',
    'anzahl_personen': 'number',
    'status': 'lookup/select',
    'bemerkung': 'string/textarea',
    'veranstaltung': 'applookup/select',
    'mitglied': 'applookup/select',
  },
  'helferschichten': {
    'bezeichnung': 'string/text',
    'beginn': 'date/datetimeminute',
    'ende': 'date/datetimeminute',
    'benoetigte_helfer': 'number',
    'bemerkung': 'string/textarea',
    'veranstaltung': 'applookup/select',
    'helfer': 'multipleapplookup/select',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
  'mitglieder': [
    { field: 'abteilungsleiter', entity: 'abteilungen' },
    { field: 'mitglied', entity: 'beitraege' },
    { field: 'mitglied', entity: 'anmeldungen' },
    { field: 'helfer', entity: 'helferschichten' },
  ],
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateAbteilungen = StripLookup<Abteilungen['fields']>;
export type CreateMitglieder = StripLookup<Mitglieder['fields']>;
export type CreateBeitraege = StripLookup<Beitraege['fields']>;
export type CreateVeranstaltungen = StripLookup<Veranstaltungen['fields']>;
export type CreateAnmeldungen = StripLookup<Anmeldungen['fields']>;
export type CreateHelferschichten = StripLookup<Helferschichten['fields']>;