/**
 * Jahresbeiträge erzeugen — 4-Schritt-Wizard.
 * Steps: 1) Jahr & Fälligkeit wählen → 2) Vorschau der betroffenen Mitglieder → 3) Zusammenfassung → 4) Erfolg.
 * Reads: mitglieder (aktiv), beitraege (bestehendes Jahr), abteilungen (Beitragsberechnung).
 * Writes: beitraege (createBeitraegeEntry) — je ein Datensatz pro Mitglied ohne bestehenden Beitrag.
 * Composes: IntentWizardShell, WizardStep, StepNav, SummaryStep, SuccessStep, ChoiceGroup, Field, Bound.
 */
import { useMemo, useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldLookup, fieldNumber, fieldRef, todayIso } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { format, parseISO } from 'date-fns';
import { IconAlertCircle, IconCheck, IconCoins } from '@tabler/icons-react';

// Berechnet den Beitrag eines Mitglieds anhand Beitragsklasse und Abteilungs-Jahresbeitrag
function berechneBetragsklasseBetrag(
  beitragsklasse: string | null,
  jahresbeitragErwachsene: number | null,
  jahresbeitragKinder: number | null,
): number {
  if (beitragsklasse === 'ehrenmitglied') return 0;
  if (beitragsklasse === 'kind') return jahresbeitragKinder ?? 0;
  // 'erwachsener' | 'familie' | Fallback
  return jahresbeitragErwachsene ?? 0;
}

