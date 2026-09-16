/**
 * Helferschicht eintragen — 4-Schritt-Wizard (+ Erfolg).
 * Steps: 1) Veranstaltung wählen → 2) Schicht erfassen → 3) Helfer zuweisen (optional) → 4) Zusammenfassung.
 * Reads: veranstaltungen (filter: nicht abgesagt/durchgefuehrt), mitglieder (filter: aktiv).
 * Writes: helferschichten (createHelferschichtenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, Field, DatePicker,
 *           BudgetTracker, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { DatePicker } from '@/components/DatePicker';
import {
  useRecordSearch,
  useStepForm,
  useJourneySubmit,
  fieldText,
  fieldLookup,
  nowIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function HelferschichtEintragenPage() {
  const [step, setStep] = useState(1);

  // Veranstaltungen: alle außer abgesagt und durchgefuehrt
  const veranstaltungen = useRecordSearch(servicePort, 'veranstaltungen', {
    filter: "r.v_status not in ['abgesagt', 'durchgefuehrt']",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key !== 'abgesagt' && key !== 'durchgefuehrt';
    },
    searchFields: ['titel', 'ort'],
    toItem: v => ({
      id: v.id,
      title: fieldText(v, 'titel'),
      subtitle: fieldText(v, 'ort'),
      status: fieldLookup(v, 'status') ?? undefined,
    }),
    orderby: ['r.v_datum asc'],
  });

  // Mitglieder: nur aktive
  const mitglieder = useRecordSearch(servicePort, 'mitglieder', {
    filter: "r.v_status == 'aktiv'", /* i18n-exempt */
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    searchFields: ['vorname', 'nachname', 'mitgliedsnummer'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldText(m, 'mitgliedsnummer'),
    }),
    orderby: ['r.v_nachname asc', 'r.v_vorname asc'],
  });

  // Formular für helferschichten (alle Felder, die der Wizard abfragt)
  const schicht = useStepForm('helferschichten', {
    steps: {
      veranstaltung: 1,
      bezeichnung: 2,
      beginn: 2,
      ende: 2,
      benoetigte_helfer: 2,
      bemerkung: 2,
      helfer: 3,
    },
    initial: {
      benoetigte_helfer: 1,
      beginn: nowIso(),
      ende: nowIso(),
    },
    required: {
      helfer: false, // Schritt 3 ist optional
    },
  });

  const submit = useJourneySubmit(servicePort, [
    { key: 'schicht', entity: 'helferschichten', form: schicht, primary: true },
  ], { draftKey: 'helferschicht-eintragen' });

  // Zähler: wie viele Helfer wurden gewählt vs. benötigt
  const gewaehlteHelfer = (schicht.get('helfer') as string[] | undefined)?.length ?? 0;
  const benoetigteHelfer = Number(schicht.get('benoetigte_helfer') ?? 1);

  const restart = () => {
    submit.reset();
    schicht.reset({ benoetigte_helfer: 1, beginn: nowIso(), ende: nowIso() });
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Helferschicht eintragen')}
      subtitle={tx('Neue Schicht für eine Veranstaltung anlegen und Helfer zuweisen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[schicht]}
      draftKey="helferschicht-eintragen"
      intro={{
        description: tx('Eine neue Helferschicht anlegen und direkt Mitglieder als Helfer einteilen.'),
        needs: [tx('Veranstaltung'), tx('Schichtbezeichnung und Zeiten'), tx('Optionale Helferliste')],
      }}
    >
      {/* Schritt 1: Veranstaltung wählen */}
      <WizardStep
        label={tx('Veranstaltung')}
        description={tx('Wähle die Veranstaltung, für die du eine Helferschicht anlegen möchtest.')}
      >
        <EntitySelectStep
          {...veranstaltungen.select}
          selectedId={schicht.get('veranstaltung') as string | null}
          onSelect={id => {
            schicht.set('veranstaltung', id, veranstaltungen.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine aktiven Veranstaltungen gefunden. Nur geplante und offene Veranstaltungen können Helferschichten erhalten.')}
          searchPlaceholder={tx('Veranstaltung suchen …')}
          avatar="none"
        />
      </WizardStep>

      {/* Schritt 2: Schicht erfassen */}
      <WizardStep
        label={tx('Schicht')}
        description={tx('Bezeichnung, Zeiten und Helferanzahl der Schicht festlegen.')}
        needs={['veranstaltung']}
      >
        <div className="space-y-4">
          <Bound
            form={schicht}
            name="bezeichnung"
            placeholder={tx('z. B. Grillstand 14 bis 16 Uhr')}
          />
          <Field form={schicht} name="beginn">
            <DatePicker {...schicht.date('beginn')} mode="datetime" />
          </Field>
          <Field form={schicht} name="ende">
            <DatePicker {...schicht.date('ende')} mode="datetime" />
          </Field>
          <Bound
            form={schicht}
            name="benoetigte_helfer"
            hint={tx('Wie viele Helfer werden für diese Schicht gebraucht?')}
          />
          <Bound
            form={schicht}
            name="bemerkung"
            rows={3}
            placeholder={tx('Optionale Hinweise zur Schicht …')}
          />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => {
              const ok = schicht.validate(['bezeichnung', 'beginn', 'ende', 'benoetigte_helfer']);
              if (!ok) return false;
              // Prüfen: Ende muss nach Beginn liegen
              const beginn = schicht.get('beginn') as string | null;
              const ende = schicht.get('ende') as string | null;
              if (beginn && ende && ende <= beginn) {
                return tx('Das Ende der Schicht muss nach dem Beginn liegen.');
              }
            }}
            nextStepLabel={tx('Helfer')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Helfer zuweisen (optional) */}
      <WizardStep
        label={tx('Helfer zuweisen')}
        description={tx('Weise dieser Schicht Mitglieder als Helfer zu. Dieser Schritt ist optional.')}
        needs={['bezeichnung']}
      >
        <div className="space-y-4">
          {benoetigteHelfer > 0 && (
            <BudgetTracker
              format="count"
              unit={tx('Helfer')}
              budget={benoetigteHelfer}
              booked={gewaehlteHelfer}
              label={tx('Schichtbesetzung')}
              showRemaining
            />
          )}
          <Field form={schicht} name="helfer" label={tx('Mitglieder auswählen')} hint={tx('Optional — du kannst diesen Schritt überspringen.')}>
            <EntitySelectStep
              {...mitglieder.select}
              {...schicht.records('helfer', mitglieder.labelOf)}
              searchPlaceholder={tx('Mitglied suchen …')}
              emptyText={tx('Keine aktiven Mitglieder gefunden.')}
              avatar="initials"
            />
          </Field>
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => schicht.validate(['helfer'])}
            nextStepLabel={tx('Zusammenfassung')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Zusammenfassung */}
      <WizardStep label={tx('Zusammenfassung')}>
        {!submit.done && (
          <SummaryStep
            forms={[schicht]}
            submit={submit}
            whatHappensNext={tx('Die Helferschicht wird sofort angelegt und ist in der Veranstaltungsübersicht sichtbar.')}
            confirmLabel={tx('Schicht anlegen')}
            items={[
              {
                key: 'helfer_count',
                label: tx('Gewählte Helfer'),
                value: gewaehlteHelfer > 0
                  ? `${gewaehlteHelfer} / ${benoetigteHelfer}`
                  : tx('Keine Helfer zugewiesen'),
              },
            ]}
          />
        )}
      </WizardStep>

      {/* Erfolg */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[schicht]}
          submit={submit}
          restartLabel={tx('Noch eine Schicht anlegen')}
          whatHappensNext={tx('Helfer können jederzeit nachträglich zugewiesen werden.')}
          next={[
            { label: tx('Noch eine Schicht anlegen'), onClick: restart },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
