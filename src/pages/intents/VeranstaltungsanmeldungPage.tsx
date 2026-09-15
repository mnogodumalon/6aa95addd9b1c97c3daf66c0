/**
 * Veranstaltungsanmeldung — 4-Schritt-Wizard.
 * Steps: 1) Veranstaltung wählen (nur offen_anmeldung) → 2) Mitglied wählen (aktiv, Duplikatschutz)
 *        → 3) Anmeldedetails + Kapazitätsprüfung → 4) Prüfen & anlegen.
 * Reads: veranstaltungen, mitglieder, anmeldungen (count). Writes: anmeldungen (createAnmeldungenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, BudgetTracker, StepNav, SummaryStep, SuccessStep.
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
import {
  useRecordSearch,
  useRecordCount,
  useStepForm,
  useJourneySubmit,
  fieldText,
  fieldLookup,
  fieldNumber,
  fieldDate,
  combineFilters,
  refFilter,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

const DRAFT_KEY = 'veranstaltungsanmeldung';

export default function VeranstaltungsanmeldungPage() {
  const [step, setStep] = useState(1);
  const [duplikatFehler, setDuplikatFehler] = useState(false);

  // Step 1: Veranstaltungen — nur offen_anmeldung
  const veranstaltungen = useRecordSearch(servicePort, 'veranstaltungen', {
    filter: "r.v_status == 'offen_anmeldung'",
    where: r => fieldLookup(r, 'status')?.key === 'offen_anmeldung',
    searchFields: ['titel', 'ort'],
    toItem: v => ({
      id: v.id,
      title: fieldText(v, 'titel'),
      subtitle: [fieldDate(v, 'datum') ? fieldDate(v, 'datum')!.slice(0, 10) : null, fieldText(v, 'ort')].filter(Boolean).join(' · '),
      status: fieldLookup(v, 'status') ?? undefined,
    }),
  });

  // Step 2: Mitglieder — nur aktiv
  const mitglieder = useRecordSearch(servicePort, 'mitglieder', {
    filter: "r.v_status == 'aktiv'",
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    searchFields: ['vorname', 'nachname', 'mitgliedsnummer', 'email'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldText(m, 'mitgliedsnummer'),
    }),
  });

  // ONE form for anmeldungen
  const anmeldung = useStepForm('anmeldungen', {
    steps: {
      veranstaltung: 1,
      mitglied: 2,
      anzahl_personen: 3,
      bemerkung: 3,
      // angemeldet_am and status are plan-supplied, not bound
    },
    initial: { anzahl_personen: '1' },
    messages: {
      angemeldet_am: tx('Bitte das Anmeldedatum eingeben.'),
      anzahl_personen: tx('Bitte die Personenanzahl angeben.'),
      status: tx('Bitte den Anmeldestatus wählen.'),
      veranstaltung: tx('Bitte eine Veranstaltung auswählen.'),
      mitglied: tx('Bitte ein Mitglied auswählen.'),
    },
    // angemeldet_am and status are set by the plan, not required from the user
    required: { angemeldet_am: false, status: false },
  });

  const veranstaltungId = anmeldung.get('veranstaltung') as string | null;
  const mitgliedId = anmeldung.get('mitglied') as string | null;

  // Kapazitätsprüfung: aktuelle Anmeldungen mit status=angemeldet für gewählte Veranstaltung
  const belegtCount = useRecordCount(servicePort, 'anmeldungen', {
    filter: veranstaltungId
      ? combineFilters(
          refFilter('veranstaltung', veranstaltungId),
          tx('r.v_status == \'angemeldet\'')
        )
      : undefined,
    where: a =>
      fieldLookup(a, 'status')?.key === 'angemeldet' &&
      (veranstaltungId ? a.fields['veranstaltung'] !== null : false),
    enabled: Boolean(veranstaltungId),
  });

  // Duplikatprüfung: hat dieses Mitglied sich bereits angemeldet?
  const duplikatCount = useRecordCount(servicePort, 'anmeldungen', {
    filter:
      veranstaltungId && mitgliedId
        ? combineFilters(
            refFilter('veranstaltung', veranstaltungId),
            refFilter('mitglied', mitgliedId)
          )
        : undefined,
    where: _a => true,
    enabled: Boolean(veranstaltungId && mitgliedId),
  });

  // Veranstaltungsdetails für Kapazität
  const veranstaltungRecord = veranstaltungId ? veranstaltungen.recordOf(veranstaltungId) : undefined;
  const maxTeilnehmer = veranstaltungRecord ? (fieldNumber(veranstaltungRecord, 'maximale_teilnehmer') ?? 0) : 0;
  const belegtAnzahl = belegtCount.count ?? 0;
  const istVoll = maxTeilnehmer > 0 && belegtAnzahl >= maxTeilnehmer;
  const anmeldungStatus = istVoll ? 'warteliste' : 'angemeldet';

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'anmeldung',
        entity: 'anmeldungen',
        form: anmeldung,
        primary: true,
        values: {
          angemeldet_am: format(new Date(), 'yyyy-MM-dd'),
          status: anmeldungStatus,
        },
      },
    ],
    { draftKey: DRAFT_KEY }
  );

  return (
    <IntentWizardShell
      title={tx('Veranstaltungsanmeldung')}
      subtitle={tx('Mitglied zu einer Veranstaltung anmelden')}
      currentStep={step}
      onStepChange={setStep}
      forms={[anmeldung]}
      draftKey={DRAFT_KEY}
      intro={{
        description: tx('Ein Mitglied zu einer offenen Veranstaltung anmelden — mit Kapazitätsprüfung und Warteliste.'),
        needs: [tx('Name des Mitglieds'), tx('Name der Veranstaltung')],
      }}
    >
      {/* Schritt 1: Veranstaltung wählen */}
      <WizardStep
        label={tx('Veranstaltung')}
        description={tx('Nur Veranstaltungen mit offener Anmeldung werden angezeigt.')}
      >
        <EntitySelectStep
          {...veranstaltungen.select}
          selectedId={veranstaltungId}
          emptyText={tx('Keine Veranstaltungen mit offener Anmeldung gefunden.')}
          create={false}
          onSelect={id => {
            anmeldung.set('veranstaltung', id, veranstaltungen.labelOf(id));
            setDuplikatFehler(false);
            setStep(2);
          }}
        />
      </WizardStep>

      {/* Schritt 2: Mitglied wählen mit Duplikatschutz */}
      <WizardStep
        label={tx('Mitglied')}
        description={tx('Aktives Mitglied auswählen — eine Doppelregistrierung wird verhindert.')}
        needs={['veranstaltung']}
      >
        <div className="space-y-4">
          {duplikatFehler && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {tx('Dieses Mitglied ist bereits für diese Veranstaltung angemeldet.')}
            </div>
          )}
          <EntitySelectStep
            {...mitglieder.select}
            selectedId={mitgliedId}
            emptyText={tx('Keine aktiven Mitglieder gefunden.')}
            create={false}
            onSelect={id => {
              anmeldung.set('mitglied', id, mitglieder.labelOf(id));
              setDuplikatFehler(false);
            }}
          />
          <StepNav
            onBack={() => setStep(1)}
            onNext={async () => {
              if (!mitgliedId) {
                return anmeldung.validate(['mitglied']);
              }
              // Duplikatprüfung abwarten
              if (duplikatCount.loading) return false;
              if ((duplikatCount.count ?? 0) > 0) {
                setDuplikatFehler(true);
                return tx('Dieses Mitglied ist bereits für diese Veranstaltung angemeldet.');
              }
              setDuplikatFehler(false);
              setStep(3);
            }}
            nextStepLabel={tx('Anmeldedetails')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Anmeldedetails + Kapazitätsprüfung */}
      <WizardStep
        label={tx('Anmeldedetails')}
        description={tx('Personenanzahl angeben und Kapazität prüfen.')}
        needs={['veranstaltung', 'mitglied']}
      >
        <div className="space-y-4">
          {maxTeilnehmer > 0 && (
            <BudgetTracker
              format="count"
              unit={tx('Plätze')}
              budget={maxTeilnehmer}
              booked={belegtAnzahl}
              label={tx('Kapazität')}
              showRemaining
            />
          )}
          {istVoll && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              {tx('Die Veranstaltung ist ausgebucht — das Mitglied wird auf die Warteliste gesetzt.')}
            </div>
          )}
          <Bound form={anmeldung} name="anzahl_personen" hint={tx('Mindestens 1 Person')} />
          <Bound form={anmeldung} name="bemerkung" rows={3} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => {
              const ok = anmeldung.validate(['anzahl_personen']);
              if (ok) setStep(4);
              return ok;
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Zusammenfassung */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[anmeldung]}
            submit={submit}
            items={[
              {
                key: '_status',
                label: tx('Anmeldestatus'),
                value: istVoll ? tx('Warteliste') : tx('Angemeldet'),
              },
              {
                key: '_datum',
                label: tx('Anmeldedatum'),
                value: format(new Date(), 'yyyy-MM-dd'),
              },
            ]}
            whatHappensNext={
              istVoll
                ? tx('Das Mitglied wird auf die Warteliste gesetzt und kann nachrücken, wenn Plätze frei werden.')
                : tx('Das Mitglied wird direkt als angemeldet eingetragen.')
            }
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          forms={[anmeldung]}
          facts={[
            {
              label: tx('Mitglied'),
              value: mitgliedId ? (mitglieder.labelOf(mitgliedId) ?? '—') : '—',
            },
            {
              label: tx('Veranstaltung'),
              value: veranstaltungId ? (veranstaltungen.labelOf(veranstaltungId) ?? '—') : '—',
            },
            {
              label: tx('Status'),
              value: istVoll ? tx('Warteliste') : tx('Angemeldet'),
            },
          ]}
          next={[
            { label: tx('Weitere Anmeldung'), onClick: () => { submit.reset(); anmeldung.reset(); setStep(1); setDuplikatFehler(false); } },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={
            istVoll
              ? tx('Das Mitglied steht auf der Warteliste und wird benachrichtigt, sobald ein Platz frei wird.')
              : tx('Die Anmeldung ist abgeschlossen. Das Mitglied kann an der Veranstaltung teilnehmen.')
          }
          restartLabel={tx('Weitere Anmeldung')}
        />
      )}
    </IntentWizardShell>
  );
}
