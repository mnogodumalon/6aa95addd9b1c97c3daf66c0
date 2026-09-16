/**
 * Required-field messages — WRITTEN BY THE BUILD AGENT, never by a heuristic.
 *
 * The layer knows two things about an empty required field: that it is
 * required and what its label is. Out of that it can only say „„Anreise" ist
 * ein Pflichtfeld". What the person should do instead („Bitte einen Gast
 * auswählen.") is meaning, and meaning is the agent's: the Phase-2 orchestrator
 * writes one short instruction per required field — what is needed, not why — to
 * `.intents-staging/messages.json`, the integration step validates it against
 * the app metadata and renders it into the block below. Scaffold updates keep
 * the block. Do not edit outside the markers.
 *
 * Every door reads this and nothing else: `useStepForm` (flows and public
 * pages), the generated {Entity}Dialog and the public form's server-error line.
 * A field without a sentence falls back to the label sentence — never to a
 * bare „Dieses Feld ist erforderlich".
 *
 * Required fields per entity (from the base view):
 *   - abteilungen: name (Name der Abteilung), jahresbeitrag_erwachsene (Jahresbeitrag Erwachsene (€)), jahresbeitrag_kinder (Jahresbeitrag Kinder (€))
 *   - mitglieder: mitgliedsnummer (Mitgliedsnummer), vorname (Vorname), nachname (Nachname), geburtsdatum (Geburtsdatum), eintrittsdatum (Eintrittsdatum), status (Status), beitragsklasse (Beitragsklasse), abteilung (Abteilung)
 *   - beitraege: jahr (Jahr), betrag (Betrag (€)), faellig_am (Fällig am), status (Status), mitglied (Mitglied)
 *   - veranstaltungen: titel (Titel), datum (Datum und Uhrzeit), ort (Ort), status (Status)
 *   - anmeldungen: angemeldet_am (Angemeldet am), anzahl_personen (Anzahl Personen), status (Status), veranstaltung (Veranstaltung), mitglied (Mitglied)
 *   - helferschichten: bezeichnung (Bezeichnung), beginn (Beginn), ende (Ende), benoetigte_helfer (Benötigte Helfer), veranstaltung (Veranstaltung)
 */
import { t, tx } from '@/i18n';
import { labelOf, type EntityKey } from './rules';

/** The writable fields of each entity — the keys a message may address (generated). */
export interface MessageFields {
  "abteilungen": "name" | "jahresbeitrag_erwachsene" | "jahresbeitrag_kinder" | "abteilungsleiter";
  "mitglieder": "mitgliedsnummer" | "vorname" | "nachname" | "geburtsdatum" | "email" | "telefon" | "strasse" | "hausnummer" | "plz" | "ort" | "eintrittsdatum" | "austrittsdatum" | "status" | "beitragsklasse" | "sepa_mandat" | "notizen" | "abteilung";
  "beitraege": "jahr" | "betrag" | "faellig_am" | "status" | "bezahlt_am" | "zahlungsart" | "mitglied";
  "veranstaltungen": "titel" | "beschreibung" | "datum" | "ort" | "maximale_teilnehmer" | "anmeldeschluss" | "kostenbeitrag" | "status" | "abteilung";
  "anmeldungen": "angemeldet_am" | "anzahl_personen" | "status" | "bemerkung" | "veranstaltung" | "mitglied";
  "helferschichten": "bezeichnung" | "beginn" | "ende" | "benoetigte_helfer" | "bemerkung" | "veranstaltung" | "helfer";
}
export type MessageFieldKey<E extends EntityKey> = E extends keyof MessageFields ? MessageFields[E] : never;

export const REQUIRED_MESSAGES: { [E in EntityKey]?: Partial<Record<MessageFieldKey<E>, string>> } = {
  // <custom:messages>
  abteilungen: { name: "Bitte die Abteilung auswählen.", jahresbeitrag_erwachsene: "Bitte den Jahresbeitrag für Erwachsene eingeben.", jahresbeitrag_kinder: "Bitte den Jahresbeitrag für Kinder eingeben." },
  mitglieder: { mitgliedsnummer: "Bitte die Mitgliedsnummer eingeben.", vorname: "Bitte den Vornamen eingeben.", nachname: "Bitte den Nachnamen eingeben.", geburtsdatum: "Bitte das Geburtsdatum eingeben.", eintrittsdatum: "Bitte das Eintrittsdatum eingeben.", status: "Bitte den Mitgliedsstatus wählen.", beitragsklasse: "Bitte die Beitragsklasse wählen.", abteilung: "Bitte die Abteilung des Mitglieds auswählen." },
  beitraege: { jahr: "Bitte das Beitragsjahr eingeben.", betrag: "Bitte den Beitragsbetrag eingeben.", faellig_am: "Bitte das Fälligkeitsdatum wählen.", status: "Bitte den Zahlungsstatus wählen.", mitglied: "Bitte das zugehörige Mitglied auswählen." },
  veranstaltungen: { titel: "Bitte den Titel der Veranstaltung eingeben.", datum: "Bitte Datum und Uhrzeit der Veranstaltung wählen.", ort: "Bitte den Veranstaltungsort eingeben.", status: "Bitte den Status der Veranstaltung wählen." },
  anmeldungen: { angemeldet_am: "Bitte das Anmeldedatum eingeben.", anzahl_personen: "Bitte die Anzahl der Personen angeben.", status: "Bitte den Anmeldestatus wählen.", veranstaltung: "Bitte die Veranstaltung auswählen.", mitglied: "Bitte das anzumeldende Mitglied auswählen." },
  helferschichten: { bezeichnung: "Bitte die Bezeichnung der Schicht eingeben.", beginn: "Bitte den Schichtbeginn wählen.", ende: "Bitte das Schichtende wählen.", benoetigte_helfer: "Bitte die Anzahl benötigter Helfer eingeben.", veranstaltung: "Bitte die Veranstaltung auswählen." },
  // </custom:messages>
};

/** The sentence shown when `key` of `entity` is required and empty — the
 *  agent's own text (translated at runtime like every page string), else the
 *  label sentence. Call it while rendering, not at module scope. */
export function requiredMessage(entity: EntityKey, key: string): string {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  if (own && own.trim()) return tx(own);
  return t('v_required', { label: labelOf(entity, key) });
}

/** True when the agent wrote a sentence for the field. */
export function hasOwnMessage(entity: EntityKey, key: string): boolean {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  return Boolean(own && own.trim());
}