function formatCurrencyDE(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function JahresbeitraegeErzeugenPage() {
  const [step, setStep] = useState(1);

  // Aktuelles Jahr als Vorschlag
  const currentYear = new Date().getFullYear();
  const defaultFaelligAm = `${currentYear}-01-31`;

  // Schritt-1-Formular: Jahr, Fälligkeit, Status
  const jahresForm = useStepForm('beitraege', {
    fields: ['jahr', 'faellig_am', 'status'],
    steps: { jahr: 1, faellig_am: 1, status: 1 },
    required: { mitglied: false, betrag: false },
    initial: {
      jahr: String(currentYear),
      faellig_am: defaultFaelligAm,
      status: 'offen',
    },
  });

  // Mitglieder (nur aktiv) laden
  const mitglieder = useRecordSearch(servicePort, 'mitglieder', {
    filter: "r.v_status == 'aktiv'", /* i18n-exempt */
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    searchFields: ['vorname', 'nachname', 'mitgliedsnummer'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldText(m, 'mitgliedsnummer'),
    }),
  });

  // Bestehende Beiträge für das gewählte Jahr laden
  const selectedJahr = jahresForm.get('jahr') as string | undefined;
  const jahrNumber = selectedJahr ? parseInt(selectedJahr, 10) : null;

  const bestehendeBeitraege = useRecordSearch(servicePort, 'beitraege', {
    filter: jahrNumber ? `r.v_jahr == ${jahrNumber}` : undefined,
    where: jahrNumber ? r => fieldNumber(r, 'jahr') === jahrNumber : () => false,
    searchFields: [],
  });

  // Abteilungen für Betragsberechnung laden
  const abteilungen = useRecordSearch(servicePort, 'abteilungen', {
    searchFields: [],
  });

  // Berechnung: Welche Mitglieder bekommen neuen Beitrag
  const vorschauDaten = useMemo(() => {
    if (!jahrNumber) return [];

    // Mitglieder-IDs die bereits einen Beitrag haben
    const bereitsVorhanden = new Set<string>();
    for (const b of bestehendeBeitraege.records) {
      const mitgliedId = fieldRef(b, 'mitglied');
      if (mitgliedId) bereitsVorhanden.add(mitgliedId);
    }

    // Abteilungs-Map aufbauen
    const abteilungMap = new Map<string, { erwachsene: number | null; kinder: number | null }>();
    for (const abt of abteilungen.records) {
      abteilungMap.set(abt.id, {
        erwachsene: fieldNumber(abt, 'jahresbeitrag_erwachsene'),
        kinder: fieldNumber(abt, 'jahresbeitrag_kinder'),
      });
    }

    return mitglieder.records.map(m => {
      const abteilungId = fieldRef(m, 'abteilung');
      const abtDaten = abteilungId ? abteilungMap.get(abteilungId) : undefined;
      const beitragsklasse = fieldLookup(m, 'beitragsklasse')?.key ?? null;
      const betrag = berechneBetragsklasseBetrag(
        beitragsklasse,
        abtDaten?.erwachsene ?? null,
        abtDaten?.kinder ?? null,
      );
      const vorname = fieldText(m, 'vorname');
      const nachname = fieldText(m, 'nachname');
      const abteilungLabel = abteilungId
        ? abteilungen.refLabel(m, 'abteilung') ?? abteilungId
        : tx('Keine Abteilung');
      const beitragsklasseLabel = fieldLookup(m, 'beitragsklasse')?.label ?? '—';
      const vorhanden = bereitsVorhanden.has(m.id);

      return {
        mitgliedId: m.id,
        name: `${vorname} ${nachname}`.trim(),
        abteilung: abteilungLabel,
        beitragsklasse: beitragsklasseLabel,
        betrag,
        vorhanden,
      };
    });
  }, [mitglieder.records, bestehendeBeitraege.records, abteilungen.records, jahrNumber, abteilungen]);

  const neueBeitraege = useMemo(() => vorschauDaten.filter(v => !v.vorhanden), [vorschauDaten]);
  const gesamtSumme = useMemo(() => neueBeitraege.reduce((sum, v) => sum + v.betrag, 0), [neueBeitraege]);

  // Plan: Für jedes neue Mitglied einen Beitrag anlegen
  const faelligAm = jahresForm.get('faellig_am') as string | undefined;
  const statusKey = jahresForm.get('status') as string | undefined;

  const plan = useMemo(() => {
    if (neueBeitraege.length === 0) return [];
    return neueBeitraege.map((entry, idx) => ({
      key: `beitrag-${entry.mitgliedId}`,
      label: entry.name,
      entity: 'beitraege' as const,
      primary: idx === 0,
      values: {
        mitglied: entry.mitgliedId,
        jahr: jahrNumber,
        betrag: entry.betrag,
        faellig_am: faelligAm,
        status: statusKey ?? 'offen',
      },
    }));
  }, [neueBeitraege, jahrNumber, faelligAm, statusKey]);

  const submit = useJourneySubmit(servicePort, plan, {
    draftKey: 'jahresbeitraege-erzeugen',
  });

  const isVorschauReady =
    !mitglieder.select.loading &&
    !bestehendeBeitraege.select.loading &&
    !abteilungen.select.loading;

  return (
    <IntentWizardShell
      title={tx('Jahresbeiträge erzeugen')}
      subtitle={tx('Beiträge für alle aktiven Mitglieder anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[jahresForm]}
      draftKey="jahresbeitraege-erzeugen"
      intro={{
        description: tx('Für alle aktiven Mitglieder genau einen Jahresbeitrag anlegen — vorhandene werden übersprungen.'),
        needs: [tx('Beitragsjahr'), tx('Fälligkeitsdatum')],
      }}
    >
      {/* Schritt 1: Jahr und Fälligkeit */}
      <WizardStep
        label={tx('Jahr')}
        description={tx('Jahr, Fälligkeitsdatum und Anfangsstatus für die Beiträge festlegen.')}
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {tx('Beiträge werden pro Abteilung aus dem dort hinterlegten Jahresbeitrag errechnet — Erwachsene und Kinder getrennt. Mitglieder mit Beitragsklasse Ehrenmitglied erhalten einen Beitrag von 0 EUR.')}
          </div>
          <Bound form={jahresForm} name="jahr" hint={tx('z. B. 2026')} />
          <Bound form={jahresForm} name="faellig_am" hint={tx('z. B. 31.01. des gewählten Jahres')} />
          <Bound form={jahresForm} name="status" />
          <StepNav
            hideBack
            onNext={() => jahresForm.validate(['jahr', 'faellig_am', 'status'])}
            nextStepLabel={tx('Vorschau')}
          />
        </div>
      </WizardStep>

      {/* Schritt 2: Vorschau */}
      <WizardStep
        label={tx('Vorschau')}
        description={tx('Alle aktiven Mitglieder und die errechneten Beiträge — bereits vorhandene Beiträge werden übersprungen.')}
        needs={['jahr', 'faellig_am']}
      >
        {!jahrNumber ? (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst ein Jahr eingeben.')}
          </StepNav>
        ) : (
          <div className="space-y-4">
            {/* Zusammenfassung */}
            {isVorschauReady && (
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-card border px-4 py-2 text-sm">
                  <IconCoins size={16} className="shrink-0 text-muted-foreground" />
                  <span className="font-medium">{neueBeitraege.length}</span>
                  <span className="text-muted-foreground">{tx('neue Beiträge')}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-card border px-4 py-2 text-sm">
                  <span className="font-medium">{formatCurrencyDE(gesamtSumme)}</span>
                  <span className="text-muted-foreground">{tx('Gesamtbetrag')}</span>
                </div>
              </div>
            )}

            {/* Ladezustand */}
            {!isVorschauReady && (
              <p className="text-sm text-muted-foreground">{tx('Daten werden geladen …')}</p>
            )}

            {/* Mitgliederliste */}
            {isVorschauReady && vorschauDaten.length === 0 && (
              <p className="text-sm text-muted-foreground">{tx('Keine aktiven Mitglieder gefunden.')}</p>
            )}

            {isVorschauReady && vorschauDaten.length > 0 && (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-4 py-3 font-medium text-muted-foreground">{tx('Mitglied')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">{tx('Abteilung')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">{tx('Beitragsklasse')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-right">{tx('Betrag')}</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-center">{tx('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vorschauDaten.map(entry => (
                      <tr key={entry.mitgliedId} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium truncate max-w-[180px]">{entry.name}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell truncate max-w-[140px]">{entry.abteilung}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{entry.beitragsklasse}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrencyDE(entry.betrag)}</td>
                        <td className="px-4 py-3 text-center">
                          {entry.vorhanden ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <IconCheck size={14} className="shrink-0 text-emerald-600" />
                              {tx('bereits vorhanden')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-700">
                              <IconCoins size={14} className="shrink-0" />
                              {tx('neu')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile Karten */}
            {isVorschauReady && vorschauDaten.length > 0 && (
              <div className="sm:hidden space-y-2">
                {vorschauDaten.map(entry => (
                  <div key={entry.mitgliedId} className="rounded-xl border bg-card px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{entry.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.abteilung}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium tabular-nums">{formatCurrencyDE(entry.betrag)}</p>
                      {entry.vorhanden ? (
                        <span className="text-xs text-muted-foreground">{tx('vorhanden')}</span>
                      ) : (
                        <span className="text-xs text-blue-700">{tx('neu')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isVorschauReady && neueBeitraege.length === 0 && vorschauDaten.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <IconAlertCircle size={16} className="shrink-0" />
                {tx('Für alle aktiven Mitglieder existiert bereits ein Beitrag für dieses Jahr.')}
              </div>
            )}

            <StepNav
              onBack={() => setStep(1)}
              onNext={() => {
                if (!isVorschauReady) return tx('Daten werden noch geladen.') as string;
                if (neueBeitraege.length === 0) return tx('Es gibt keine neuen Beiträge zum Anlegen.') as string;
                return;
              }}
              nextStepLabel={tx('Zusammenfassung')}
            />
          </div>
        )}
      </WizardStep>

      {/* Schritt 3: Zusammenfassung */}
      <WizardStep label={tx('Zusammenfassung')}>
        {!submit.done && (
          <SummaryStep
            forms={[jahresForm]}
            submit={submit}
            items={[
              {
                key: 'anzahl',
                label: tx('Neue Beiträge'),
                value: String(neueBeitraege.length),
              },
              {
                key: 'gesamtbetrag',
                label: tx('Gesamtbetrag'),
                value: formatCurrencyDE(gesamtSumme),
              },
            ]}
            whatHappensNext={tx('Für jedes aktive Mitglied ohne bestehenden Beitrag wird ein neuer Datensatz angelegt.')}
            confirmLabel={tx('Beiträge anlegen')}
          />
        )}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          title={tx('Beiträge angelegt')}
          facts={[
            { label: tx('Jahr'), value: String(jahrNumber ?? '') },
            {
              label: tx('Fällig am'),
              value: faelligAm
                ? format(parseISO(faelligAm), 'dd.MM.yyyy')
                : '—',
            },
            { label: tx('Neue Beiträge'), value: String(neueBeitraege.length) },
            { label: tx('Gesamtbetrag'), value: formatCurrencyDE(gesamtSumme) },
          ]}
          whatHappensNext={tx('Die Beiträge erscheinen sofort in der Beitragsverwaltung und können dort weiter bearbeitet werden.')}
          next={[
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          restartLabel={tx('Weiteres Jahr anlegen')}
        />
      )}
    </IntentWizardShell>
  );
}

// Helper (kein Import verfügbar ohne Typ-Einschränkung)
function fieldText(r: import('@/lib/journey').JourneyRecord, key: string): string {
  const v = r.fields[key];
  return typeof v === 'string' ? v : '';
}
