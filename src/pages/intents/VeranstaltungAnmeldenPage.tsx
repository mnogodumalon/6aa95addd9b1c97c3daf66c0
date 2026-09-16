/**
 * Veranstaltung Anmelden — 3-Schritt-Wizard.
 * Steps: 1) Veranstaltung wählen (nur offen_anmeldung, Anmeldeschluss ok) →
 *         2) Mitglied wählen (nur aktive, noch nicht angemeldet) + Personenzahl + Bemerkung →
 *         3) Zusammenfassung & Bestätigen.
 * Reads: veranstaltungen, mitglieder, anmeldungen (Kapazitätscheck).
 * Writes: anmeldungen (createAnmeldungenEntry) — Status 'angemeldet' oder 'warteliste'.
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, BudgetTracker,
 *           StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import {
  useRecordSearch,
  useRecordCount,
  useStepForm,
  useJourneySubmit,
  combineFilters,
  refFilter,
  fieldText,
  fieldLookup,
  fieldDate,
  fieldNumber,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function VeranstaltungAnmeldenPage() {
  const [step, setStep] = useState(1);
  const today = todayIso();

  // Schritt 1: Veranstaltungen — nur offen_anmeldung, nicht abgesagt, Anmeldeschluss nicht überschritten
  const veranstaltungen = useRecordSearch(servicePort, 'veranstaltungen', {
    filter: "r.v_status == 'offen_anmeldung'",
    where: r => {
      const status = fieldLookup(r, 'status')?.key;
      if (status !== 'offen_anmeldung') return false;
      const schluss = fieldDate(r, 'anmeldeschluss');
      if (schluss && schluss < today) return false;
      return true;
    },
    searchFields: ['titel', 'ort'],
    toItem: v => ({
      id: v.id,
      title: fieldText(v, 'titel'),
      subtitle: fieldText(v, 'ort'),
      status: fieldLookup(v, 'status') ?? undefined,
      stats: fieldNumber(v, 'maximale_teilnehmer') != null
        ? [{ label: tx('Max. Plätze'), value: fieldNumber(v, 'maximale_teilnehmer')! }]
        : [],
    }),
  });

  const selectedVeranstaltungId = '' as string; // placeholder — actual value from form below

  // Schritt 2: Mitglieder — nur aktive
  const mitglieder = useRecordSearch(servicePort, 'mitglieder', {
    filter: "r.v_status == 'aktiv'",
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    searchFields: ['vorname', 'nachname', 'mitgliedsnummer'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldText(m, 'mitgliedsnummer'),
    }),
  });

  // Formulare
  const anmeldung = useStepForm('anmeldungen', {
    steps: {
      veranstaltung: 1,
      mitglied: 2,
      anzahl_personen: 2,
      bemerkung: 2,
      status: 3,
      angemeldet_am: 3,
    },
    initial: {
      anzahl_personen: '1',
      angemeldet_am: today,
    },
    required: {
      // Status und angemeldet_am werden vom Plan gesetzt — nicht vom User erfragt
      status: false,
      angemeldet_am: false,
    },
  });

  const veranstaltungId = anmeldung.get('veranstaltung') as string | undefined;
  const mitgliedId = anmeldung.get('mitglied') as string | undefined;

  // Kapazitätscheck: Anmeldungen mit status='angemeldet' für diese Veranstaltung
  const anmeldungenCount = useRecordCount(servicePort, 'anmeldungen', {
    filter: veranstaltungId
      ? combineFilters(refFilter('veranstaltung', veranstaltungId), tx('r.v_status == \'angemeldet\''))
      : undefined,
    where: r =>
      fieldLookup(r, 'status')?.key === 'angemeldet',
    enabled: Boolean(veranstaltungId),
  });

  const selectedVeranstaltung = veranstaltungId ? veranstaltungen.recordOf(veranstaltungId) : undefined;
  const maxTeilnehmer = selectedVeranstaltung ? fieldNumber(selectedVeranstaltung, 'maximale_teilnehmer') : null;
  const belegtCount = anmeldungenCount.count ?? 0;
  const istVoll = maxTeilnehmer != null && belegtCount >= maxTeilnehmer;
  const berechneterStatus = istVoll ? 'warteliste' : 'angemeldet';

  // Plan: eine Anmeldung anlegen
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'anmeldung',
      entity: 'anmeldungen',
      form: anmeldung,
      primary: true,
      values: {
        status: berechneterStatus,
        angemeldet_am: today,
      },
    },
  ], { draftKey: 'veranstaltung-anmelden' });

  return (
    <IntentWizardShell
      title={tx('Mitglied anmelden')}
      currentStep={step}
      onStepChange={setStep}
      forms={[anmeldung]}
      draftKey="veranstaltung-anmelden"
      intro={{
        description: tx('Ein Mitglied zu einer Veranstaltung anmelden — bei voller Kapazität automatisch auf die Warteliste.'),
        needs: [tx('Name des Mitglieds'), tx('Veranstaltung')],
      }}
    >
      {/* Schritt 1: Veranstaltung wählen */}
      <WizardStep
        label={tx('Veranstaltung')}
        description={tx('Nur Veranstaltungen mit offener Anmeldung werden angezeigt.')}
      >
        <EntitySelectStep
          {...veranstaltungen.select}
          selectedId={veranstaltungId ?? null}
          onSelect={id => {
            anmeldung.set('veranstaltung', id, veranstaltungen.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine Veranstaltungen mit offener Anmeldung gefunden.')}
          create={false}
          searchPlaceholder={tx('Titel oder Ort suchen …')}
          avatar="none"
        />
        {/* Kapazitätsanzeige nach Auswahl */}
        {veranstaltungId && maxTeilnehmer != null && (
          <div className="mt-4">
            <BudgetTracker
              format="count"
              unit={tx('Plätze')}
              budget={maxTeilnehmer}
              booked={belegtCount}
              label={tx('Aktuelle Auslastung')}
              showRemaining
            />
            {istVoll && (
              <p className="mt-2 text-sm text-amber-600 font-medium">
                {tx('Die Veranstaltung ist voll — die Anmeldung kommt auf die Warteliste.')}
              </p>
            )}
          </div>
        )}
        {veranstaltungId && maxTeilnehmer == null && (
          <p className="mt-2 text-sm text-muted-foreground">
            {tx('Keine Teilnehmerbegrenzung festgelegt.')}
          </p>
        )}
        {veranstaltungId && (
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => anmeldung.validate(['veranstaltung'])}
            nextStepLabel={tx('Mitglied')}
          />
        )}
      </WizardStep>

      {/* Schritt 2: Mitglied wählen + Details */}
      <WizardStep
        label={tx('Mitglied')}
        description={tx('Aktive Mitglieder wählen und Anmeldedaten erfassen.')}
        needs={['veranstaltung']}
      >
        <div className="space-y-6">
          <EntitySelectStep
            {...mitglieder.select}
            selectedId={mitgliedId ?? null}
            onSelect={id => {
              anmeldung.set('mitglied', id, mitglieder.labelOf(id));
            }}
            emptyText={tx('Keine aktiven Mitglieder gefunden.')}
            create={false}
            searchPlaceholder={tx('Name oder Mitgliedsnummer suchen …')}
          />
          {mitgliedId && (
            <div className="space-y-4 pt-2">
              <Bound form={anmeldung} name="anzahl_personen" hint={tx('Inklusive des Mitglieds selbst')} />
              <Bound form={anmeldung} name="bemerkung" rows={3} />
              <StepNav
                onBack={() => setStep(1)}
                onNext={() => anmeldung.validate(['mitglied', 'anzahl_personen'])}
                nextStepLabel={tx('Zusammenfassung')}
              />
            </div>
          )}
          {!mitgliedId && (
            <StepNav onBack={() => setStep(1)} nextDisabled />
          )}
        </div>
      </WizardStep>

      {/* Schritt 3: Zusammenfassung */}
      <WizardStep label={tx('Zusammenfassung')}>
        {!submit.done && (
          <SummaryStep
            forms={[anmeldung]}
            submit={submit}
            items={[
              {
                key: 'berechneter_status',
                label: tx('Status der Anmeldung'),
                value: istVoll ? tx('Warteliste') : tx('Angemeldet'),
              },
              {
                key: 'angemeldet_am_info',
                label: tx('Anmeldedatum'),
                value: format(new Date(today), 'dd.MM.yyyy'),
              },
            ]}
            whatHappensNext={
              istVoll
                ? tx('Das Mitglied wird auf die Warteliste gesetzt und kann nachrücken, wenn Plätze frei werden.')
                : tx('Die Anmeldung wird sofort gespeichert.')
            }
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{tx('Berechneter Status:')}</span>
              <StatusBadge
                statusKey={berechneterStatus}
                label={istVoll ? tx('Warteliste') : tx('Angemeldet')}
              />
            </div>
          </SummaryStep>
        )}
      </WizardStep>

      {/* Erfolgsbildschirm */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[anmeldung]}
          submit={submit}
          restartLabel={tx('Noch eine Anmeldung')}
          facts={[
            {
              label: tx('Status'),
              value: istVoll ? tx('Auf der Warteliste') : tx('Angemeldet'),
            },
          ]}
          whatHappensNext={
            istVoll
              ? tx('Das Mitglied ist auf der Warteliste und rückt automatisch nach, wenn ein Platz frei wird.')
              : undefined
          }
          next={[
            { label: tx('Zum Dashboard'), href: '#/' },
            { label: tx('Helferschicht eintragen'), href: '#/intents/helferschicht-eintragen' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
