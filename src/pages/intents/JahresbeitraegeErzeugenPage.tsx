/**
 * Jahresbeiträge erzeugen — 2-Schritt-Wizard.
 * Steps: 1) Jahr, Abteilung (optional), Fälligkeitsdatum → 2) Betrag bestätigen → Prüfen & anlegen.
 * Reads: mitglieder (aktiv, optional gefiltert nach Abteilung), beitraege (bestehende für das Jahr),
 *        abteilungen (für die optionale Vorauswahl).
 * Writes: beitraege (createBeitraegeEntry) — ein Eintrag pro qualifizierendem Mitglied (Loop-Plan).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep,
 *           Bound, Field, useRecordSearch, useRecordCount, useJourneySubmit, useStepForm.
 */
import { useState, useMemo } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { Input } from '@/components/ui/input';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  useRecordCount,
  fieldLookup,
  fieldNumber,
  combineFilters,
  refFilter,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { IconCalendar, IconUsers } from '@tabler/icons-react';

const CURRENT_YEAR = new Date().getFullYear();

export default function JahresbeitraegeErzeugenPage() {
  const [step, setStep] = useState(1);

  // Schritt 1: Jahr, Abteilung, Fälligkeitsdatum
  const schritt1 = useStepForm('beitraege', {
    fields: ['faellig_am'],
    steps: { faellig_am: 1 },
    required: { faellig_am: true },
  });

  // Schritt 2: optionaler Pauschalbetrag
  const schritt2 = useStepForm('beitraege', {
    fields: ['betrag'],
    steps: { betrag: 2 },
    required: { betrag: false },
    id: 'beitraege2',
  });

  // Lokaler State für Jahr (number) und Abteilungs-ID
  const [jahr, setJahr] = useState<number>(CURRENT_YEAR);
  const [abteilungId, setAbteilungId] = useState<string | null>(null);
  const [abteilungLabel, setAbteilungLabel] = useState<string | null>(null);
  const [jahrError, setJahrError] = useState<string | null>(null);

  // Abteilungen-Suche für optionalen Schritt
  const abteilungen = useRecordSearch(servicePort, 'abteilungen', {
    searchFields: [],
    toItem: a => ({
      id: a.id,
      title: fieldLookup(a, 'name')?.label ?? a.id,
      subtitle: tx('Vereinsweit wählen falls keine Abteilung'),
    }),
  });

  // Mitglieder-Suche (aktiv, optional nach Abteilung gefiltert) — für den Loop-Plan
  const mitgliederFilter = useMemo(() => {
    const statusFilter = tx('r.v_status == \'aktiv\'');
    if (abteilungId) {
      return combineFilters(statusFilter, refFilter('abteilung', abteilungId));
    }
    return statusFilter;
  }, [abteilungId]);

  const mitglieder = useRecordSearch(servicePort, 'mitglieder', {
    searchFields: ['vorname', 'nachname', 'mitgliedsnummer'],
    filter: mitgliederFilter,
    where: r => {
      const status = fieldLookup(r, 'status')?.key;
      if (status !== 'aktiv') return false;
      if (abteilungId) {
        const fields = r.fields as Record<string, unknown>;
        const abt = fields['abteilung'];
        if (!abt) return false;
        const abtStr = String(abt);
        if (!abtStr.includes(abteilungId)) return false;
      }
      return true;
    },
    toItem: m => ({
      id: m.id,
      title: `${m.fields['vorname'] ?? ''} ${m.fields['nachname'] ?? ''}`.trim(),
      subtitle: tx`Nr. ${String(m.fields['mitgliedsnummer'] ?? '—')}`,
      status: fieldLookup(m, 'status') ?? undefined,
    }),
  });

  // Bestehende Beiträge für das Jahr — um Dopplungen auszuschließen
  const vorhandeneFilter = useMemo(() => {
    // Jahr als Zahl — kein vSQL-Datumsvergleich, sondern numerisch
    return `r.v_jahr == ${jahr}`;
  }, [jahr]);

  const vorhandeneBeitraege = useRecordCount(servicePort, 'beitraege', {
    filter: vorhandeneFilter,
    where: r => fieldNumber(r, 'jahr') === jahr,
    enabled: jahr >= 2000 && jahr <= 2100,
  });

  // Qualifizierende Mitglieder (aktiv, noch kein Beitrag für dieses Jahr)
  // Da wir die record_ids der bestehenden Beiträge nicht vollständig kennen ohne alle zu laden,
  // zeigen wir die Gesamtanzahl aktiver Mitglieder minus bereits vorhandene Beiträge als Vorschau.
  const memberCountFilter = useMemo(() => mitgliederFilter, [mitgliederFilter]);

  const aktiveMitgliederCount = useRecordCount(servicePort, 'mitglieder', {
    filter: memberCountFilter,
    where: r => {
      const status = fieldLookup(r, 'status')?.key;
      if (status !== 'aktiv') return false;
      if (abteilungId) {
        const fields = r.fields as Record<string, unknown>;
        const abt = fields['abteilung'];
        if (!abt) return false;
        return String(abt).includes(abteilungId);
      }
      return true;
    },
    enabled: true,
  });

  // Anzahl betroffener Mitglieder: aktive minus bereits bestehende Beiträge für dieses Jahr
  const betroffeneAnzahl = useMemo(() => {
    if (aktiveMitgliederCount.count === null) return null;
    const existing = vorhandeneBeitraege.count ?? 0;
    return Math.max(0, aktiveMitgliederCount.count - existing);
  }, [aktiveMitgliederCount.count, vorhandeneBeitraege.count]);

  // Plan: Loop über qualifizierende Mitglieder — wird dynamisch beim Absenden aus mitglieder.records gebaut
  // useJourneySubmit erwartet das Plan-Array — wir bauen es lazy bei submit
  const faelligAm = schritt1.get('faellig_am') as string | undefined;
  const betragUeberschreiben = schritt2.get('betrag') as string | undefined;

  // Plan-Array aus mitglieder.records
  const plan = useMemo(() => {
    const records = mitglieder.records;
    if (!records.length) return [{ key: 'placeholder', entity: 'beitraege' as const, values: {} }];

    return records.map(m => ({
      key: `beitrag-${m.id}`,
      entity: 'beitraege' as const,
      primary: false,
      values: {
        jahr,
        faellig_am: faelligAm ?? todayIso(),
        status: 'offen',
        mitglied: m.id,
        ...(betragUeberschreiben ? { betrag: Number(betragUeberschreiben) } : {}),
      } as Record<string, unknown>,
    }));
  }, [mitglieder.records, jahr, faelligAm, betragUeberschreiben]);

  const submit = useJourneySubmit(servicePort, plan, {
    draftKey: 'jahresbeitraege-erzeugen',
  });

  const handleRestart = () => {
    submit.reset();
    schritt1.reset();
    schritt2.reset();
    setJahr(CURRENT_YEAR);
    setAbteilungId(null);
    setAbteilungLabel(null);
    setStep(1);
  };

  // Zusammenfassungs-Items für SummaryStep
  const summaryItems = useMemo(() => [
    {
      key: 'jahr',
      label: tx('Jahr'),
      value: String(jahr),
    },
    {
      key: 'abteilung',
      label: tx('Abteilung'),
      value: abteilungLabel ?? tx('Vereinsweit'),
    },
    {
      key: 'anzahl',
      label: tx('Betroffene Mitglieder'),
      value: betroffeneAnzahl !== null ? String(betroffeneAnzahl) : tx('wird berechnet …'),
    },
  ], [jahr, abteilungLabel, betroffeneAnzahl]);

  return (
    <IntentWizardShell
      title={tx('Jahresbeiträge erzeugen')}
      subtitle={tx('Für alle aktiven Mitglieder auf einen Schlag')}
      currentStep={step}
      onStepChange={setStep}
      forms={[schritt1, schritt2]}
      draftKey="jahresbeitraege-erzeugen"
      intro={{
        description: tx('Erstelle die Jahresbeiträge für alle aktiven Mitglieder — optional gefiltert nach Abteilung.'),
        needs: [tx('Gewünschtes Jahr'), tx('Fälligkeitsdatum'), tx('Optional: Abteilung und Pauschalbetrag')],
      }}
    >
      {/* Schritt 1: Jahr, Abteilung, Fälligkeitsdatum */}
      <WizardStep
        label={tx('Zielgruppe')}
        description={tx('Jahr und Fälligkeitsdatum festlegen — optional auf eine Abteilung einschränken.')}
      >
        <div className="space-y-5">
          {/* Jahr-Eingabe */}
          <div className="space-y-1">
            <label
              htmlFor="beitrag-jahr"
              className="text-sm font-medium leading-none"
            >
              {tx('Jahr')}
              <span className="ml-1 text-destructive" aria-hidden="true">*</span>
            </label>
            <Input
              id="beitrag-jahr"
              type="number"
              inputMode="numeric"
              min={2000}
              max={2100}
              value={String(jahr)}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) {
                  setJahr(v);
                  setJahrError(null);
                }
              }}
              className={jahrError ? 'border-destructive' : ''}
              required
            />
            {jahrError && (
              <p className="text-xs text-destructive">{jahrError}</p>
            )}
          </div>

          {/* Abteilung (optional) */}
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">{tx('Abteilung')} <span className="text-muted-foreground text-xs">({tx('optional — leer = vereinsweit')})</span></p>
            <EntitySelectStep
              {...abteilungen.select}
              selectedId={abteilungId}
              avatar="none"
              create={false}
              emptyText={tx('Keine Abteilungen gefunden.')}
              searchPlaceholder={tx('Abteilung suchen …')}
              onSelect={id => {
                if (abteilungId === id) {
                  // Zweites Klicken = deselektieren
                  setAbteilungId(null);
                  setAbteilungLabel(null);
                } else {
                  setAbteilungId(id);
                  setAbteilungLabel(abteilungen.labelOf(id) ?? null);
                }
              }}
            />
            {abteilungId && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline mt-1"
                onClick={() => { setAbteilungId(null); setAbteilungLabel(null); }}
              >
                {tx('Auswahl aufheben — vereinsweit')}
              </button>
            )}
          </div>

          {/* Fälligkeitsdatum */}
          <Bound
            form={schritt1}
            name="faellig_am"
            hint={tx('Stichtag, bis zu dem alle Beiträge fällig sind.')}
          />

          {/* Vorschau: Anzahl betroffener Mitglieder */}
          <div className="rounded-xl border bg-secondary/40 px-4 py-3 flex items-center gap-3">
            <IconUsers size={20} className="shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {betroffeneAnzahl === null
                  ? tx('Berechne Anzahl …')
                  : tx`${betroffeneAnzahl} Mitglieder betroffen`}
              </p>
              <p className="text-xs text-muted-foreground">
                {tx('Aktive Mitglieder ohne bestehenden Beitrag für dieses Jahr')}
                {abteilungLabel ? tx` · Abteilung: ${abteilungLabel}` : tx(' · Vereinsweit')}
              </p>
              {vorhandeneBeitraege.count !== null && vorhandeneBeitraege.count > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {tx`${vorhandeneBeitraege.count} Beiträge für ${jahr} bereits vorhanden — werden übersprungen`}
                </p>
              )}
            </div>
          </div>

          <StepNav
            hideBack
            nextStepLabel={tx('Beträge')}
            onNext={() => {
              if (jahr < 2000 || jahr > 2100) {
                setJahrError(tx('Bitte ein gültiges Jahr zwischen 2000 und 2100 eingeben.'));
                return false;
              }
              const faelligValid = schritt1.validate(['faellig_am']);
              if (!faelligValid) return false;
            }}
          />
        </div>
      </WizardStep>

      {/* Schritt 2: Standardbeträge / optionaler Pauschalbetrag */}
      <WizardStep
        label={tx('Beträge')}
        description={tx('Optional einen einheitlichen Pauschalbetrag eingeben — sonst wird der Betrag je Beitragsklasse gesetzt.')}
        needs={['faellig_am']}
      >
        <div className="space-y-5">
          {/* Info-Karte */}
          <div className="rounded-xl border bg-secondary/40 px-4 py-3 flex items-start gap-3">
            <IconCalendar size={20} className="shrink-0 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {tx('Leer lassen: Betrag wird pro Mitglied lt. Beitragsklasse und Abteilung gesetzt. Da der Betrag pro Mitglied variiert, bitte hier nur einen Pauschalbetrag eingeben, der alle überschreibt.')}
            </p>
          </div>

          {/* Optionaler Überschreibungsbetrag */}
          <Field
            form={schritt2}
            name="betrag"
            label={tx('Pauschalbetrag (€)')}
            hint={tx('Optional — leer lassen, um den Betrag je Beitragsklasse zu verwenden.')}
          >
            <Input
              {...schritt2.number('betrag')}
              placeholder={tx('Leer lassen für beitragsklassenspezifische Beträge')}
            />
          </Field>

          <StepNav
            onBack={() => setStep(1)}
            nextStepLabel={tx('Prüfen')}
            onNext={() => {
              // Betrag ist optional — kein Pflichtfeld, einfach weiter
            }}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Prüfen & Bestätigen */}
      <WizardStep
        label={tx('Prüfen')}
        needs={['faellig_am']}
      >
        {!submit.done && (
          <SummaryStep
            forms={[schritt1, schritt2]}
            submit={submit}
            items={summaryItems}
            whatHappensNext={tx('Für jedes betroffene Mitglied wird ein Beitragseintrag mit Status „Offen" angelegt.')}
            confirmLabel={betroffeneAnzahl !== null
              ? tx`${betroffeneAnzahl} Beiträge anlegen`
              : tx('Beiträge anlegen')}
          />
        )}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          title={betroffeneAnzahl !== null
            ? tx`${betroffeneAnzahl} Beiträge angelegt`
            : tx('Beiträge angelegt')}
          whatHappensNext={tx('Die Beiträge erscheinen jetzt in der Beitragsliste und können einzeln bezahlt oder gemahnt werden.')}
          next={[
            {
              label: tx('Weitere Jahresbeiträge erzeugen'),
              onClick: handleRestart,
            },
            {
              label: tx('Mitglied aufnehmen'),
              href: '#/intents/mitglied-aufnehmen',
            },
            {
              label: tx('Zum Dashboard'),
              href: '#/',
            },
          ]}
          facts={[
            { label: tx('Jahr'), value: String(jahr) },
            { label: tx('Abteilung'), value: abteilungLabel ?? tx('Vereinsweit') },
            { label: tx('Fällig am'), value: faelligAm ?? '—' },
            ...(betragUeberschreiben
              ? [{ label: tx('Pauschalbetrag'), value: `${betragUeberschreiben} €` }]
              : []),
          ]}
          actions={{ copy: true, print: true }}
        />
      )}
    </IntentWizardShell>
  );
}
