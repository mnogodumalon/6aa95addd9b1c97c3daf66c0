import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay, addDays } from 'date-fns';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { dateFnsLocale } from '@/i18n';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import {
  CalendarWidget,
  CalendarSkeleton,
  useCalendar,
  type CalendarEvent,
} from '@/components/widgets/CalendarWidget';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupOption } from '@/types/app';
import {
  IconAlertCircle,
  IconUsers,
  IconCalendarEvent,
  IconCurrencyEuro,
  IconShield,
  IconUserCheck,
  IconPlus,
} from '@tabler/icons-react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    mitglieder, beitraege, veranstaltungen, anmeldungen, helferschichten,
    setVeranstaltungen, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'beitraege') {
        const b = (crud.enriched.beitraege).find(r => r.record_id === top.record.record_id);
        if (!b) return undefined;
        const key = lookupKey(b.fields.status);
        if (key === 'offen') {
          return {
            label: tx('Als bezahlt markieren'),
            onClick: () => markBezahlt(b.record_id, b),
          };
        }
        if (key === 'gemahnt') {
          return {
            label: tx('Als bezahlt markieren'),
            onClick: () => markBezahlt(b.record_id, b),
          };
        }
      }
      if (top.type === 'veranstaltungen') {
        const v = veranstaltungen.find(r => r.record_id === top.record.record_id);
        if (!v) return undefined;
        const key = lookupKey(v.fields.status);
        if (key === 'geplant') {
          return {
            label: tx('Für Anmeldung öffnen'),
            onClick: () => advanceVeranstaltung(v.record_id, 'offen_anmeldung'),
          };
        }
        if (key === 'offen_anmeldung') {
          return {
            label: tx('Als durchgeführt markieren'),
            onClick: () => advanceVeranstaltung(v.record_id, 'durchgefuehrt'),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBeitraege = crud.enriched.beitraege;
  const enrichedMitglieder = crud.enriched.mitglieder;
  const enrichedVeranstaltungen = crud.enriched.veranstaltungen;
  const enrichedHelferschichten = crud.enriched.helferschichten;

  const clock = useClock();
  const cal = useCalendar({ initialView: 'month' });
  const today = startOfDay(clock);
  const todayStr = format(today, 'yyyy-MM-dd');
  const [beitraegeFilter, setBeitraegeFilter] = useState<'offen' | null>(null);

  // --- Derived data ---
  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => lookupKey(m.fields.status) === 'aktiv'),
    [mitglieder],
  );

  const offeneBeitraege = useMemo(
    () => enrichedBeitraege.filter(b => lookupKey(b.fields.status) === 'offen' || lookupKey(b.fields.status) === 'gemahnt'),
    [enrichedBeitraege],
  );

  const ueberfaelligeBeitraege = useMemo(
    () => offeneBeitraege.filter(b => b.fields.faellig_am && b.fields.faellig_am < todayStr),
    [offeneBeitraege, todayStr],
  );

  const naechsteWocheEnde = format(addDays(today, 7), 'yyyy-MM-dd');
  const veranstaltungenDieseWoche = useMemo(
    () => veranstaltungen.filter(v => {
      if (!v.fields.datum) return false;
      const d = v.fields.datum.slice(0, 10);
      return d >= todayStr && d <= naechsteWocheEnde;
    }),
    [veranstaltungen, todayStr, naechsteWocheEnde],
  );

  const unbesetztSchichten = useMemo(
    () => helferschichten.filter(s => {
      const needed = s.fields.benoetigte_helfer ?? 0;
      const haben = (s.fields.helfer ?? []).length;
      return needed > haben;
    }),
    [helferschichten],
  );

  // --- Calendar events from Veranstaltungen ---
  const calEvents = useMemo<CalendarEvent[]>(
    () => veranstaltungen
      .filter(v => !!v.fields.datum)
      .map(v => {
        const statusKey = lookupKey(v.fields.status) ?? '';
        let tone: CalendarEvent['tone'] = 'default';
        if (statusKey === 'offen_anmeldung') tone = 'primary';
        else if (statusKey === 'ausgebucht') tone = 'warning';
        else if (statusKey === 'abgesagt') tone = 'destructive';
        else if (statusKey === 'durchgefuehrt') tone = 'success';
        return {
          id: `veranstaltung:${v.record_id}`,
          start: v.fields.datum!,
          title: v.fields.titel ?? tx('Ohne Titel'),
          subtitle: v.fields.ort,
          tone,
        };
      }),
    [veranstaltungen],
  );

  // --- Write helpers ---
  const markBezahlt = useCallback(async (recordId: string, rec: typeof enrichedBeitraege[0]) => {
    const snapshot = { ...rec.fields };
    const newFields = {
      status: lookupOption('beitraege', 'status', 'bezahlt'),
      bezahlt_am: format(clock, 'yyyy-MM-dd'),
    };
    // optimistic
    data.setBeitraege(prev =>
      prev.map(b =>
        b.record_id === recordId
          ? { ...b, fields: { ...b.fields, status: newFields.status, bezahlt_am: newFields.bezahlt_am } }
          : b,
      ),
    );
    undoToast(tx`${rec.mitgliedName || rec.record_id} — als bezahlt markiert`, async () => {
      data.setBeitraege(prev =>
        prev.map(b =>
          b.record_id === recordId
            ? { ...b, fields: { ...b.fields, ...snapshot } }
            : b,
        ),
      );
      await LivingAppsService.updateBeitraegeEntry(recordId, snapshot as any).catch(() => fetchAll());
    });
    await LivingAppsService.updateBeitraegeEntry(recordId, {
      status: 'bezahlt',
      bezahlt_am: newFields.bezahlt_am,
    }).catch(() => fetchAll());
  }, [clock, data, fetchAll]);

  const advanceVeranstaltung = useCallback(async (recordId: string, newStatus: string) => {
    const v = veranstaltungen.find(r => r.record_id === recordId);
    if (!v) return;
    const prevStatus = v.fields.status;
    setVeranstaltungen(prev =>
      prev.map(r =>
        r.record_id === recordId
          ? { ...r, fields: { ...r.fields, status: lookupOption('veranstaltungen', 'status', newStatus) } }
          : r,
      ),
    );
    undoToast(tx`${v.fields.titel ?? ''} — Status aktualisiert`, async () => {
      setVeranstaltungen(prev =>
        prev.map(r =>
          r.record_id === recordId
            ? { ...r, fields: { ...r.fields, status: prevStatus } }
            : r,
        ),
      );
      await LivingAppsService.updateVeranstaltungenEntry(recordId, { status: lookupKey(prevStatus) as any }).catch(() => fetchAll());
    });
    await LivingAppsService.updateVeranstaltungenEntry(recordId, { status: newStatus as any }).catch(() => fetchAll());
  }, [veranstaltungen, setVeranstaltungen, fetchAll]);

  // --- Greeting context line ---
  const naechsteVeranstaltung = useMemo(
    () => veranstaltungen
      .filter(v => v.fields.datum && v.fields.datum >= format(clock, "yyyy-MM-dd'T'HH:mm"))
      .sort((a, b) => (a.fields.datum ?? '').localeCompare(b.fields.datum ?? ''))[0],
    [veranstaltungen, clock],
  );

  const contextLine = useMemo(() => {
    if (ueberfaelligeBeitraege.length > 0) {
      const names = namen(ueberfaelligeBeitraege.slice(0, 3).map(b => b.mitgliedName));
      return ueberfaelligeBeitraege.length === 1
        ? tx`${names} hat einen überfälligen Beitrag.`
        : tx`${names} haben überfällige Beiträge.`;
    }
    if (naechsteVeranstaltung) {
      const titel = naechsteVeranstaltung.fields.titel ?? '';
      return tx`Nächste Veranstaltung: ${titel} am ${formatDate(naechsteVeranstaltung.fields.datum?.slice(0, 10))}.`;
    }
    return tx('Alle Beiträge sind aktuell — alles im Grünen!');
  }, [ueberfaelligeBeitraege, naechsteVeranstaltung]);

  // --- Hero: überfällige Beiträge ---
  const heroBanner = ueberfaelligeBeitraege.length > 0 && (
    <HeroBanner
      icon={<IconAlertCircle size={18} />}
      action={{
        label: tx('Mahnung markieren'),
        onClick: async () => {
          const first = ueberfaelligeBeitraege[0];
          if (!first) return;
          const snap = { ...first.fields };
          data.setBeitraege(prev =>
            prev.map(b =>
              b.record_id === first.record_id
                ? { ...b, fields: { ...b.fields, status: lookupOption('beitraege', 'status', 'gemahnt') } }
                : b,
            ),
          );
          undoToast(tx`${first.mitgliedName || ''} — als gemahnt markiert`, async () => {
            data.setBeitraege(prev =>
              prev.map(b =>
                b.record_id === first.record_id
                  ? { ...b, fields: { ...b.fields, ...snap } }
                  : b,
              ),
            );
            await LivingAppsService.updateBeitraegeEntry(first.record_id, snap as any).catch(() => fetchAll());
          });
          await LivingAppsService.updateBeitraegeEntry(first.record_id, { status: 'gemahnt' }).catch(() => fetchAll());
        },
      }}
    >
      <b>{namen(ueberfaelligeBeitraege.slice(0, 3).map(b => b.mitgliedName))}</b>
      {ueberfaelligeBeitraege.length === 1
        ? tx` — 1 überfälliger Beitrag seit ${formatDate(ueberfaelligeBeitraege[0].fields.faellig_am)}.`
        : tx` — ${String(ueberfaelligeBeitraege.length)} überfällige Beiträge.`}
    </HeroBanner>
  );

  // --- KPIs ---
  const kpis = (
    <StatStrip>
      <StatStripItem
        title={tx('Aktive Mitglieder')}
        value={aktiveMitglieder.length}
        icon={<IconUsers size={16} className="shrink-0" />}
        tone="default"
        onClick={() => crud.mitglieder.openCreate({ status: 'aktiv' })}
      />
      <StatStripItem
        title={tx('Offene Beiträge')}
        value={offeneBeitraege.length}
        icon={<IconCurrencyEuro size={16} className="shrink-0" />}
        tone={offeneBeitraege.length > 0 ? 'warning' : 'default'}
        onClick={() => setBeitraegeFilter(f => f === 'offen' ? null : 'offen')}
        active={beitraegeFilter === 'offen'}
      />
      <StatStripItem
        title={tx('Veranstaltungen diese Woche')}
        value={veranstaltungenDieseWoche.length}
        icon={<IconCalendarEvent size={16} className="shrink-0" />}
        tone={veranstaltungenDieseWoche.length > 0 ? 'primary' : 'default'}
      />
      <StatStripItem
        title={tx('Unbesetzte Schichten')}
        value={unbesetztSchichten.length}
        icon={<IconShield size={16} className="shrink-0" />}
        tone={unbesetztSchichten.length > 0 ? 'destructive' : 'default'}
      />
    </StatStrip>
  );

  // --- Primary: CalendarWidget for Veranstaltungen ---
  const primary = (
    <CalendarWidget
      events={calEvents}
      view={cal.view}
      referenceDate={cal.cursor}
      locale={dateFnsLocale()}
      onViewChange={cal.setView}
      onCursorChange={cal.setCursor}
      onEventClick={ev => {
        const rid = ev.id.split(':')[1];
        const v = veranstaltungen.find(r => r.record_id === rid);
        if (v) crud.veranstaltungen.openDetail(v);
      }}
      onEmptyClick={date => {
        crud.veranstaltungen.openCreate({
          datum: format(date, "yyyy-MM-dd'T'HH:mm"),
          status: 'geplant',
        });
      }}
    />
  );

  // --- Aside 1: Überfällige & offene Beiträge ---
  const filteredBeitraege = beitraegeFilter === 'offen'
    ? offeneBeitraege
    : ueberfaelligeBeitraege;

  const aside1 = (
    <WorkList
      title={beitraegeFilter === 'offen' ? tx('Offene Beiträge') : tx('Überfällige Beiträge')}
      items={filteredBeitraege.slice(0, 8).map(b => ({
        id: b.record_id,
        title: b.mitgliedName || tx('Unbekanntes Mitglied'),
        secondLine: (
          <>
            <span className={lookupKey(b.fields.status) === 'gemahnt' ? 'font-medium text-destructive' : 'font-medium text-amber-600'}>
              {b.fields.status?.label ?? ''}
            </span>
            {b.fields.betrag != null && (
              <span className="text-muted-foreground"> · {formatCurrency(b.fields.betrag)}</span>
            )}
            {b.fields.faellig_am && (
              <span className="text-muted-foreground"> · {tx('fällig')} {formatDate(b.fields.faellig_am)}</span>
            )}
          </>
        ),
        action: {
          label: tx('Bezahlt'),
          onClick: () => markBezahlt(b.record_id, b),
        },
      }))}
      onItemClick={id => {
        const b = enrichedBeitraege.find(r => r.record_id === id);
        if (b) crud.beitraege.openDetail(b);
      }}
      empty={{
        text: tx('Alle Beiträge sind aktuell — keine offenen Posten.'),
        action: {
          label: tx('Beitrag anlegen'),
          onClick: () => crud.beitraege.openCreate({}),
        },
      }}
    />
  );

  // --- Aside 2: Unbesetzte Helferschichten ---
  const aside2 = (
    <WorkList
      title={tx('Unbesetzte Schichten')}
      items={unbesetztSchichten.slice(0, 6).map(s => {
        const ev = veranstaltungen.find(v => {
          const rid = s.fields.veranstaltung?.match?.(/([a-f0-9]{24})$/i)?.[1];
          return rid && v.record_id === rid;
        });
        const fehlend = (s.fields.benoetigte_helfer ?? 0) - (s.fields.helfer ?? []).length;
        return {
          id: s.record_id,
          title: s.fields.bezeichnung ?? tx('Unbekannte Schicht'),
          secondLine: (
            <>
              <span className="font-medium text-destructive">{tx`${String(fehlend)} Helfer fehlen`}</span>
              {ev && <span className="text-muted-foreground"> · {ev.fields.titel}</span>}
              {s.fields.beginn && <span className="text-muted-foreground"> · {formatDate(s.fields.beginn.slice(0, 10))}</span>}
            </>
          ),
          action: {
            label: tx('Bearbeiten'),
            onClick: () => {
              const raw = helferschichten.find(r => r.record_id === s.record_id);
              if (raw) crud.helferschichten.openEdit(raw);
            },
          },
        };
      })}
      onItemClick={id => {
        const s = enrichedHelferschichten.find(r => r.record_id === id);
        if (s) crud.helferschichten.openDetail(s);
      }}
      empty={{
        text: tx('Alle Helferschichten sind vollständig besetzt.'),
        action: {
          label: tx('Schicht anlegen'),
          onClick: () => crud.helferschichten.openCreate({}),
        },
      }}
    />
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.veranstaltungen.openCreate({ status: 'geplant' })}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Veranstaltung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroBanner || undefined}
        kpis={kpis}
        primary={primary}
        aside={<>{aside1}{aside2}</>}
      />

      {crud.surfaces}
    </div>
  );
}
