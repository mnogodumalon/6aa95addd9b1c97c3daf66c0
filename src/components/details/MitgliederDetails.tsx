import type { Mitglieder, Abteilungen, Beitraege, Anmeldungen, Helferschichten } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface MitgliederDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Mitglieder;
  /** N:1-Ziel „Abteilungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  abteilungenList: Abteilungen[];
  /** Klick auf die Abteilungen-Relation → overlay.push auf dessen Detail. */
  onOpenAbteilungen?: (record: Abteilungen) => void;
  /** 1:N „Abteilungen" (abteilungsleiter): VOLLE Liste — der Block filtert auf diesen Record. */
  abteilungenAbteilungsleiterList: Abteilungen[];
  /** Zeilen-Klick → overlay.push auf das Abteilungen-Detail (nie der Edit-Dialog). */
  onOpenAbteilungenAbteilungsleiter: (record: Abteilungen) => void;
  /** Kontextuelles „+": öffnet den Abteilungen-Dialog mit diesem Record vorgesetzt. */
  onAddAbteilungenAbteilungsleiter: () => void;
  /** 1:N „Beiträge" (mitglied): VOLLE Liste — der Block filtert auf diesen Record. */
  beitraegeList: Beitraege[];
  /** Zeilen-Klick → overlay.push auf das Beitraege-Detail (nie der Edit-Dialog). */
  onOpenBeitraege: (record: Beitraege) => void;
  /** Kontextuelles „+": öffnet den Beitraege-Dialog mit diesem Record vorgesetzt. */
  onAddBeitraege: () => void;
  /** 1:N „Anmeldungen" (mitglied): VOLLE Liste — der Block filtert auf diesen Record. */
  anmeldungenList: Anmeldungen[];
  /** Zeilen-Klick → overlay.push auf das Anmeldungen-Detail (nie der Edit-Dialog). */
  onOpenAnmeldungen: (record: Anmeldungen) => void;
  /** Kontextuelles „+": öffnet den Anmeldungen-Dialog mit diesem Record vorgesetzt. */
  onAddAnmeldungen: () => void;
  /** 1:N „Helferschichten" (helfer): VOLLE Liste — der Block filtert auf diesen Record. */
  helferschichtenList: Helferschichten[];
  /** Zeilen-Klick → overlay.push auf das Helferschichten-Detail (nie der Edit-Dialog). */
  onOpenHelferschichten: (record: Helferschichten) => void;
  /** Kontextuelles „+": öffnet den Helferschichten-Dialog mit diesem Record vorgesetzt. */
  onAddHelferschichten: () => void;
  /** „Vorhandene wählen": Listenfeld-Rückbezug — hängt diesen Record an einen bestehenden Helferschichten-Datensatz. */
  onPickHelferschichten?: () => void;
}

export function MitgliederDetails({
  record,
  abteilungenList,
  onOpenAbteilungen,
  abteilungenAbteilungsleiterList,
  onOpenAbteilungenAbteilungsleiter,
  onAddAbteilungenAbteilungsleiter,
  beitraegeList,
  onOpenBeitraege,
  onAddBeitraege,
  anmeldungenList,
  onOpenAnmeldungen,
  onAddAnmeldungen,
  helferschichtenList,
  onOpenHelferschichten,
  onAddHelferschichten,
  onPickHelferschichten,
}: MitgliederDetailsProps) {
  const abteilungTarget = abteilungenList.find(r => r.record_id === extractRecordId(record.fields.abteilung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('mitglieder', 'mitgliedsnummer')} value={record.fields.mitgliedsnummer} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'geburtsdatum')} value={record.fields.geburtsdatum} format="date" />
        <RecordField label={fieldLabel('mitglieder', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('mitglieder', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('mitglieder', 'eintrittsdatum')} value={record.fields.eintrittsdatum} format="date" />
        <RecordField label={fieldLabel('mitglieder', 'austrittsdatum')} value={record.fields.austrittsdatum} format="date" />
        <RecordField label={fieldLabel('mitglieder', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('mitglieder', 'beitragsklasse')} value={record.fields.beitragsklasse} format="pill" />
        <RecordField label={fieldLabel('mitglieder', 'sepa_mandat')} value={record.fields.sepa_mandat} format="bool" />
        <RecordField label={fieldLabel('mitglieder', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('mitglieder', 'abteilung')}
          name={abteilungTarget?.fields.name != null ? String(abteilungTarget.fields.name) : '—'}
          meta={undefined}
          onClick={abteilungTarget && onOpenAbteilungen ? () => onOpenAbteilungen!(abteilungTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={`${appLabel('abteilungen')} · ${fieldLabel('abteilungen', 'abteilungsleiter')}`}
        items={abteilungenAbteilungsleiterList.filter(r => extractRecordId(r.fields.abteilungsleiter) === record.record_id)}
        map={() => ({ name: appLabel('abteilungen'), meta: undefined })}
        onOpen={onOpenAbteilungenAbteilungsleiter}
        onAdd={onAddAbteilungenAbteilungsleiter}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('beitraege')}
        items={beitraegeList.filter(r => extractRecordId(r.fields.mitglied) === record.record_id)}
        map={r => ({ name: appLabel('beitraege'), meta: r.fields.faellig_am })}
        onOpen={onOpenBeitraege}
        onAdd={onAddBeitraege}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('anmeldungen')}
        items={anmeldungenList.filter(r => extractRecordId(r.fields.mitglied) === record.record_id)}
        map={r => ({ name: appLabel('anmeldungen'), meta: r.fields.angemeldet_am })}
        onOpen={onOpenAnmeldungen}
        onAdd={onAddAnmeldungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('helferschichten')}
        items={helferschichtenList.filter(r => Array.isArray(r.fields.helfer) && r.fields.helfer.some((u: unknown) => extractRecordId(u) === record.record_id))}
        map={r => ({ name: r.fields.bezeichnung ?? appLabel('helferschichten'), meta: r.fields.beginn })}
        onOpen={onOpenHelferschichten}
        onAdd={onAddHelferschichten}
        onPick={onPickHelferschichten}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.MITGLIEDER} recordId={record.record_id} />
    </>
  );
}
