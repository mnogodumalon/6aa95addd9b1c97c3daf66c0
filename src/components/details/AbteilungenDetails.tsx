import type { Abteilungen, Mitglieder, Veranstaltungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface AbteilungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Abteilungen;
  /** N:1-Ziel „Mitglieder": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitgliederList: Mitglieder[];
  /** Klick auf die Mitglieder-Relation → overlay.push auf dessen Detail. */
  onOpenMitglieder?: (record: Mitglieder) => void;
  /** 1:N „Mitglieder" (abteilung): VOLLE Liste — der Block filtert auf diesen Record. */
  mitgliederAbteilungList: Mitglieder[];
  /** Zeilen-Klick → overlay.push auf das Mitglieder-Detail (nie der Edit-Dialog). */
  onOpenMitgliederAbteilung: (record: Mitglieder) => void;
  /** Kontextuelles „+": öffnet den Mitglieder-Dialog mit diesem Record vorgesetzt. */
  onAddMitgliederAbteilung: () => void;
  /** 1:N „Veranstaltungen" (abteilung): VOLLE Liste — der Block filtert auf diesen Record. */
  veranstaltungenList: Veranstaltungen[];
  /** Zeilen-Klick → overlay.push auf das Veranstaltungen-Detail (nie der Edit-Dialog). */
  onOpenVeranstaltungen: (record: Veranstaltungen) => void;
  /** Kontextuelles „+": öffnet den Veranstaltungen-Dialog mit diesem Record vorgesetzt. */
  onAddVeranstaltungen: () => void;
}

export function AbteilungenDetails({
  record,
  mitgliederList,
  onOpenMitglieder,
  mitgliederAbteilungList,
  onOpenMitgliederAbteilung,
  onAddMitgliederAbteilung,
  veranstaltungenList,
  onOpenVeranstaltungen,
  onAddVeranstaltungen,
}: AbteilungenDetailsProps) {
  const abteilungsleiterTarget = mitgliederList.find(r => r.record_id === extractRecordId(record.fields.abteilungsleiter));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('abteilungen', 'name')} value={record.fields.name} format="pill" />
        <RecordField label={fieldLabel('abteilungen', 'jahresbeitrag_erwachsene')} value={record.fields.jahresbeitrag_erwachsene} format="text" />
        <RecordField label={fieldLabel('abteilungen', 'jahresbeitrag_kinder')} value={record.fields.jahresbeitrag_kinder} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('abteilungen', 'abteilungsleiter')}
          name={abteilungsleiterTarget?.fields.mitgliedsnummer ?? '—'}
          meta={[abteilungsleiterTarget?.fields.email, abteilungsleiterTarget?.fields.telefon].filter(Boolean).join(' · ') || undefined}
          onClick={abteilungsleiterTarget && onOpenMitglieder ? () => onOpenMitglieder!(abteilungsleiterTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={`${appLabel('mitglieder')} · ${fieldLabel('mitglieder', 'abteilung')}`}
        items={mitgliederAbteilungList.filter(r => extractRecordId(r.fields.abteilung) === record.record_id)}
        map={r => ({ name: r.fields.mitgliedsnummer ?? appLabel('mitglieder'), meta: r.fields.geburtsdatum })}
        onOpen={onOpenMitgliederAbteilung}
        onAdd={onAddMitgliederAbteilung}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('veranstaltungen')}
        items={veranstaltungenList.filter(r => extractRecordId(r.fields.abteilung) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('veranstaltungen'), meta: r.fields.datum })}
        onOpen={onOpenVeranstaltungen}
        onAdd={onAddVeranstaltungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.ABTEILUNGEN} recordId={record.record_id} />
    </>
  );
}
