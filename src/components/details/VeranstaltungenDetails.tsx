import type { Veranstaltungen, Abteilungen, Anmeldungen, Helferschichten } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface VeranstaltungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Veranstaltungen;
  /** N:1-Ziel „Abteilungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  abteilungenList: Abteilungen[];
  /** Klick auf die Abteilungen-Relation → overlay.push auf dessen Detail. */
  onOpenAbteilungen?: (record: Abteilungen) => void;
  /** 1:N „Anmeldungen" (veranstaltung): VOLLE Liste — der Block filtert auf diesen Record. */
  anmeldungenList: Anmeldungen[];
  /** Zeilen-Klick → overlay.push auf das Anmeldungen-Detail (nie der Edit-Dialog). */
  onOpenAnmeldungen: (record: Anmeldungen) => void;
  /** Kontextuelles „+": öffnet den Anmeldungen-Dialog mit diesem Record vorgesetzt. */
  onAddAnmeldungen: () => void;
  /** 1:N „Helferschichten" (veranstaltung): VOLLE Liste — der Block filtert auf diesen Record. */
  helferschichtenList: Helferschichten[];
  /** Zeilen-Klick → overlay.push auf das Helferschichten-Detail (nie der Edit-Dialog). */
  onOpenHelferschichten: (record: Helferschichten) => void;
  /** Kontextuelles „+": öffnet den Helferschichten-Dialog mit diesem Record vorgesetzt. */
  onAddHelferschichten: () => void;
}

export function VeranstaltungenDetails({
  record,
  abteilungenList,
  onOpenAbteilungen,
  anmeldungenList,
  onOpenAnmeldungen,
  onAddAnmeldungen,
  helferschichtenList,
  onOpenHelferschichten,
  onAddHelferschichten,
}: VeranstaltungenDetailsProps) {
  const abteilungTarget = abteilungenList.find(r => r.record_id === extractRecordId(record.fields.abteilung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('veranstaltungen', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('veranstaltungen', 'datum')} value={record.fields.datum} format="datetime" />
        <RecordField label={fieldLabel('veranstaltungen', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'maximale_teilnehmer')} value={record.fields.maximale_teilnehmer} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'anmeldeschluss')} value={record.fields.anmeldeschluss} format="date" />
        <RecordField label={fieldLabel('veranstaltungen', 'kostenbeitrag')} value={record.fields.kostenbeitrag} format="text" />
        <RecordField label={fieldLabel('veranstaltungen', 'status')} value={record.fields.status} format="pill" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('veranstaltungen', 'abteilung')}
          name={typeof abteilungTarget?.fields.name === 'object' ? abteilungTarget.fields.name.label : (abteilungTarget?.fields.name ?? '—')}
          meta={undefined}
          onClick={abteilungTarget && onOpenAbteilungen ? () => onOpenAbteilungen!(abteilungTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('anmeldungen')}
        items={anmeldungenList.filter(r => extractRecordId(r.fields.veranstaltung) === record.record_id)}
        map={r => ({ name: appLabel('anmeldungen'), meta: r.fields.angemeldet_am })}
        onOpen={onOpenAnmeldungen}
        onAdd={onAddAnmeldungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('helferschichten')}
        items={helferschichtenList.filter(r => extractRecordId(r.fields.veranstaltung) === record.record_id)}
        map={r => ({ name: r.fields.bezeichnung ?? appLabel('helferschichten'), meta: r.fields.beginn })}
        onOpen={onOpenHelferschichten}
        onAdd={onAddHelferschichten}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.VERANSTALTUNGEN} recordId={record.record_id} />
    </>
  );
}
