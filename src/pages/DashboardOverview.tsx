import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useMemo, useState } from 'react';
import { format, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { CalendarWidget, type CalendarEvent, type CalendarTone } from '@/components/widgets/CalendarWidget';
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconUsers,
  IconCurrencyEuro,
  IconUserCheck,
  IconPlus,
} from '@tabler/icons-react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    mitglieder, beitraege, veranstaltungen, anmeldungen, helferschichten,
    setVeranstaltungen,
    fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'beitraege') {
        const key = lookupKey(top.record.fields.status);
        if (key === 'offen' || key === 'gemahnt') {
          return {
            label: tx('Als bezahlt markieren'),
            onClick: () => handleBeitragsZahlung(top.record),
          };
        }
      }
      if (top.type === 'anmeldungen') {
        const key = lookupKey(top.record.fields.status);
        if (key === 'angemeldet') {
          return {
            label: tx('Teilnahme bestätigen'),
            onClick: () => handleTeilnahme(top.record),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBeitraege = crud.enriched.beitraege;
  const enrichedVeranstaltungen = crud.enriched.veranstaltungen;
  const enrichedAnmeldungen = crud.enriched.anmeldungen;
  const enrichedHelferschichten = crud.enriched.helferschichten;

  const clock = useClock();
  const today = startOfDay(clock);
  const in30 = addDays(today, 30);

  const [beitragsFilter, setBeitragsFilter] = useState<'all' | 'offen' | 'gemahnt'>('all');

  // Derive status counts inside component body (locale-aware getters)
  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => lookupKey(m.fields.status) === 'aktiv'),
    [mitglieder]
  );

  const offeneBeitraege = useMemo(
    () => enrichedBeitraege.filter(b => lookupKey(b.fields.status) === 'offen'),
    [enrichedBeitraege]
  );

  const gemahnteBeitraege = useMemo(
    () => enrichedBeitraege.filter(b => lookupKey(b.fields.status) === 'gemahnt'),
    [enrichedBeitraege]
  );

  const ueberfaelligeBeitraege = useMemo(
    () => offeneBeitraege.filter(b => b.fields.faellig_am && isBefore(parseISO(b.fields.faellig_am), today)),
    [offeneBeitraege, today]
  );

  const kommende = useMemo(
    () => enrichedVeranstaltungen
      .filter(v => {
        if (!v.fields.datum) return false;
        const d = parseISO(v.fields.datum);
        return isAfter(d, today) && isBefore(d, in30);
      })
      .sort((a, b) => (a.fields.datum ?? '').localeCompare(b.fields.datum ?? '')),
    [enrichedVeranstaltungen, today, in30]
  );

  const unbesetzteSchichten = useMemo(
    () => helferschichten.filter(s => {
      const benötigt = s.fields.benoetigte_helfer ?? 0;
      const vorhanden = (s.fields.helfer ?? []).length;
      return vorhanden < benötigt;
    }),
    [helferschichten]
  );

  // Beiträge that need action, filtered
  const beitraegeMitAktion = useMemo(() => {
    if (beitragsFilter === 'gemahnt') return gemahnteBeitraege;
    if (beitragsFilter === 'offen') return offeneBeitraege;
    return [...gemahnteBeitraege, ...offeneBeitraege].sort((a, b) =>
      (a.fields.faellig_am ?? '').localeCompare(b.fields.faellig_am ?? '')
    );
  }, [beitragsFilter, offeneBeitraege, gemahnteBeitraege]);

  // Calendar events: Veranstaltungen
  const calEvents: CalendarEvent[] = useMemo(() => {
    return enrichedVeranstaltungen
      .filter(v => v.fields.datum)
      .map(v => {
        const statusKey = lookupKey(v.fields.status);
        let tone: CalendarTone = 'default';
        if (statusKey === 'offen_anmeldung') tone = 'primary';
        else if (statusKey === 'ausgebucht') tone = 'success';
        else if (statusKey === 'abgesagt') tone = 'destructive';
        else if (statusKey === 'geplant') tone = 'warning';
        return {
          id: `veranstaltung:${v.record_id}`,
          start: v.fields.datum!,
          title: v.fields.titel ?? tx('Veranstaltung'),
          subtitle: v.fields.ort,
          tone,
        };
      });
  }, [enrichedVeranstaltungen]);

  // Advance helper: Beitrag bezahlt
  async function handleBeitragsZahlung(record: typeof enrichedBeitraege[0]) {
    const snapshot = record.fields.status;
    const newStatus = lookupOption('beitraege', 'status', 'bezahlt');
    data.setBeitraege(prev => prev.map(b =>
      b.record_id === record.record_id
        ? { ...b, fields: { ...b.fields, status: newStatus, bezahlt_am: format(clock, 'yyyy-MM-dd') } }
        : b
    ));
    undoToast(
      tx`${record.mitgliedName} — Beitrag als bezahlt markiert`,
      async () => {
        data.setBeitraege(prev => prev.map(b =>
          b.record_id === record.record_id
            ? { ...b, fields: { ...b.fields, status: snapshot, bezahlt_am: record.fields.bezahlt_am } }
            : b
        ));
        await LivingAppsService.updateBeitraegeEntry(record.record_id, {
          status: lookupKey(snapshot) ?? 'offen',
          bezahlt_am: record.fields.bezahlt_am ?? undefined,
        });
      }
    );
    try {
      await LivingAppsService.updateBeitraegeEntry(record.record_id, {
        status: 'bezahlt',
        bezahlt_am: format(clock, 'yyyy-MM-dd'),
      });
    } catch {
      await fetchAll();
    }
  }

  // Advance helper: Anmeldung teilgenommen
  async function handleTeilnahme(record: typeof enrichedAnmeldungen[0]) {
    const snapshot = record.fields.status;
    const newStatus = lookupOption('anmeldungen', 'status', 'teilgenommen');
    data.setAnmeldungen(prev => prev.map(a =>
      a.record_id === record.record_id
        ? { ...a, fields: { ...a.fields, status: newStatus } }
        : a
    ));
    undoToast(
      tx`${record.mitgliedName} — Teilnahme bestätigt`,
      async () => {
        data.setAnmeldungen(prev => prev.map(a =>
          a.record_id === record.record_id
            ? { ...a, fields: { ...a.fields, status: snapshot } }
            : a
        ));
        await LivingAppsService.updateAnmeldungenEntry(record.record_id, {
          status: lookupKey(snapshot) ?? 'angemeldet',
        });
      }
    );
    try {
      await LivingAppsService.updateAnmeldungenEntry(record.record_id, { status: 'teilgenommen' });
    } catch {
      await fetchAll();
    }
  }

  // Context line: names of people attending today's events
  const contextLine = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd');
    const heuteEvents = enrichedVeranstaltungen.filter(v =>
      v.fields.datum?.startsWith(todayStr)
    );
    if (heuteEvents.length > 0) {
      const names = heuteEvents.map(v => v.fields.titel ?? '').filter(Boolean);
      return tx`Heute: ${namen(names)}`;
    }
    if (kommende.length > 0) {
      const next = kommende[0];
      return tx`Nächste Veranstaltung: ${next.fields.titel ?? ''}`;
    }
    if (gemahnteBeitraege.length > 0) {
      return tx`${gemahnteBeitraege.length} gemahnte Beiträge warten auf Bearbeitung`;
    }
    return tx`${aktiveMitglieder.length} aktive Mitglieder im Verein`;
  }, [enrichedVeranstaltungen, today, kommende, gemahnteBeitraege, aktiveMitglieder]);

  // Veranstaltung event drop: reschedule
  async function handleEventDrop(eventId: string, newStart: string) {
    const id = eventId.split(':')[1] ?? '';
    const veranstaltung = veranstaltungen.find(v => v.record_id === id);
    if (!veranstaltung) return;
    const snapshot = veranstaltung.fields.datum;
    setVeranstaltungen(prev => prev.map(v =>
      v.record_id === id ? { ...v, fields: { ...v.fields, datum: newStart } } : v
    ));
    undoToast(
      tx`${veranstaltung.fields.titel ?? ''} — verschoben`,
      async () => {
        setVeranstaltungen(prev => prev.map(v =>
          v.record_id === id ? { ...v, fields: { ...v.fields, datum: snapshot } } : v
        ));
        await LivingAppsService.updateVeranstaltungenEntry(id, { datum: snapshot ?? undefined });
      }
    );
    try {
      await LivingAppsService.updateVeranstaltungenEntry(id, { datum: newStart });
    } catch {
      await fetchAll();
    }
  }

  const totalOffenSumme = useMemo(
    () => offeneBeitraege.reduce((s, b) => s + (b.fields.betrag ?? 0), 0),
    [offeneBeitraege]
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
        <p className="text-sm text-muted-foreground">{contextLine}</p>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          gemahnteBeitraege.length > 0
            ? (
              <HeroBanner
                icon={<IconAlertCircle size={18} />}
                action={{
                  label: tx('Als bezahlt markieren'),
                  onClick: () => handleBeitragsZahlung(gemahnteBeitraege[0]),
                }}
              >
                <b>{namen(gemahnteBeitraege.map(b => b.mitgliedName))}</b>
                {' '}
                {gemahnteBeitraege.length === 1
                  ? tx`— Beitrag gemahnt. Bitte zeitnah klären.`
                  : tx`— Beiträge gemahnt. Bitte zeitnah klären.`}
              </HeroBanner>
            )
            : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Aktive Mitglieder')}
              value={aktiveMitglieder.length}
              icon={<IconUsers size={16} className="shrink-0" />}
              onClick={() => crud.mitglieder.openCreate({ status: 'aktiv' })}
            />
            <StatStripItem
              title={tx('Offene Beiträge')}
              value={offeneBeitraege.length}
              icon={<IconCurrencyEuro size={16} className="shrink-0" />}
              tone={offeneBeitraege.length > 0 ? 'warning' : 'default'}
              onClick={() => setBeitragsFilter(f => f === 'offen' ? 'all' : 'offen')}
              active={beitragsFilter === 'offen'}
            />
            <StatStripItem
              title={tx('Gemahnte Beiträge')}
              value={gemahnteBeitraege.length}
              icon={<IconAlertCircle size={16} className="shrink-0" />}
              tone={gemahnteBeitraege.length > 0 ? 'destructive' : 'default'}
              onClick={() => setBeitragsFilter(f => f === 'gemahnt' ? 'all' : 'gemahnt')}
              active={beitragsFilter === 'gemahnt'}
            />
            <StatStripItem
              title={tx('Veranstaltungen (30 Tage)')}
              value={kommende.length}
              icon={<IconCalendarEvent size={16} className="shrink-0" />}
              tone={kommende.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Unbesetzte Schichten')}
              value={unbesetzteSchichten.length}
              icon={<IconUserCheck size={16} className="shrink-0" />}
              tone={unbesetzteSchichten.length > 0 ? 'warning' : 'default'}
              onClick={() => crud.helferschichten.openCreate({})}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calEvents}
            defaultView="month"
            locale={dateFnsLocale()}
            onEventClick={(ev) => {
              const id = ev.id.split(':')[1] ?? '';
              const rec = veranstaltungen.find(v => v.record_id === id);
              if (rec) crud.veranstaltungen.openDetail(rec);
            }}
            onEmptyClick={(date) => {
              crud.veranstaltungen.openCreate({
                datum: format(date, "yyyy-MM-dd'T'HH:mm"),
                status: 'geplant',
              });
            }}
            onEventDrop={async (eventId, newStart) => {
              await handleEventDrop(eventId, newStart);
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Offene & gemahnte Beiträge')}
              items={beitraegeMitAktion.slice(0, 10).map(b => ({
                id: b.record_id,
                title: b.mitgliedName || tx('Unbekanntes Mitglied'),
                secondLine: (
                  <>
                    <span className={lookupKey(b.fields.status) === 'gemahnt'
                      ? 'font-medium text-destructive'
                      : 'font-medium text-amber-600'}>
                      {b.fields.status?.label ?? ''}
                    </span>
                    {b.fields.faellig_am && (
                      <span className="text-muted-foreground">
                        {' · '}{tx('fällig')} {formatDate(b.fields.faellig_am)}
                      </span>
                    )}
                    {b.fields.betrag != null && (
                      <span className="text-muted-foreground">
                        {' · '}{formatCurrency(b.fields.betrag)}
                      </span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Bezahlt'),
                  onClick: () => handleBeitragsZahlung(b),
                },
              }))}
              onItemClick={(id) => {
                const rec = beitraege.find(b => b.record_id === id);
                if (rec) crud.beitraege.openDetail(rec);
              }}
              empty={{
                text: totalOffenSumme === 0
                  ? tx('Alle Beiträge sind bezahlt — alles im grünen Bereich!')
                  : tx('Keine offenen Beiträge in diesem Filter.'),
                action: {
                  label: tx('Beitrag anlegen'),
                  onClick: () => crud.beitraege.openCreate({}),
                },
              }}
            />

            <WorkList
              title={tx('Nächste Veranstaltungen')}
              items={kommende.slice(0, 8).map(v => {
                const statusKey = lookupKey(v.fields.status);
                const anmeldungenFuerV = anmeldungen.filter(a => {
                  const vid = a.fields.veranstaltung?.match(/([a-f0-9]{24})$/i)?.[1];
                  return vid === v.record_id;
                });
                const teilnehmer = anmeldungenFuerV.filter(a => lookupKey(a.fields.status) === 'angemeldet').length;
                const max = v.fields.maximale_teilnehmer;
                return {
                  id: v.record_id,
                  title: v.fields.titel ?? tx('Veranstaltung'),
                  secondLine: (
                    <>
                      <span className={
                        statusKey === 'offen_anmeldung' ? 'font-medium text-primary' :
                        statusKey === 'ausgebucht' ? 'font-medium text-emerald-600' :
                        statusKey === 'abgesagt' ? 'font-medium text-destructive' :
                        'font-medium text-muted-foreground'
                      }>
                        {v.fields.status?.label ?? ''}
                      </span>
                      <span className="text-muted-foreground">
                        {' · '}{formatDate(v.fields.datum)}
                      </span>
                      {max != null && (
                        <span className="text-muted-foreground">
                          {' · '}{teilnehmer}/{max}
                        </span>
                      )}
                    </>
                  ),
                  action: statusKey === 'geplant' ? {
                    label: tx('Anmeldung öffnen'),
                    onClick: async () => {
                      const snap = v.fields.status;
                      const newStatus = lookupOption('veranstaltungen', 'status', 'offen_anmeldung');
                      setVeranstaltungen(prev => prev.map(ev =>
                        ev.record_id === v.record_id
                          ? { ...ev, fields: { ...ev.fields, status: newStatus } }
                          : ev
                      ));
                      undoToast(
                        tx`${v.fields.titel ?? ''} — Anmeldung geöffnet`,
                        async () => {
                          setVeranstaltungen(prev => prev.map(ev =>
                            ev.record_id === v.record_id
                              ? { ...ev, fields: { ...ev.fields, status: snap } }
                              : ev
                          ));
                          await LivingAppsService.updateVeranstaltungenEntry(v.record_id, {
                            status: lookupKey(snap) ?? 'geplant',
                          });
                        }
                      );
                      try {
                        await LivingAppsService.updateVeranstaltungenEntry(v.record_id, { status: 'offen_anmeldung' });
                      } catch {
                        await fetchAll();
                      }
                    },
                  } : undefined,
                };
              })}
              onItemClick={(id) => {
                const rec = veranstaltungen.find(v => v.record_id === id);
                if (rec) crud.veranstaltungen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine Veranstaltungen in den nächsten 30 Tagen.'),
                action: {
                  label: tx('Veranstaltung anlegen'),
                  onClick: () => crud.veranstaltungen.openCreate({ status: 'geplant' }),
                },
              }}
            />
          </>
        }
      />

      {/* Empty state: zero members */}
      {mitglieder.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <IconUsers size={48} className="text-muted-foreground" stroke={1.5} />
          <div>
            <h2 className="font-semibold text-lg mb-1">{tx('Willkommen beim TSV Hallstadt!')}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {tx('Lege das erste Mitglied an, um loszulegen.')}
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => crud.mitglieder.openCreate({ status: 'aktiv' })}
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Erstes Mitglied aufnehmen')}
          </button>
        </div>
      )}

      {crud.surfaces}
    </div>
  );
}
