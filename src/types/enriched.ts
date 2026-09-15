import type { Abteilungen, Anmeldungen, Beitraege, Helferschichten, Mitglieder, Veranstaltungen } from './app';

export type EnrichedAbteilungen = Abteilungen & {
  abteilungsleiterName: string;
};

export type EnrichedMitglieder = Mitglieder & {
  abteilungName: string;
};

export type EnrichedBeitraege = Beitraege & {
  mitgliedName: string;
};

export type EnrichedVeranstaltungen = Veranstaltungen & {
  abteilungName: string;
};

export type EnrichedAnmeldungen = Anmeldungen & {
  veranstaltungName: string;
  mitgliedName: string;
};

export type EnrichedHelferschichten = Helferschichten & {
  veranstaltungName: string;
  helferName: string;
};
