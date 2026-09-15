/**
 * Jahresbeiträge anlegen — 2-Schritt-Wizard.
 * Steps: 1) Jahr + Fälligkeitsdatum wählen → 2) Vorschau bestätigen & Beiträge anlegen.
 * Reads: mitglieder (filter status=aktiv). Writes: beitraege (N Datensätze, einer pro aktivem Mitglied).
 * Composes: IntentWizardShell, WizardStep, StepNav, SummaryStep, SuccessStep, Field, Bound.
 */
import { useMemo, useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldLookup, todayIso, optionsOf } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

// Beitragsklassen-Labels für die Vorschau
export default function JahresbeitraegePage() {
  const KLASSEN_LABELS: Record<string, string> = {
  erwachsener: 'Erwachsener',
  kind: 'Kind',
  familie: 'Familie',
  ehrenmitglied: 'Ehrenmitglied',
};

  const [step, setStep] = useState(1);

  // Aktive Mitglieder laden — gefiltert nach status=aktiv
  const mitglieder = useRecordSearch(servicePort, 'mitglieder', {
    filter: "r.v_status == 'aktiv'",
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    searchFields: ['vorname', 'nachname', 'mitgliedsnummer'],
    toItem: m => ({
      id: m.id,
      title: `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim(),
      subtitle: String(m.fields.beitragsklasse
        ? KLASSEN_LABELS[(m.fields.beitragsklasse as { key: string }).key] ?? (m.fields.beitragsklasse as { key: string }).key
        : ''),
    }),
  });

  // Formular für Jahr + Fälligkeitsdatum
  const beitragForm = useStepForm('beitraege', {
    fields: ['jahr', 'faellig_am'],
    steps: { jahr: 1, faellig_am: 1 },
    required: { status: false, betrag: false, mitglied: false },
    messages: {
      jahr: tx('Bitte das Beitragsjahr eingeben.'),
      faellig_am: tx('Bitte das Fälligkeitsdatum wählen.'),
    },
    initial: {
      jahr: String(new Date().getFullYear() + 1),
    },
  });

  // Auflösung: aktive Mitglieder nach Beitragsklasse aufschlüsseln
  const klassenStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of mitglieder.records) {
      const key = fieldLookup(r, 'beitragsklasse')?.key ?? 'unbekannt';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [mitglieder.records]);

  const aktivCount = mitglieder.records.length;
  const gewaehtesJahr = beitragForm.get('jahr') as string | undefined;
  const faelligAm = beitragForm.get('faellig_am') as string | undefined;

  // Plan: N Beiträge anlegen — einer pro aktivem Mitglied
  const plan = useMemo(() => {
    if (!gewaehtesJahr || !faelligAm || mitglieder.records.length === 0) return [];
    const jahr = Number(gewaehtesJahr);
    return mitglieder.records.map(m => ({
      key: `beitrag-${m.id}`,
      label: `${m.fields.vorname ?? ''} ${m.fields.nachname ?? ''}`.trim() || m.id,
      entity: 'beitraege' as const,
      values: {
        mitglied: m.id,
        jahr,
        betrag: 0,
        faellig_am: faelligAm,
        status: 'offen',
      },
    }));
  }, [gewaehtesJahr, faelligAm, mitglieder.records]);

  const submit = useJourneySubmit(servicePort, plan, {
    draftKey: 'jahresbeitraege',
  });

  const beitragsklassenOptions = optionsOf('beitraege', 'status');
  void beitragsklassenOptions; // used only for type safety

  return (
    <IntentWizardShell
      title={tx('Jahresbeiträge anlegen')}
      subtitle={tx('Beiträge für alle aktiven Mitglieder erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[beitragForm]}
      draftKey="jahresbeitraege"
      intro={{
        description: tx('Legt für ein gewähltes Jahr je einen Beitrag pro aktivem Mitglied an.'),
        needs: [tx('Beitragsjahr'), tx('Gemeinsames Fälligkeitsdatum')],
      }}
    >
      {/* Schritt 1: Jahr und Fälligkeitsdatum wählen */}
      <WizardStep
        label={tx('Jahr wählen')}
        description={tx('Für welches Kalenderjahr sollen die Beiträge angelegt werden?')}
      >
        <div className="space-y-5">
          <Bound
            form={beitragForm}
            name="jahr"
            hint={tx('Typischerweise das nächste Kalenderjahr.')}
          />
          <Bound
            form={beitragForm}
            name="faellig_am"
            hint={tx('Dieses Datum gilt für alle Beiträge dieses Jahres.')}
          />
          <StepNav
            hideBack
            onNext={() => beitragForm.validate(['jahr', 'faellig_am'])}
            nextStepLabel={tx('Vorschau')}
          />
        </div>
      </WizardStep>

      {/* Schritt 2: Vorschau + Bestätigen */}
      <WizardStep
        label={tx('Vorschau & Bestätigen')}
        description={tx('Prüfe, wie viele Beiträge angelegt werden.')}
        needs={['jahr', 'faellig_am']}
      >
        {!submit.done ? (
          <SummaryStep
            forms={[beitragForm]}
            submit={submit}
            confirmLabel={aktivCount > 0
              ? tx`${aktivCount} Beiträge anlegen`
              : tx('Keine aktiven Mitglieder')}
            whatHappensNext={tx('Für jedes aktive Mitglied wird ein Beitragsdatensatz mit Betrag 0,00 € angelegt. Der Kassenwart kann die Beträge danach individuell anpassen.')}
            items={[
              {
                key: 'anzahl',
                label: tx('Aktive Mitglieder'),
                value: mitglieder.select.loading
                  ? tx('Wird geladen…')
                  : String(aktivCount),
              },
              ...Object.entries(klassenStats).map(([klasse, anzahl]) => ({
                key: `klasse-${klasse}`,
                label: KLASSEN_LABELS[klasse] ?? klasse,
                value: tx`${anzahl} Mitglied(er) · 0,00 € Platzhalter`,
              })),
              {
                key: 'betrag-hinweis',
                label: tx('Betrag'),
                value: tx('0,00 € (wird individuell angepasst)'),
              },
            ]}
          >
            {aktivCount === 0 && !mitglieder.select.loading && (
              <p className="text-sm text-muted-foreground rounded-lg bg-secondary px-4 py-3">
                {tx('Es gibt keine aktiven Mitglieder. Bitte zuerst Mitglieder mit Status „aktiv" anlegen.')}
              </p>
            )}
          </SummaryStep>
        ) : null}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          title={tx`${plan.length} Beiträge angelegt`}
          whatHappensNext={tx('Der Kassenwart kann die Beträge nun in der Beitragsliste pro Mitglied korrigieren und Zahlungseingänge erfassen.')}
          next={[
            { label: tx('Weitere Jahresbeiträge anlegen'), onClick: () => { submit.reset(); beitragForm.reset(); setStep(1); } },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          restartLabel={tx('Weitere Jahresbeiträge anlegen')}
        />
      )}
    </IntentWizardShell>
  );
}
