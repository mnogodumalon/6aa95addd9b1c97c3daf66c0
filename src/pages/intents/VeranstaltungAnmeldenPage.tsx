/**
 * Veranstaltung Anmelden — 4-Schritt-Wizard.
 * Steps: 1) Veranstaltung wählen (nur offen_anmeldung) →
 *        2) Mitglied wählen (nur aktiv, Duplikat-Prüfung) →
 *        3) Anmeldedaten erfassen (Datum, Anzahl, Bemerkung, Status auto) →
 *        4) Prüfen & anlegen.
 * Reads: veranstaltungen, mitglieder, anmeldungen (Zählungen).
 * Writes: anmeldungen (createAnmeldungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, ChoiceGroup, BudgetTracker,
 *            StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  useRecordCount,
  fieldText,
  fieldLookup,
  fieldNumber,
  refFilter,
  combineFilters,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { IconCalendarEvent } from '@tabler/icons-react';

const DRAFT_KEY = 'veranstaltung-anmelden';

export default function VeranstaltungAnmeldenPage() {
  const [step, setStep] = useState(1);

  // Veranstaltungen: nur offene Anmeldungen
  const veranstaltungen = useRecordSearch(servicePort, 'veranstaltungen', {
    filter: "r.v_status == 'offen_anmeldung'",
    where: r => fieldLookup(r, 'status')?.key === 'offen_anmeldung',
    searchFields: ['titel', 'ort'],
    toItem: v => ({
      id: v.id,
      title: fieldText(v, 'titel'),
      subtitle: fieldText(v, 'ort'),
      status: fieldLookup(v, 'status') ?? undefined,
      stats: fieldNumber(v, 'maximale_teilnehmer') != null
        ? [{ label: tx('Max. Teilnehmer'), value: fieldNumber(v, 'maximale_teilnehmer') as number }]
        : undefined,
    }),
  });

  // Mitglieder: nur aktive
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
      angemeldet_am: 3,
      anzahl_personen: 3,
      bemerkung: 3,
      status: 3,
    },
    initial: {
      angemeldet_am: todayIso(),
      anzahl_personen: 1,
    },
    required: {
      bemerkung: false,
    },
  });

  const selectedVeranstaltungId = anmeldung.get('veranstaltung') as string | null;
  const selectedMitgliedId = anmeldung.get('mitglied') as string | null;

  // Aktuelle Anmeldezahl für die gewählte Veranstaltung
  const anmeldezahl = useRecordCount(servicePort, 'anmeldungen', {
    filter: selectedVeranstaltungId
      ? combineFilters(refFilter('veranstaltung', selectedVeranstaltungId), tx('r.v_status != \'abgemeldet\''))
      : undefined,
    where: a => {
      const vid = fieldText(a, 'veranstaltung');
      const key = fieldLookup(a, 'status')?.key;
      return vid.includes(selectedVeranstaltungId ?? '__none__') && key !== 'abgemeldet';
    },
    enabled: Boolean(selectedVeranstaltungId),
  });

  // Duplikat-Prüfung: ist dieses Mitglied schon angemeldet?
  const duplikat = useRecordCount(servicePort, 'anmeldungen', {
    filter: selectedVeranstaltungId && selectedMitgliedId
      ? combineFilters(
          refFilter('veranstaltung', selectedVeranstaltungId),
          refFilter('mitglied', selectedMitgliedId),
          tx('r.v_status != \'abgemeldet\''),
        )
      : undefined,
    where: a => {
      const vid = fieldText(a, 'veranstaltung');
      const mid = fieldText(a, 'mitglied');
      const key = fieldLookup(a, 'status')?.key;
      return (
        vid.includes(selectedVeranstaltungId ?? '__none__') &&
        mid.includes(selectedMitgliedId ?? '__none__') &&
        key !== 'abgemeldet'
      );
    },
    enabled: Boolean(selectedVeranstaltungId) && Boolean(selectedMitgliedId),
  });

  // Kapazitätsprüfung anhand der ausgewählten Veranstaltung
  const selectedVeranstaltung = selectedVeranstaltungId
    ? veranstaltungen.recordOf(selectedVeranstaltungId)
    : undefined;
  const maxTeilnehmer = selectedVeranstaltung
    ? (fieldNumber(selectedVeranstaltung, 'maximale_teilnehmer') ?? null)
    : null;
  const istAusgebucht =
    maxTeilnehmer != null &&
    anmeldezahl.count != null &&
    anmeldezahl.count >= maxTeilnehmer;

  // Automatisch gesetzter Status
  const autoStatus = istAusgebucht ? 'warteliste' : 'angemeldet';

  // Plan: eine Anmeldung anlegen
  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'anmeldung',
        entity: 'anmeldungen',
        form: anmeldung,
        primary: true,
        values: { status: autoStatus },
      },
    ],
    { draftKey: DRAFT_KEY },
  );

  return (
    <IntentWizardShell
      title={tx('Veranstaltung Anmelden')}
      currentStep={step}
      onStepChange={setStep}
      forms={[anmeldung]}
      draftKey={DRAFT_KEY}
      intro={{
        description: tx('Ein Mitglied zu einer Veranstaltung anmelden — bei voller Kapazität automatisch auf die Warteliste.'),
        needs: [tx('Veranstaltung'), tx('Mitglied')],
      }}
    >
      {/* Schritt 1: Veranstaltung wählen */}
      <WizardStep
        label={tx('Veranstaltung')}
        description={tx('Veranstaltung auswählen — nur Veranstaltungen mit offener Anmeldung werden gezeigt.')}
      >
        <EntitySelectStep
          {...veranstaltungen.select}
          selectedId={selectedVeranstaltungId}
          emptyText={tx('Keine Veranstaltung mit offener Anmeldung gefunden.')}
          emptyIcon={<IconCalendarEvent size={32} stroke={1.5} />}
          create={false}
          onSelect={id => {
            anmeldung.set('veranstaltung', id, veranstaltungen.labelOf(id));
            // Status wird automatisch ermittelt — Feldwert setzen
            setStep(2);
          }}
        />
        {selectedVeranstaltungId && maxTeilnehmer != null && anmeldezahl.count != null && (
          <div className="mt-4">
            <BudgetTracker
              format="count"
              unit={tx('Plätze')}
              budget={maxTeilnehmer}
              booked={anmeldezahl.count}
              label={tx('Auslastung')}
            />
          </div>
        )}
        {selectedVeranstaltungId && istAusgebucht && (
          <p className="mt-3 text-sm text-amber-600 font-medium">
            {tx('Veranstaltung ausgebucht — Anmeldung landet auf Warteliste')}
          </p>
        )}
        <StepNav
          hideBack
          onNext={() => anmeldung.validate(['veranstaltung'])}
          nextStepLabel={tx('Mitglied')}
        />
      </WizardStep>

      {/* Schritt 2: Mitglied wählen */}
      <WizardStep
        label={tx('Mitglied')}
        description={tx('Aktives Mitglied auswählen — bereits angemeldete Mitglieder werden abgewiesen.')}
        needs={['veranstaltung']}
      >
        <EntitySelectStep
          {...mitglieder.select}
          selectedId={selectedMitgliedId}
          emptyText={tx('Kein aktives Mitglied gefunden.')}
          create={false}
          onSelect={id => {
            anmeldung.set('mitglied', id, mitglieder.labelOf(id));
            setStep(3);
          }}
        />
        {duplikat.count != null && duplikat.count > 0 && (
          <p className="mt-3 text-sm text-destructive font-medium">
            {tx('Dieses Mitglied ist bereits angemeldet')}
          </p>
        )}
        <StepNav
          onBack={() => setStep(1)}
          onNext={() => {
            if (!anmeldung.validate(['mitglied'])) return false;
            if (duplikat.count != null && duplikat.count > 0) {
              return tx('Dieses Mitglied ist bereits angemeldet') as string;
            }
          }}
          nextStepLabel={tx('Anmeldedaten')}
        />
      </WizardStep>

      {/* Schritt 3: Anmeldedaten */}
      <WizardStep
        label={tx('Anmeldedaten')}
        description={tx('Datum, Anzahl Personen und optionale Bemerkung eingeben.')}
        needs={['veranstaltung', 'mitglied']}
      >
        <div className="space-y-4">
          <Bound form={anmeldung} name="angemeldet_am" />
          <Bound form={anmeldung} name="anzahl_personen" hint={tx('Wie viele Personen nimmt dieses Mitglied mit?')} />
          <Bound form={anmeldung} name="bemerkung" rows={3} />

          {/* Status-Anzeige (automatisch gesetzt, nicht editierbar im Formular) */}
          <div className="rounded-lg border bg-secondary px-4 py-3 text-sm">
            <span className="text-muted-foreground">{tx('Anmeldestatus:')}</span>{' '}
            <span className="font-medium">
              {istAusgebucht ? tx('Warteliste') : tx('Angemeldet')}
            </span>
            {istAusgebucht && (
              <span className="ml-2 text-xs text-amber-600">
                {tx('(Veranstaltung ausgebucht)')}
              </span>
            )}
          </div>

          <StepNav
            onBack={() => setStep(2)}
            onNext={() => anmeldung.validate(['angemeldet_am', 'anzahl_personen'])}
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
                key: 'status_auto',
                label: tx('Anmeldestatus'),
                value: istAusgebucht ? tx('Warteliste') : tx('Angemeldet'),
              },
            ]}
            whatHappensNext={
              istAusgebucht
                ? tx('Das Mitglied wird auf die Warteliste gesetzt und bei freier Kapazität nachgerückt.')
                : tx('Das Mitglied ist für die Veranstaltung angemeldet.')
            }
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[anmeldung]}
          submit={submit}
          restartLabel={tx('Weitere Anmeldung')}
          whatHappensNext={
            submit.result.records['anmeldung'] &&
            (fieldLookup(submit.result.records['anmeldung'], 'status')?.key === 'warteliste'
              ? tx('Das Mitglied steht auf der Warteliste und wird benachrichtigt, sobald ein Platz frei wird.')
              : tx('Die Anmeldung ist abgeschlossen. Das Mitglied kann an der Veranstaltung teilnehmen.'))
          }
          next={[
            { label: tx('Helferschicht besetzen'), href: '#/intents/helferschicht-besetzen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
