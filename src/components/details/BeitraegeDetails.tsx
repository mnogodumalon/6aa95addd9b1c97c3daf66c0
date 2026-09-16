import type { Beitraege, Mitglieder } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface BeitraegeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Beitraege;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Klick auf die Mitglieder-Relation → overlay.push auf dessen Detail. */
  onOpenMitglieder?: (record: Mitglieder) => void;
}

export function BeitraegeDetails({
  record,
  mitgliederList,
  onOpenMitglieder,
}: BeitraegeDetailsProps) {
  const mitgliedTarget = mitgliederList.find(r => r.record_id === extractRecordId(record.fields.mitglied));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('beitraege', 'jahr')} value={record.fields.jahr} format="text" />
        <RecordField label={fieldLabel('beitraege', 'betrag')} value={record.fields.betrag} format="text" />
        <RecordField label={fieldLabel('beitraege', 'faellig_am')} value={record.fields.faellig_am} format="date" />
        <RecordField label={fieldLabel('beitraege', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('beitraege', 'bezahlt_am')} value={record.fields.bezahlt_am} format="date" />
        <RecordField label={fieldLabel('beitraege', 'zahlungsart')} value={record.fields.zahlungsart} format="pill" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('beitraege', 'mitglied')}
          name={mitgliedTarget?.fields.mitgliedsnummer ?? '—'}
          meta={[mitgliedTarget?.fields.email, mitgliedTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={mitgliedTarget && onOpenMitglieder ? () => onOpenMitglieder!(mitgliedTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BEITRAEGE} recordId={record.record_id} />
    </>
  );
}
