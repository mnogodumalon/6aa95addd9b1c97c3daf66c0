import type { Helferschichten, Veranstaltungen, Mitglieder } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface HelferschichtenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Helferschichten;
  /** N:1-Ziel „Veranstaltungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  veranstaltungenList: Veranstaltungen[];
  /** Klick auf die Veranstaltungen-Relation → overlay.push auf dessen Detail. */
  onOpenVeranstaltungen?: (record: Veranstaltungen) => void;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Reserviert — Mitglieder ist hier nur über ein Mehrfach-Feld verknüpft (Text-Join, keine Einzel-Relation); Übergabe erlaubt, aber ohne Wirkung. */
  onOpenMitglieder?: (record: Mitglieder) => void;
}

export function HelferschichtenDetails({
  record,
  veranstaltungenList,
  onOpenVeranstaltungen,
  mitgliederList,
}: HelferschichtenDetailsProps) {
  const veranstaltungTarget = veranstaltungenList.find(r => r.record_id === extractRecordId(record.fields.veranstaltung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('helferschichten', 'bezeichnung')} value={record.fields.bezeichnung} format="text" />
        <RecordField label={fieldLabel('helferschichten', 'beginn')} value={record.fields.beginn} format="datetime" />
        <RecordField label={fieldLabel('helferschichten', 'ende')} value={record.fields.ende} format="datetime" />
        <RecordField label={fieldLabel('helferschichten', 'benoetigte_helfer')} value={record.fields.benoetigte_helfer} format="text" />
        <RecordField label={fieldLabel('helferschichten', 'bemerkung')} value={record.fields.bemerkung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('helferschichten', 'helfer')} value={Array.isArray(record.fields.helfer) ? record.fields.helfer.map((u: unknown) => mitgliederList.find(t => t.record_id === extractRecordId(u))?.fields.mitgliedsnummer ?? '—').join(', ') : null} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('helferschichten', 'veranstaltung')}
          name={veranstaltungTarget?.fields.titel ?? '—'}
          meta={[veranstaltungTarget?.fields.ort].filter(Boolean).join(' · ') || undefined}
          onClick={veranstaltungTarget && onOpenVeranstaltungen ? () => onOpenVeranstaltungen!(veranstaltungTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.HELFERSCHICHTEN} recordId={record.record_id} />
    </>
  );
}
