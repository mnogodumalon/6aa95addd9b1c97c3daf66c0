import type { EnrichedAbteilungen, EnrichedAnmeldungen, EnrichedBeitraege, EnrichedHelferschichten, EnrichedMitglieder, EnrichedVeranstaltungen } from '@/types/enriched';
import type { Abteilungen, Anmeldungen, Beitraege, Helferschichten, Mitglieder, Veranstaltungen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface AbteilungenMaps {
  mitgliederMap: Map<string, Mitglieder>;
}

export function enrichAbteilungen(
  abteilungen: Abteilungen[],
  maps: AbteilungenMaps
): EnrichedAbteilungen[] {
  return abteilungen.map(r => ({
    ...r,
    abteilungsleiterName: resolveDisplay(r.fields.abteilungsleiter, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}

interface MitgliederMaps {
  abteilungenMap: Map<string, Abteilungen>;
}

export function enrichMitglieder(
  mitglieder: Mitglieder[],
  maps: MitgliederMaps
): EnrichedMitglieder[] {
  return mitglieder.map(r => ({
    ...r,
    abteilungName: resolveDisplay(r.fields.abteilung, maps.abteilungenMap, 'name'),
  }));
}

interface BeitraegeMaps {
  mitgliederMap: Map<string, Mitglieder>;
}

export function enrichBeitraege(
  beitraege: Beitraege[],
  maps: BeitraegeMaps
): EnrichedBeitraege[] {
  return beitraege.map(r => ({
    ...r,
    mitgliedName: resolveDisplay(r.fields.mitglied, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}

interface VeranstaltungenMaps {
  abteilungenMap: Map<string, Abteilungen>;
}

export function enrichVeranstaltungen(
  veranstaltungen: Veranstaltungen[],
  maps: VeranstaltungenMaps
): EnrichedVeranstaltungen[] {
  return veranstaltungen.map(r => ({
    ...r,
    abteilungName: resolveDisplay(r.fields.abteilung, maps.abteilungenMap, 'name'),
  }));
}

interface AnmeldungenMaps {
  veranstaltungenMap: Map<string, Veranstaltungen>;
  mitgliederMap: Map<string, Mitglieder>;
}

export function enrichAnmeldungen(
  anmeldungen: Anmeldungen[],
  maps: AnmeldungenMaps
): EnrichedAnmeldungen[] {
  return anmeldungen.map(r => ({
    ...r,
    veranstaltungName: resolveDisplay(r.fields.veranstaltung, maps.veranstaltungenMap, 'titel'),
    mitgliedName: resolveDisplay(r.fields.mitglied, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}

interface HelferschichtenMaps {
  veranstaltungenMap: Map<string, Veranstaltungen>;
  mitgliederMap: Map<string, Mitglieder>;
}

export function enrichHelferschichten(
  helferschichten: Helferschichten[],
  maps: HelferschichtenMaps
): EnrichedHelferschichten[] {
  return helferschichten.map(r => ({
    ...r,
    veranstaltungName: resolveDisplay(r.fields.veranstaltung, maps.veranstaltungenMap, 'titel'),
    helferName: resolveDisplay(r.fields.helfer, maps.mitgliederMap, 'vorname', 'nachname'),
  }));
}
