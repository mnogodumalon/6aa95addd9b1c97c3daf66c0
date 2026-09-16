import { useMemo, useState } from 'react';
import { format, parseISO, isBefore, isAfter, startOfDay, addDays } from 'date-fns';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { lookupKey, formatDate, formatCurrency } from '@/lib/formatters';
import { lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { CalendarWidget, CalendarSkeleton, type CalendarEvent, type CalendarTone } from '@/components/widgets/CalendarWidget';
import { dateFnsLocale } from '@/i18n';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconUsers,
  IconCreditCard,
  IconUserCheck,
  IconClipboardList,
} from '@tabler/icons-react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    mitglieder,
    beitraege,
    veranstaltungen,
    anmeldungen,
    helferschichten,
    setVeranstaltungen,
    fetchAll,
  } = data;

  const crud = useEntityCrud(data);
  const enrichedMitglieder = crud.enriched.mitglieder;
  const enrichedBeitraege = crud.enriched.beitraege;
  const enrichedVeranstaltungen = crud.enriched.veranstaltungen;
  const enrichedHelferschichten = crud.enriched.helferschichten;
  const enrichedAnmeldungen = crud.enriched.anmeldungen;

  const clock = useClock();
  const today = startOfDay(clock);
  const todayStr = format(today, 'yyyy-MM-dd');
  const in30Days = addDays(today, 30);

  const [beitraegeFilter, setBeitraegeFilter] = useState<'offen' | 'gemahnt' | null>(null);

  // Mitglieder-Kennzahlen
  const aktiveMitglieder = useMemo(
    () => mitglieder.filter(m => lookupKey(m.fields.status) === 'aktiv'),
    [mitglieder]
  );

  // Beitragsstatus
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

  // Veranstaltungen-Übersicht
  const naechsteVeranstaltungen = useMemo(
    () => veranstaltungen
      .filter(v => v.fields.datum && isAfter(parseISO(v.fields.datum), today))
      .sort((a, b) => (a.fields.datum ?? '').localeCompare(b.fields.datum ?? ''))
      .slice(0, 5),
    [veranstaltungen, today]
  );

  // Anmeldungen heute
  const anmeldungenHeute = useMemo(
    () => anmeldungen.filter(a => a.fields.angemeldet_am === todayStr),
    [anmeldungen, todayStr]
  );

  // Unbesetzte Helferschichten (zukünftige, noch nicht voll)
  const unbesetzteSchichten = useMemo(() => {
    return helferschichten.filter(s => {
      if (!s.fields.beginn) return false;
      if (isBefore(parseISO(s.fields.beginn), today)) return false;
      const benötigt = s.fields.benoetigte_helfer ?? 0;
      const vorhanden = (s.fields.helfer ?? []).length;
      return vorhanden < benötigt;
    }).sort((a, b) => (a.fields.beginn ?? '').localeCompare(b.fields.beginn ?? ''));
  }, [helferschichten, today]);

  // CalendarEvents aus Veranstaltungen
  const calEvents = useMemo<CalendarEvent[]>(
    () =>
      veranstaltungen
        .filter(v => !!v.fields.datum)
        .map(v => {
          const statusKey = lookupKey(v.fields.status) ?? '';
          let tone: CalendarTone = 'default';
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
    [veranstaltungen]
  );

  // Kalender: Veranstaltung verschieben
  const handleEventDrop = async (eventId: string, newStart: string) => {
    const rid = eventId.split(':')[1];
    if (!rid) return;
    const prev = veranstaltungen.find(v => v.record_id === rid);
    if (!prev) return;
    setVeranstaltungen(all =>
      all.map(v => v.record_id === rid ? { ...v, fields: { ...v.fields, datum: newStart } } : v)
    );
    try {
      await LivingAppsService.updateVeranstaltungenEntry(rid, { datum: newStart });
      undoToast(tx`${prev.fields.titel ?? ''} — ${tx('Datum geändert')}`, async () => {
        setVeranstaltungen(all =>
          all.map(v => v.record_id === rid ? { ...v, fields: { ...v.fields, datum: prev.fields.datum } } : v)
        );
        await LivingAppsService.updateVeranstaltungenEntry(rid, { datum: prev.fields.datum });
      });
    } catch {
      await fetchAll();
    }
  };

  // Beitrag mahnen
  const handleMahnen = async (beitragId: string) => {
    const b = enrichedBeitraege.find(x => x.record_id === beitragId);
    if (!b) return;
    const prevStatus = b.fields.status;
    const newStatus = lookupOption('beitraege', 'status', 'gemahnt');
    setBeitraegeFilter(null);
    data.setBeitraege(all =>
      all.map(x => x.record_id === beitragId ? { ...x, fields: { ...x.fields, status: newStatus } } : x)
    );
    try {
      await LivingAppsService.updateBeitraegeEntry(beitragId, { status: 'gemahnt' });
      undoToast(tx`${b.mitgliedName} — ${tx('gemahnt')}`, async () => {
        data.setBeitraege(all =>
          all.map(x => x.record_id === beitragId ? { ...x, fields: { ...x.fields, status: prevStatus } } : x)
        );
        await LivingAppsService.updateBeitraegeEntry(beitragId, { status: lookupKey(prevStatus) ?? 'offen' });
      });
    } catch {
      await fetchAll();
    }
  };

  // Beitrags-Worklist je nach Filter
  const beitraegeListItems = useMemo(() => {
    let liste = beitraegeFilter === 'gemahnt' ? gemahnteBeitraege : offeneBeitraege;
    return liste
      .sort((a, b) => (a.fields.faellig_am ?? '').localeCompare(b.fields.faellig_am ?? ''))
      .slice(0, 8)
      .map(b => {
        const istUeberfaellig = b.fields.faellig_am && isBefore(parseISO(b.fields.faellig_am), today);
        const istGemahnt = lookupKey(b.fields.status) === 'gemahnt';
        return {
          id: b.record_id,
          title: b.mitgliedName || tx('Unbekannt'),
          secondLine: (
            <>
              {istUeberfaellig ? (
                <span className="font-medium text-destructive">{tx('Überfällig')}</span>
              ) : istGemahnt ? (
                <span className="font-medium text-amber-600">{tx('Gemahnt')}</span>
              ) : (
                <span className="text-muted-foreground">{tx('Offen')}</span>
              )}
              {b.fields.faellig_am && (
                <span className="text-muted-foreground"> · {formatDate(b.fields.faellig_am)}</span>
              )}
              {b.fields.betrag != null && (
                <span className="text-muted-foreground"> · {formatCurrency(b.fields.betrag)}</span>
              )}
            </>
          ),
          action: !istGemahnt
            ? { label: tx('Mahnen'), onClick: () => handleMahnen(b.record_id) }
            : undefined,
        };
      });
  }, [beitraegeFilter, offeneBeitraege, gemahnteBeitraege, today]);

  // Helferschichten Worklist
  const schichtenListItems = useMemo(() =>
    unbesetzteSchichten.slice(0, 6).map(s => {
      const benötigt = s.fields.benoetigte_helfer ?? 0;
      const vorhanden = (s.fields.helfer ?? []).length;
      const fehlend = benötigt - vorhanden;
      const veranstaltungName = enrichedHelferschichten.find(e => e.record_id === s.record_id)?.veranstaltungName ?? '';
      return {
        id: s.record_id,
        title: s.fields.bezeichnung ?? tx('Helferschicht'),
        secondLine: (
          <>
            <span className="font-medium text-amber-600">
              {fehlend} {fehlend === 1 ? tx('Helfer fehlt') : tx('Helfer fehlen')}
            </span>
            {veranstaltungName && (
              <span className="text-muted-foreground"> · {veranstaltungName}</span>
            )}
            {s.fields.beginn && (
              <span className="text-muted-foreground"> · {formatDate(s.fields.beginn)}</span>
            )}
          </>
        ),
        action: {
          label: tx('Helfer eintragen'),
          onClick: () => crud.helferschichten.openEdit(s),
        },
      };
    }),
    [unbesetzteSchichten, enrichedHelferschichten]
  );

  // Kontext-Zeile: wer hat heute Geburtstag / wer kommt neu
  const kontextZeile = useMemo(() => {
    const heuteGeburtstag = mitglieder.filter(m => {
      if (!m.fields.geburtsdatum) return false;
      const geb = m.fields.geburtsdatum.slice(5); // MM-DD
      const heuteMMDD = todayStr.slice(5);
      return geb === heuteMMDD;
    });
    if (heuteGeburtstag.length > 0) {
      const namen_ = namen(heuteGeburtstag.map(m => [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ')));
      return tx`Geburtstag heute: ${namen_} 🎂`;
    }
    if (naechsteVeranstaltungen.length > 0) {
      const nv = naechsteVeranstaltungen[0];
      return tx`Nächste Veranstaltung: ${nv.fields.titel ?? ''} am ${formatDate(nv.fields.datum)}`;
    }
    return tx`${aktiveMitglieder.length} aktive Mitglieder im Verein`;
  }, [mitglieder, todayStr, naechsteVeranstaltungen, aktiveMitglieder]);

  // Hero: überfällige Beiträge
  const heroContent = ueberfaelligeBeitraege.length > 0 && (
    <HeroBanner
      icon={<IconAlertTriangle size={18} />}
      action={{
        label: tx('Alle mahnen'),
        onClick: () => setBeitraegeFilter('offen'),
      }}
    >
      <b>{ueberfaelligeBeitraege.length} {tx('Beiträge überfällig')}</b>
      {' — '}
      {namen(ueberfaelligeBeitraege.slice(0, 3).map(b => b.mitgliedName))}
      {ueberfaelligeBeitraege.length > 3 && tx` u. a.`}
    </HeroBanner>
  );

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{kontextZeile}</p>
        </div>
        <button
          onClick={() => crud.veranstaltungen.openCreate({})}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 shrink-0"
        >
          <IconCalendarEvent size={16} className="shrink-0" />
          {tx('Neue Veranstaltung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroContent}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Aktive Mitglieder')}
              value={aktiveMitglieder.length}
              icon={<IconUsers size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title={tx('Beiträge offen')}
              value={offeneBeitraege.length}
              icon={<IconCreditCard size={16} className="shrink-0" />}
              tone={offeneBeitraege.length > 0 ? 'warning' : 'default'}
              onClick={() => setBeitraegeFilter(f => f === 'offen' ? null : 'offen')}
              active={beitraegeFilter === 'offen'}
            />
            <StatStripItem
              title={tx('Gemahnt')}
              value={gemahnteBeitraege.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={gemahnteBeitraege.length > 0 ? 'destructive' : 'default'}
              onClick={() => setBeitraegeFilter(f => f === 'gemahnt' ? null : 'gemahnt')}
              active={beitraegeFilter === 'gemahnt'}
            />
            <StatStripItem
              title={tx('Anmeldungen heute')}
              value={anmeldungenHeute.length}
              icon={<IconUserCheck size={16} className="shrink-0" />}
              tone={anmeldungenHeute.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Schichten unbesetzt')}
              value={unbesetzteSchichten.length}
              icon={<IconClipboardList size={16} className="shrink-0" />}
              tone={unbesetzteSchichten.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calEvents}
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = ev.id.split(':')[1];
              const v = veranstaltungen.find(x => x.record_id === rid);
              if (v) crud.veranstaltungen.openDetail(v);
            }}
            onEmptyClick={date => {
              const dateStr = format(date, "yyyy-MM-dd'T'HH:mm");
              crud.veranstaltungen.openCreate({ datum: dateStr });
            }}
            onEventDrop={async (eventId, newStart) => {
              await handleEventDrop(eventId, newStart);
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={beitraegeFilter === 'gemahnt' ? appLabel('beitraege') + ' — ' + tx('Gemahnt') : appLabel('beitraege') + ' — ' + tx('Offen')}
              items={beitraegeListItems}
              onItemClick={id => {
                const b = beitraege.find(x => x.record_id === id);
                if (b) crud.beitraege.openDetail(b);
              }}
              empty={{
                text: beitraegeFilter === 'gemahnt'
                  ? tx('Keine gemahnten Beiträge.')
                  : tx('Alle Beiträge bezahlt.'),
                action: { label: tx('Beitrag erfassen'), onClick: () => crud.beitraege.openCreate({}) },
              }}
            />
            <WorkList
              title={tx('Helferschichten unbesetzt')}
              items={schichtenListItems}
              onItemClick={id => {
                const s = helferschichten.find(x => x.record_id === id);
                if (s) crud.helferschichten.openDetail(s);
              }}
              empty={{
                text: tx('Alle Schichten besetzt.'),
                action: { label: tx('Schicht anlegen'), onClick: () => crud.helferschichten.openCreate({}) },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
