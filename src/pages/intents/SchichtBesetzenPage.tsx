/**
 * Schicht besetzen — 4-Schritt-Wizard.
 * Steps: 1) Veranstaltung wählen → 2) Helferschicht wählen → 3) Helfer zuordnen → 4) Prüfen & aktualisieren.
 * Reads: veranstaltungen, helferschichten, mitglieder.
 * Writes: helferschichten (update helfer-Feld: merge bestehende + neue Helfer-IDs).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep, BudgetTracker, StatusBadge.
 */
import { useState, useMemo } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import {
  useRecordSearch,
  useStepForm,
  useJourneySubmit,
  fieldText,
  fieldLookup,
  fieldDate,
  fieldNumber,
  fieldRef,
  refFilter,
  combineFilters,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { formatDate } from '@/lib/formatters';
import { IconUsers, IconCalendar, IconMapPin } from '@tabler/icons-react';

export default function SchichtBesetzenPage() {
  const [step, setStep] = useState(1);

  // Step 1: Veranstaltungen — nur geplant oder offen_anmeldung
  const veranstaltungen = useRecordSearch(servicePort, 'veranstaltungen', {
    filter: "r.v_status in ['geplant', 'offen_anmeldung']",
    where: r => {
      const s = fieldLookup(r, 'status')?.key;
      return s === 'geplant' || s === 'offen_anmeldung';
    },
    searchFields: ['titel', 'ort'],
    toItem: v => ({
      id: v.id,
      title: fieldText(v, 'titel'),
      subtitle: [
        fieldDate(v, 'datum') ? formatDate(fieldDate(v, 'datum')!) : null,
        fieldText(v, 'ort') || null,
      ].filter(Boolean).join(' · '),
      status: fieldLookup(v, 'status') ?? undefined,
    }),
  });

  // Step 2: Schichten der gewählten Veranstaltung
  const selectedVeranstaltungId = useState<string | null>(null);
  // We need to track selected veranstaltung id for filtering — use form value
  const schichtForm = useStepForm('helferschichten', {
    fields: ['veranstaltung', 'helfer'],
    steps: { veranstaltung: 1, helfer: 3 },
    messages: {
      bezeichnung: tx('Bitte eine Bezeichnung für die Schicht eingeben.'),
      beginn: tx('Bitte den Beginn der Schicht wählen.'),
      ende: tx('Bitte das Ende der Schicht wählen.'),
      benoetigte_helfer: tx('Bitte die Anzahl benötigter Helfer eingeben.'),
      veranstaltung: tx('Bitte eine Veranstaltung auswählen.'),
    },
    required: {
      bezeichnung: false,
      beginn: false,
      ende: false,
      benoetigte_helfer: false,
      bemerkung: false,
      veranstaltung: false,
    },
  });

  const veranstaltungId = schichtForm.get('veranstaltung') as string | null;
  const selectedSchichtId = useState<string | null>(null);
  // Track the chosen Schicht record for display
  const [chosenSchicht, setChosenSchicht] = useState<import('@/lib/journey').JourneyRecord | null>(null);

  const helferschichten = useRecordSearch(servicePort, 'helferschichten', {
    filter: veranstaltungId ? refFilter('veranstaltung', veranstaltungId) : tx('r.v_veranstaltung is None'),
    where: r => {
      const ref = fieldRef(r, 'veranstaltung');
      return veranstaltungId ? ref === veranstaltungId : false;
    },
    searchFields: ['bezeichnung'],
    toItem: r => {
      const helferVal = r.fields['helfer'];
      const helferCount = Array.isArray(helferVal) ? helferVal.length : 0;
      const benoetigt = fieldNumber(r, 'benoetigte_helfer') ?? 0;
      const beginn = fieldDate(r, 'beginn');
      const ende = fieldDate(r, 'ende');
      return {
        id: r.id,
        title: fieldText(r, 'bezeichnung'),
        subtitle: [
          beginn ? formatDate(beginn) : null,
          ende ? `– ${formatDate(ende)}` : null,
        ].filter(Boolean).join(' '),
        stats: [
          { label: tx('Helfer'), value: `${helferCount} / ${benoetigt}` },
        ],
      };
    },
  });

  // Step 3: Mitglieder — aktive Mitglieder als Helfer wählen
  const mitglieder = useRecordSearch(servicePort, 'mitglieder', {
    filter: "r.v_status == 'aktiv'",
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    searchFields: ['vorname', 'nachname', 'mitgliedsnummer'],
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldText(m, 'mitgliedsnummer') || undefined,
    }),
  });

  // Track which schicht id was selected for the update step
  const [schichtId, setSchichtId] = useState<string | null>(null);

  // Compute: existing helfer ids of the chosen Schicht + newly selected ids = merged list
  const existingHelferIds = useMemo<string[]>(() => {
    if (!chosenSchicht) return [];
    const val = chosenSchicht.fields['helfer'];
    if (!Array.isArray(val)) return [];
    return val.map((v: unknown) => {
      if (typeof v === 'string') {
        // May be a record URL — extract last segment
        const parts = v.split('/');
        return parts[parts.length - 1];
      }
      return String(v);
    }).filter(Boolean);
  }, [chosenSchicht]);

  const newHelferIds = (schichtForm.get('helfer') as string[] | null) ?? [];

  const mergedHelferIds = useMemo<string[]>(() => {
    const all = [...existingHelferIds];
    for (const id of newHelferIds) {
      if (!all.includes(id)) all.push(id);
    }
    return all;
  }, [existingHelferIds, newHelferIds]);

  const benoetigteHelfer = chosenSchicht ? (fieldNumber(chosenSchicht, 'benoetigte_helfer') ?? 0) : 0;
  const nochFehlend = Math.max(0, benoetigteHelfer - mergedHelferIds.length);

  // The plan: update the Schicht's helfer field with merged ids
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'schicht',
      entity: 'helferschichten',
      updates: () => schichtId ?? '',
      values: () => ({ helfer: mergedHelferIds }),
      primary: true,
      verb: 'update',
    },
  ], { draftKey: 'schicht-besetzen' });

  const veranstaltungRecord = veranstaltungId ? veranstaltungen.recordOf(veranstaltungId) : undefined;
  const veranstaltungTitel = veranstaltungId ? (veranstaltungen.labelOf(veranstaltungId) ?? '') : '';

  return (
    <IntentWizardShell
      title={tx('Schicht besetzen')}
      subtitle={tx('Helferschicht einer Veranstaltung mit Mitgliedern besetzen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[schichtForm]}
      draftKey="schicht-besetzen"
      intro={{
        description: tx('Eine Helferschicht auswählen und Mitglieder als Helfer eintragen.'),
        needs: [tx('Veranstaltung'), tx('Helferschicht'), tx('Mitgliedsnamen')],
      }}
    >
      {/* Schritt 1: Veranstaltung wählen */}
      <WizardStep
        label={tx('Veranstaltung')}
        description={tx('Wähle eine geplante oder zur Anmeldung offene Veranstaltung.')}
      >
        <EntitySelectStep
          {...veranstaltungen.select}
          selectedId={veranstaltungId}
          onSelect={id => {
            schichtForm.set('veranstaltung', id, veranstaltungen.labelOf(id));
            setSchichtId(null);
            setChosenSchicht(null);
            schichtForm.set('helfer', [], undefined);
            setStep(2);
          }}
          searchPlaceholder={tx('Veranstaltung suchen…')}
          emptyText={tx('Keine geplanten Veranstaltungen gefunden.')}
          create={false}
          avatar="none"
        />
      </WizardStep>

      {/* Schritt 2: Helferschicht wählen */}
      <WizardStep
        label={tx('Helferschicht')}
        description={tx('Wähle die Schicht, die besetzt werden soll.')}
        needs={['veranstaltung']}
      >
        {veranstaltungId ? (
          <EntitySelectStep
            {...helferschichten.select}
            selectedId={schichtId}
            onSelect={id => {
              setSchichtId(id);
              const rec = helferschichten.recordOf(id);
              setChosenSchicht(rec ?? null);
              schichtForm.set('helfer', [], undefined);
              setStep(3);
            }}
            searchPlaceholder={tx('Schicht suchen…')}
            emptyText={tx('Keine Schichten für diese Veranstaltung gefunden.')}
            create={false}
            avatar="none"
          />
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst eine Veranstaltung wählen.')}
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 3: Helfer zuordnen */}
      <WizardStep
        label={tx('Helfer')}
        description={tx('Wähle ein oder mehrere aktive Mitglieder als Helfer. Bestehende Helfer bleiben erhalten.')}
        needs={['veranstaltung']}
      >
        {schichtId && chosenSchicht ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary p-3 space-y-1 text-sm">
              <div className="font-medium">{fieldText(chosenSchicht, 'bezeichnung')}</div>
              {(fieldDate(chosenSchicht, 'beginn') || fieldDate(chosenSchicht, 'ende')) && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <IconCalendar size={14} className="shrink-0" />
                  <span>
                    {fieldDate(chosenSchicht, 'beginn') ? formatDate(fieldDate(chosenSchicht, 'beginn')!) : ''}
                    {fieldDate(chosenSchicht, 'ende') ? ` – ${formatDate(fieldDate(chosenSchicht, 'ende')!)}` : ''}
                  </span>
                </div>
              )}
              {veranstaltungRecord && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <IconMapPin size={14} className="shrink-0" />
                  <span>{fieldText(veranstaltungRecord, 'ort')}</span>
                </div>
              )}
            </div>

            <BudgetTracker
              format="count"
              unit={tx('Helfer')}
              budget={benoetigteHelfer}
              booked={mergedHelferIds.length}
              label={tx('Schichtbesetzung')}
              texts={{
                booked: tx('Eingetragen'),
                remaining: nochFehlend > 0 ? tx('Noch benötigt') : tx('Besetzt'),
                over: tx('Mehr Helfer als benötigt'),
                none: tx('Keine Kapazität festgelegt'),
              }}
            />

            {existingHelferIds.length > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <IconUsers size={14} className="shrink-0" />
                {tx('Bereits eingetragen:')} {existingHelferIds.length}
              </p>
            )}

            <Field form={schichtForm} name="helfer" label={tx('Neue Helfer hinzufügen')}>
              <EntitySelectStep
                {...mitglieder.select}
                {...schichtForm.records('helfer', mitglieder.labelOf)}
                searchPlaceholder={tx('Mitglied suchen…')}
                emptyText={tx('Keine aktiven Mitglieder gefunden.')}
                create={false}
                avatar="initials"
              />
            </Field>

            <StepNav
              onBack={() => setStep(2)}
              onNext={() => {
                if (newHelferIds.length === 0 && existingHelferIds.length === 0) {
                  return tx('Bitte mindestens ein Mitglied als Helfer auswählen.');
                }
                return true;
              }}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(2)} nextDisabled>
            {tx('Bitte zuerst eine Schicht wählen.')}
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 4: Prüfen & bestätigen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done ? (
          <SummaryStep
            forms={[schichtForm]}
            submit={submit}
            items={[
              {
                key: 'veranstaltung_titel',
                label: tx('Veranstaltung'),
                value: veranstaltungTitel,
                step: 1,
              },
              {
                key: 'schicht_bezeichnung',
                label: tx('Schicht'),
                value: chosenSchicht ? fieldText(chosenSchicht, 'bezeichnung') : '—',
                step: 2,
              },
              {
                key: 'helfer_gesamt',
                label: tx('Helfer gesamt nach Aktualisierung'),
                value: String(mergedHelferIds.length),
              },
            ]}
            whatHappensNext={tx('Die Schicht wird sofort mit den ausgewählten Helfern aktualisiert.')}
            confirmLabel={tx('Schicht besetzen')}
          />
        ) : null}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          title={tx('Schicht besetzt')}
          verb="updated"
          facts={[
            { label: tx('Veranstaltung'), value: veranstaltungTitel },
            {
              label: tx('Schicht'),
              value: chosenSchicht ? fieldText(chosenSchicht, 'bezeichnung') : '—',
            },
            {
              label: tx('Eingetragene Helfer'),
              value: String(mergedHelferIds.length),
            },
          ]}
          next={[
            { label: tx('Weitere Schicht besetzen'), href: '#/intents/schicht-besetzen' },
            { label: tx('Anmeldung'), href: '#/intents/veranstaltungsanmeldung' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Die Helfer sind jetzt für diese Schicht eingetragen.')}
          actions={{ copy: false, print: false }}
          restartLabel={tx('Weitere Schicht besetzen')}
        />
      )}
    </IntentWizardShell>
  );
}
