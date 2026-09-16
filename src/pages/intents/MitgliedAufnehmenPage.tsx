/**
 * Mitglied aufnehmen — 3-Schritt-Wizard.
 * Steps: 1) Abteilung & Beitragsklasse wählen → 2) Persönliche Daten erfassen → 3) Ersten Jahresbeitrag anlegen → Prüfen & anlegen.
 * Reads: abteilungen. Writes: mitglieder (create), beitraege (create, verknüpft mit neuem Mitglied).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, todayIso, fieldText, fieldNumber } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { LOOKUP_OPTIONS } from '@/types/app';

const DRAFT_KEY = 'mitglied-aufnehmen';

export default function MitgliedAufnehmenPage() {
  const [step, setStep] = useState(1);

  // Abteilungen: kleine Auswahl (5 Einträge), alle qualifizieren — kein Filter
  const abteilungen = useRecordSearch(servicePort, 'abteilungen', {
    searchFields: [],
    toItem: a => ({
      id: a.id,
      title: fieldText(a, 'name') || a.id,
      stats: [
        { label: tx('Erwachsene'), value: `${fieldNumber(a, 'jahresbeitrag_erwachsene') ?? '—'} €` },
        { label: tx('Kinder'), value: `${fieldNumber(a, 'jahresbeitrag_kinder') ?? '—'} €` },
      ],
    }),
  });

  // Form für Mitglied-Daten (Schritte 1 + 2)
  const mitglied = useStepForm('mitglieder', {
    steps: {
      abteilung: 1,
      beitragsklasse: 1,
      mitgliedsnummer: 2,
      vorname: 2,
      nachname: 2,
      geburtsdatum: 2,
      email: 2,
      telefon: 2,
      eintrittsdatum: 2,
      status: 2,
      sepa_mandat: 2,
    },
    initial: {
      eintrittsdatum: todayIso(),
      status: LOOKUP_OPTIONS['mitglieder']?.['status']?.find(o => o.key === 'aktiv')?.key ?? 'aktiv',
    },
  });

  // Form für Beitrag (Schritt 3)
  const beitrag = useStepForm('beitraege', {
    steps: {
      jahr: 3,
      betrag: 3,
      faellig_am: 3,
      status: 3,
      zahlungsart: 3,
    },
    initial: {
      jahr: new Date().getFullYear(),
      status: LOOKUP_OPTIONS['beitraege']?.['status']?.find(o => o.key === 'offen')?.key ?? 'offen',
    },
  });

  const submit = useJourneySubmit(servicePort, [
    { key: 'mitglied', entity: 'mitglieder', form: mitglied, primary: true },
    {
      key: 'beitrag',
      entity: 'beitraege',
      form: beitrag,
      needs: ['mitglied'],
      link: { mitglied: 'mitglied' },
    },
  ], { draftKey: DRAFT_KEY });

  return (
    <IntentWizardShell
      title={tx('Mitglied aufnehmen')}
      subtitle={tx('Neues Vereinsmitglied anlegen und ersten Jahresbeitrag erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[mitglied, beitrag]}
      draftKey={DRAFT_KEY}
      intro={{
        description: tx('Ein neues Vereinsmitglied in drei Schritten aufnehmen und sofort den ersten Jahresbeitrag anlegen.'),
        needs: [tx('Mitgliedsnummer'), tx('Persönliche Daten'), tx('Beitragsinformationen')],
      }}
    >
      {/* Schritt 1: Abteilung & Beitragsklasse */}
      <WizardStep
        label={tx('Abteilung & Klasse')}
        description={tx('Abteilung auswählen und Beitragsklasse des neuen Mitglieds festlegen.')}
      >
        <div className="space-y-6">
          <EntitySelectStep
            {...abteilungen.select}
            selectedId={mitglied.get('abteilung') as string | null}
            onSelect={id => mitglied.set('abteilung', id, abteilungen.labelOf(id))}
            avatar="none"
            create={false}
            emptyText={tx('Keine Abteilungen vorhanden.')}
            searchPlaceholder={tx('Abteilung suchen …')}
          />
          <Field form={mitglied} name="beitragsklasse">
            <ChoiceGroup
              {...mitglied.choice('beitragsklasse')}
              options={LOOKUP_OPTIONS['mitglieder']?.['beitragsklasse'] ?? []}
            />
          </Field>
          <StepNav
            hideBack
            onNext={() => mitglied.validate(['abteilung', 'beitragsklasse'])}
            nextStepLabel={tx('Persönliche Daten')}
          />
        </div>
      </WizardStep>

      {/* Schritt 2: Persönliche Daten */}
      <WizardStep
        label={tx('Persönliche Daten')}
        description={tx('Angaben zur Person des neuen Mitglieds erfassen.')}
      >
        <div className="space-y-4">
          <Bound form={mitglied} name="mitgliedsnummer" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Bound form={mitglied} name="vorname" />
            <Bound form={mitglied} name="nachname" />
          </div>
          <Bound form={mitglied} name="geburtsdatum" />
          <Bound form={mitglied} name="email" />
          <Bound form={mitglied} name="telefon" />
          <Bound form={mitglied} name="eintrittsdatum" />
          <Field form={mitglied} name="status">
            <ChoiceGroup
              {...mitglied.choice('status')}
              options={LOOKUP_OPTIONS['mitglieder']?.['status'] ?? []}
            />
          </Field>
          <Bound form={mitglied} name="sepa_mandat" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() =>
              mitglied.validate([
                'mitgliedsnummer',
                'vorname',
                'nachname',
                'geburtsdatum',
                'eintrittsdatum',
                'status',
              ])
            }
            nextStepLabel={tx('Jahresbeitrag')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Erster Jahresbeitrag */}
      <WizardStep
        label={tx('Jahresbeitrag')}
        description={tx('Ersten Jahresbeitrag für das aktuelle Jahr anlegen.')}
      >
        <div className="space-y-4">
          <Bound form={beitrag} name="jahr" />
          <Bound
            form={beitrag}
            name="betrag"
            hint={tx('Jahresbeitrag lt. Abteilung — bitte manuell eintragen.')}
          />
          <Bound form={beitrag} name="faellig_am" />
          <Field form={beitrag} name="status">
            <ChoiceGroup
              {...beitrag.choice('status')}
              options={LOOKUP_OPTIONS['beitraege']?.['status'] ?? []}
            />
          </Field>
          <Field form={beitrag} name="zahlungsart">
            <ChoiceGroup
              {...beitrag.choice('zahlungsart')}
              options={LOOKUP_OPTIONS['beitraege']?.['zahlungsart'] ?? []}
              allowClear
            />
          </Field>
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => beitrag.validate(['jahr', 'betrag', 'faellig_am', 'status'])}
            nextStepLabel={tx('Prüfen & anlegen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Prüfen & anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[mitglied, beitrag]}
            submit={submit}
            items={[
              {
                key: 'mitglied_name',
                label: tx('Mitgliedsname'),
                value: [mitglied.get('vorname'), mitglied.get('nachname')]
                  .filter(Boolean)
                  .join(' ') || '—',
              },
              {
                key: 'abteilung_label',
                label: tx('Abteilung'),
                value: (mitglied.labels['abteilung'] as string | undefined) ?? '—',
                step: 1,
              },
              {
                key: 'beitragsklasse_label',
                label: tx('Beitragsklasse'),
                value:
                  LOOKUP_OPTIONS['mitglieder']?.['beitragsklasse']?.find(
                    o => o.key === mitglied.get('beitragsklasse'),
                  )?.label ?? '—',
                step: 1,
              },
              {
                key: 'beitrag_jahr',
                label: tx('Beitragsjahr'),
                value: String(beitrag.get('jahr') ?? new Date().getFullYear()),
                step: 3,
              },
              {
                key: 'beitrag_betrag',
                label: tx('Betrag'),
                value: beitrag.get('betrag') != null ? `${beitrag.get('betrag')} €` : '—',
                step: 3,
              },
            ]}
            whatHappensNext={tx(
              'Das Mitglied wird sofort angelegt und der erste Jahresbeitrag verknüpft.',
            )}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[mitglied, beitrag]}
          submit={submit}
          restartLabel={tx('Weiteres Mitglied aufnehmen')}
          whatHappensNext={tx(
            'Das Mitglied ist jetzt aktiv und der erste Jahresbeitrag ist angelegt.',
          )}
          next={[
            {
              label: tx('Jahresbeiträge erzeugen'),
              href: '#/intents/jahresbeitraege-erzeugen',
            },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
