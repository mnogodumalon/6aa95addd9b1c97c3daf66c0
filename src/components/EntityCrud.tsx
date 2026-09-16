/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'abteilungen'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.abteilungen.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.abteilungen.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.abteilungen.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.abteilungen              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   abteilungen: name, jahresbeitrag_erwachsene, jahresbeitrag_kinder, abteilungsleiter  ·  → mitglieder · ← mitglieder (list + contextual +) · ← veranstaltungen (list + contextual +)
 *   mitglieder: mitgliedsnummer, vorname, nachname, geburtsdatum, email, telefon, strasse, hausnummer, …  ·  → abteilungen · ← abteilungen (list + contextual +) · ← beitraege (list + contextual +) · ← anmeldungen (list + contextual +) · ← helferschichten (list + contextual + + choose existing)
 *   beitraege: jahr, betrag, faellig_am, status, bezahlt_am, zahlungsart, mitglied  ·  → mitglieder
 *   veranstaltungen: titel, beschreibung, datum, ort, maximale_teilnehmer, anmeldeschluss, kostenbeitrag, status, …  ·  → abteilungen · ← anmeldungen (list + contextual +) · ← helferschichten (list + contextual +)
 *   anmeldungen: angemeldet_am, anzahl_personen, status, bemerkung, veranstaltung, mitglied  ·  → veranstaltungen · → mitglieder
 *   helferschichten: bezeichnung, beginn, ende, benoetigte_helfer, bemerkung, veranstaltung, helfer  ·  → veranstaltungen · → mitglieder
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Abteilungen, Mitglieder, Beitraege, Veranstaltungen, Anmeldungen, Helferschichten } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordIds } from '@/services/livingAppsService';
import { enrichAbteilungen, enrichMitglieder, enrichBeitraege, enrichVeranstaltungen, enrichAnmeldungen, enrichHelferschichten } from '@/lib/enrich';
import type { EnrichedAbteilungen, EnrichedMitglieder, EnrichedBeitraege, EnrichedVeranstaltungen, EnrichedAnmeldungen, EnrichedHelferschichten } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { AbteilungenDialog, type AbteilungenDialogDefaults } from '@/components/dialogs/AbteilungenDialog';
import { AbteilungenDetails } from '@/components/details/AbteilungenDetails';
import { MitgliederDialog, type MitgliederDialogDefaults } from '@/components/dialogs/MitgliederDialog';
import { MitgliederDetails } from '@/components/details/MitgliederDetails';
import { BeitraegeDialog, type BeitraegeDialogDefaults } from '@/components/dialogs/BeitraegeDialog';
import { BeitraegeDetails } from '@/components/details/BeitraegeDetails';
import { VeranstaltungenDialog, type VeranstaltungenDialogDefaults } from '@/components/dialogs/VeranstaltungenDialog';
import { VeranstaltungenDetails } from '@/components/details/VeranstaltungenDetails';
import { AnmeldungenDialog, type AnmeldungenDialogDefaults } from '@/components/dialogs/AnmeldungenDialog';
import { AnmeldungenDetails } from '@/components/details/AnmeldungenDetails';
import { HelferschichtenDialog, type HelferschichtenDialogDefaults } from '@/components/dialogs/HelferschichtenDialog';
import { HelferschichtenDetails } from '@/components/details/HelferschichtenDetails';
import { PickExistingDialog } from '@/components/PickExistingDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'abteilungen'; record: EnrichedAbteilungen }
  | { type: 'mitglieder'; record: EnrichedMitglieder }
  | { type: 'beitraege'; record: EnrichedBeitraege }
  | { type: 'veranstaltungen'; record: EnrichedVeranstaltungen }
  | { type: 'anmeldungen'; record: EnrichedAnmeldungen }
  | { type: 'helferschichten'; record: EnrichedHelferschichten };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  abteilungen: EntityCrudApi<Abteilungen, AbteilungenDialogDefaults>;
  mitglieder: EntityCrudApi<Mitglieder, MitgliederDialogDefaults>;
  beitraege: EntityCrudApi<Beitraege, BeitraegeDialogDefaults>;
  veranstaltungen: EntityCrudApi<Veranstaltungen, VeranstaltungenDialogDefaults>;
  anmeldungen: EntityCrudApi<Anmeldungen, AnmeldungenDialogDefaults>;
  helferschichten: EntityCrudApi<Helferschichten, HelferschichtenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { abteilungen: EnrichedAbteilungen[]; mitglieder: EnrichedMitglieder[]; beitraege: EnrichedBeitraege[]; veranstaltungen: EnrichedVeranstaltungen[]; anmeldungen: EnrichedAnmeldungen[]; helferschichten: EnrichedHelferschichten[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [abteilungenDialog, setAbteilungenDialog] = useState<{ defaults?: AbteilungenDialogDefaults; editing?: Abteilungen } | null>(null);
  const [mitgliederDialog, setMitgliederDialog] = useState<{ defaults?: MitgliederDialogDefaults; editing?: Mitglieder } | null>(null);
  const [beitraegeDialog, setBeitraegeDialog] = useState<{ defaults?: BeitraegeDialogDefaults; editing?: Beitraege } | null>(null);
  const [veranstaltungenDialog, setVeranstaltungenDialog] = useState<{ defaults?: VeranstaltungenDialogDefaults; editing?: Veranstaltungen } | null>(null);
  const [anmeldungenDialog, setAnmeldungenDialog] = useState<{ defaults?: AnmeldungenDialogDefaults; editing?: Anmeldungen } | null>(null);
  const [helferschichtenDialog, setHelferschichtenDialog] = useState<{ defaults?: HelferschichtenDialogDefaults; editing?: Helferschichten } | null>(null);
  // „Vorhandene wählen" für den Listenfeld-Rückbezug helferschichten.helfer → mitglieder: hält die Hub-record_id.
  const [pickMitgliederHelferschichten, setPickMitgliederHelferschichten] = useState<string | null>(null);
  const enrichedAbteilungen = useMemo(() => enrichAbteilungen(data.abteilungen, { mitgliederMap: data.mitgliederMap }), [data.abteilungen, data.mitgliederMap]);
  const enrichedMitglieder = useMemo(() => enrichMitglieder(data.mitglieder, { abteilungenMap: data.abteilungenMap }), [data.mitglieder, data.abteilungenMap]);
  const enrichedBeitraege = useMemo(() => enrichBeitraege(data.beitraege, { mitgliederMap: data.mitgliederMap }), [data.beitraege, data.mitgliederMap]);
  const enrichedVeranstaltungen = useMemo(() => enrichVeranstaltungen(data.veranstaltungen, { abteilungenMap: data.abteilungenMap }), [data.veranstaltungen, data.abteilungenMap]);
  const enrichedAnmeldungen = useMemo(() => enrichAnmeldungen(data.anmeldungen, { veranstaltungenMap: data.veranstaltungenMap, mitgliederMap: data.mitgliederMap }), [data.anmeldungen, data.veranstaltungenMap, data.mitgliederMap]);
  const enrichedHelferschichten = useMemo(() => enrichHelferschichten(data.helferschichten, { veranstaltungenMap: data.veranstaltungenMap, mitgliederMap: data.mitgliederMap }), [data.helferschichten, data.veranstaltungenMap, data.mitgliederMap]);

  function detailAbteilungen(record: Abteilungen, push = false) {
    const rec = enrichedAbteilungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'abteilungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAbteilungen(fields: Abteilungen['fields']) {
    const editing = abteilungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAbteilungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAbteilungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('abteilungen')} — ${t('crud_updated')}`, async () => {
        data.setAbteilungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAbteilungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAbteilungenEntry(fields);
      undoToast(`${appLabel('abteilungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailMitglieder(record: Mitglieder, push = false) {
    const rec = enrichedMitglieder.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'mitglieder', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitMitglieder(fields: Mitglieder['fields']) {
    const editing = mitgliederDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setMitglieder(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateMitgliederEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('mitglieder')} — ${t('crud_updated')}`, async () => {
        data.setMitglieder(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateMitgliederEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createMitgliederEntry(fields);
      undoToast(`${appLabel('mitglieder')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  // Link an EXISTING Helferschichten to the Mitglieder hub: append the hub URL to the
  // source's list field. Optimistic setter first, PATCH, undoToast counter-write.
  async function linkMitgliederHelferschichten(sourceId: string) {
    const hub = pickMitgliederHelferschichten;
    const src = data.helferschichten.find(r => r.record_id === sourceId);
    if (!hub || !src) return;
    const ids = extractRecordIds(src.fields.helfer);
    if (ids.includes(hub)) return;
    const next = [...ids, hub].map(id => createRecordUrl(APP_IDS.MITGLIEDER, id));
    data.setHelferschichten(list => list.map(r => (r.record_id === sourceId ? { ...r, fields: { ...r.fields, helfer: next } } : r)));
    try {
      await LivingAppsService.updateHelferschichtenEntry(sourceId, { helfer: next });
    } catch (err) {
      data.fetchAll();
      throw err;
    }
    undoToast(`${appLabel('helferschichten')} — ${t('pick_linked')}`, async () => {
      data.setHelferschichten(list => list.map(r => (r.record_id === sourceId ? src : r)));
      try { await LivingAppsService.updateHelferschichtenEntry(sourceId, { helfer: src.fields.helfer }); } catch { data.fetchAll(); }
    });
  }

  function detailBeitraege(record: Beitraege, push = false) {
    const rec = enrichedBeitraege.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'beitraege', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBeitraege(fields: Beitraege['fields']) {
    const editing = beitraegeDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBeitraege(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBeitraegeEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('beitraege')} — ${t('crud_updated')}`, async () => {
        data.setBeitraege(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBeitraegeEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBeitraegeEntry(fields);
      undoToast(`${appLabel('beitraege')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailVeranstaltungen(record: Veranstaltungen, push = false) {
    const rec = enrichedVeranstaltungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'veranstaltungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitVeranstaltungen(fields: Veranstaltungen['fields']) {
    const editing = veranstaltungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setVeranstaltungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateVeranstaltungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('veranstaltungen')} — ${t('crud_updated')}`, async () => {
        data.setVeranstaltungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateVeranstaltungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createVeranstaltungenEntry(fields);
      undoToast(`${appLabel('veranstaltungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailAnmeldungen(record: Anmeldungen, push = false) {
    const rec = enrichedAnmeldungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'anmeldungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAnmeldungen(fields: Anmeldungen['fields']) {
    const editing = anmeldungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAnmeldungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAnmeldungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('anmeldungen')} — ${t('crud_updated')}`, async () => {
        data.setAnmeldungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAnmeldungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAnmeldungenEntry(fields);
      undoToast(`${appLabel('anmeldungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailHelferschichten(record: Helferschichten, push = false) {
    const rec = enrichedHelferschichten.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'helferschichten', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitHelferschichten(fields: Helferschichten['fields']) {
    const editing = helferschichtenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setHelferschichten(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateHelferschichtenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('helferschichten')} — ${t('crud_updated')}`, async () => {
        data.setHelferschichten(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateHelferschichtenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createHelferschichtenEntry(fields);
      undoToast(`${appLabel('helferschichten')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <AbteilungenDialog
        open={abteilungenDialog !== null}
        onClose={() => setAbteilungenDialog(null)}
        onSubmit={submitAbteilungen}
        defaultValues={abteilungenDialog?.defaults}
        recordId={abteilungenDialog?.editing?.record_id}
        mitgliederList={data.mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['Abteilungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Abteilungen']}
      />
      <MitgliederDialog
        open={mitgliederDialog !== null}
        onClose={() => setMitgliederDialog(null)}
        onSubmit={submitMitglieder}
        defaultValues={mitgliederDialog?.defaults}
        recordId={mitgliederDialog?.editing?.record_id}
        abteilungenList={data.abteilungen}
        enablePhotoScan={AI_PHOTO_SCAN['Mitglieder']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Mitglieder']}
      />
      <BeitraegeDialog
        open={beitraegeDialog !== null}
        onClose={() => setBeitraegeDialog(null)}
        onSubmit={submitBeitraege}
        defaultValues={beitraegeDialog?.defaults}
        recordId={beitraegeDialog?.editing?.record_id}
        mitgliederList={data.mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['Beitraege']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Beitraege']}
      />
      <VeranstaltungenDialog
        open={veranstaltungenDialog !== null}
        onClose={() => setVeranstaltungenDialog(null)}
        onSubmit={submitVeranstaltungen}
        defaultValues={veranstaltungenDialog?.defaults}
        recordId={veranstaltungenDialog?.editing?.record_id}
        abteilungenList={data.abteilungen}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
      />
      <AnmeldungenDialog
        open={anmeldungenDialog !== null}
        onClose={() => setAnmeldungenDialog(null)}
        onSubmit={submitAnmeldungen}
        defaultValues={anmeldungenDialog?.defaults}
        recordId={anmeldungenDialog?.editing?.record_id}
        veranstaltungenList={data.veranstaltungen}
        mitgliederList={data.mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['Anmeldungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Anmeldungen']}
      />
      <HelferschichtenDialog
        open={helferschichtenDialog !== null}
        onClose={() => setHelferschichtenDialog(null)}
        onSubmit={submitHelferschichten}
        defaultValues={helferschichtenDialog?.defaults}
        recordId={helferschichtenDialog?.editing?.record_id}
        veranstaltungenList={data.veranstaltungen}
        mitgliederList={data.mitglieder}
        enablePhotoScan={AI_PHOTO_SCAN['Helferschichten']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Helferschichten']}
      />
      <PickExistingDialog
        open={pickMitgliederHelferschichten !== null}
        onClose={() => setPickMitgliederHelferschichten(null)}
        title={t('pick_title', { title: appLabel('helferschichten') })}
        items={data.helferschichten
          .filter(r => !extractRecordIds(r.fields.helfer).includes(pickMitgliederHelferschichten ?? ''))
          .map(r => ({ id: r.record_id, label: String(r.fields.bezeichnung ?? appLabel('helferschichten')), hint: r.fields.beginn ? String(r.fields.beginn) : undefined }))}
        onPick={linkMitgliederHelferschichten}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'abteilungen') {
            return (
              <>
                <RecordHeader title={appLabel('abteilungen')} subtitle={undefined} />
                <AbteilungenDetails
                  record={top.record}
                  mitgliederList={data.mitglieder}
                  onOpenMitglieder={(r) => detailMitglieder(r, true)}
                  mitgliederAbteilungList={data.mitglieder}
                  onOpenMitgliederAbteilung={(r) => detailMitglieder(r, true)}
                  onAddMitgliederAbteilung={() => setMitgliederDialog({ defaults: { abteilung: createRecordUrl(APP_IDS.ABTEILUNGEN, top.record.record_id) } })}
                  veranstaltungenList={data.veranstaltungen}
                  onOpenVeranstaltungen={(r) => detailVeranstaltungen(r, true)}
                  onAddVeranstaltungen={() => setVeranstaltungenDialog({ defaults: { abteilung: createRecordUrl(APP_IDS.ABTEILUNGEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'mitglieder') {
            return (
              <>
                <RecordHeader title={top.record.fields.mitgliedsnummer ?? appLabel('mitglieder')} subtitle={top.record.fields.geburtsdatum ? formatDate(top.record.fields.geburtsdatum) : undefined} />
                <MitgliederDetails
                  record={top.record}
                  abteilungenList={data.abteilungen}
                  onOpenAbteilungen={(r) => detailAbteilungen(r, true)}
                  abteilungenAbteilungsleiterList={data.abteilungen}
                  onOpenAbteilungenAbteilungsleiter={(r) => detailAbteilungen(r, true)}
                  onAddAbteilungenAbteilungsleiter={() => setAbteilungenDialog({ defaults: { abteilungsleiter: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                  beitraegeList={data.beitraege}
                  onOpenBeitraege={(r) => detailBeitraege(r, true)}
                  onAddBeitraege={() => setBeitraegeDialog({ defaults: { mitglied: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                  anmeldungenList={data.anmeldungen}
                  onOpenAnmeldungen={(r) => detailAnmeldungen(r, true)}
                  onAddAnmeldungen={() => setAnmeldungenDialog({ defaults: { mitglied: createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id) } })}
                  helferschichtenList={data.helferschichten}
                  onOpenHelferschichten={(r) => detailHelferschichten(r, true)}
                  onAddHelferschichten={() => setHelferschichtenDialog({ defaults: { helfer: [createRecordUrl(APP_IDS.MITGLIEDER, top.record.record_id)] } })}
                  onPickHelferschichten={() => setPickMitgliederHelferschichten(top.record.record_id)}
                />
              </>
            );
          }
          if (top.type === 'beitraege') {
            return (
              <>
                <RecordHeader title={appLabel('beitraege')} subtitle={top.record.fields.faellig_am ? formatDate(top.record.fields.faellig_am) : undefined} />
                <BeitraegeDetails
                  record={top.record}
                  mitgliederList={data.mitglieder}
                  onOpenMitglieder={(r) => detailMitglieder(r, true)}
                />
              </>
            );
          }
          if (top.type === 'veranstaltungen') {
            return (
              <>
                <RecordHeader title={top.record.fields.titel ?? appLabel('veranstaltungen')} subtitle={top.record.fields.datum ? formatDate(top.record.fields.datum) : undefined} />
                <VeranstaltungenDetails
                  record={top.record}
                  abteilungenList={data.abteilungen}
                  onOpenAbteilungen={(r) => detailAbteilungen(r, true)}
                  anmeldungenList={data.anmeldungen}
                  onOpenAnmeldungen={(r) => detailAnmeldungen(r, true)}
                  onAddAnmeldungen={() => setAnmeldungenDialog({ defaults: { veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, top.record.record_id) } })}
                  helferschichtenList={data.helferschichten}
                  onOpenHelferschichten={(r) => detailHelferschichten(r, true)}
                  onAddHelferschichten={() => setHelferschichtenDialog({ defaults: { veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'anmeldungen') {
            return (
              <>
                <RecordHeader title={appLabel('anmeldungen')} subtitle={top.record.fields.angemeldet_am ? formatDate(top.record.fields.angemeldet_am) : undefined} />
                <AnmeldungenDetails
                  record={top.record}
                  veranstaltungenList={data.veranstaltungen}
                  onOpenVeranstaltungen={(r) => detailVeranstaltungen(r, true)}
                  mitgliederList={data.mitglieder}
                  onOpenMitglieder={(r) => detailMitglieder(r, true)}
                />
              </>
            );
          }
          if (top.type === 'helferschichten') {
            return (
              <>
                <RecordHeader title={top.record.fields.bezeichnung ?? appLabel('helferschichten')} subtitle={top.record.fields.beginn ? formatDate(top.record.fields.beginn) : undefined} />
                <HelferschichtenDetails
                  record={top.record}
                  veranstaltungenList={data.veranstaltungen}
                  onOpenVeranstaltungen={(r) => detailVeranstaltungen(r, true)}
                  mitgliederList={data.mitglieder}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'abteilungen') setAbteilungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'mitglieder') setMitgliederDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'beitraege') setBeitraegeDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'veranstaltungen') setVeranstaltungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'anmeldungen') setAnmeldungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'helferschichten') setHelferschichtenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    abteilungen: {
      openCreate: (defaults?: AbteilungenDialogDefaults) => setAbteilungenDialog({ defaults }),
      openEdit: (record: Abteilungen) => setAbteilungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Abteilungen) => detailAbteilungen(record, false),
    },
    mitglieder: {
      openCreate: (defaults?: MitgliederDialogDefaults) => setMitgliederDialog({ defaults }),
      openEdit: (record: Mitglieder) => setMitgliederDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Mitglieder) => detailMitglieder(record, false),
    },
    beitraege: {
      openCreate: (defaults?: BeitraegeDialogDefaults) => setBeitraegeDialog({ defaults }),
      openEdit: (record: Beitraege) => setBeitraegeDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Beitraege) => detailBeitraege(record, false),
    },
    veranstaltungen: {
      openCreate: (defaults?: VeranstaltungenDialogDefaults) => setVeranstaltungenDialog({ defaults }),
      openEdit: (record: Veranstaltungen) => setVeranstaltungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Veranstaltungen) => detailVeranstaltungen(record, false),
    },
    anmeldungen: {
      openCreate: (defaults?: AnmeldungenDialogDefaults) => setAnmeldungenDialog({ defaults }),
      openEdit: (record: Anmeldungen) => setAnmeldungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Anmeldungen) => detailAnmeldungen(record, false),
    },
    helferschichten: {
      openCreate: (defaults?: HelferschichtenDialogDefaults) => setHelferschichtenDialog({ defaults }),
      openEdit: (record: Helferschichten) => setHelferschichtenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Helferschichten) => detailHelferschichten(record, false),
    },
    enriched: { abteilungen: enrichedAbteilungen, mitglieder: enrichedMitglieder, beitraege: enrichedBeitraege, veranstaltungen: enrichedVeranstaltungen, anmeldungen: enrichedAnmeldungen, helferschichten: enrichedHelferschichten },
  };
}
