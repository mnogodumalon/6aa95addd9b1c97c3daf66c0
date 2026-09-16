/**
 * Helferschicht besetzen — 4-Schritt-Wizard.
 * Steps: 1) Veranstaltung wählen → 2) Helferschicht wählen → 3) Helfer zuordnen → 4) Prüfen & speichern.
 * Reads: veranstaltungen, helferschichten, mitglieder.
 * Writes: helferschichten (update — helfer-Feld um neuen Helfer ergänzen).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, BudgetTracker, SummaryStep, SuccessStep, StepNav.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { BudgetTracker } from '@/components/blocks/BudgetTracker';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldNumber,
  fieldRef,
  refFilter,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function HelferschichtBesetzenPage() {
  const [step, setStep] = useState(1);
  const [selectedVeranstaltungId, setSelectedVeranstaltungId] = useState<string | null>(null);
  const [selectedSchichtId, setSelectedSchichtId] = useState<string | null>(null);
  const [neuerHelferId, setNeuerHelferId] = useState<string | null>(null);
  const [duplikatWarnung, setDuplikatWarnung] = useState(false);

  // Schritt 1: Veranstaltungen — nur geplant oder offen_anmeldung
  const veranstaltungen = useRecordSearch(servicePort, 'veranstaltungen', {
    searchFields: ['titel', 'ort'],
    filter: "r.v_status in ['geplant', 'offen_anmeldung']",
    where: r => {
      const key = (r.fields.status as { key: string } | null)?.key;
      return key === 'geplant' || key === 'offen_anmeldung';
    },
    toItem: v => ({
      id: v.id,
      title: fieldText(v, 'titel'),
      subtitle: fieldText(v, 'ort'),
      status: (v.fields.status as { key: string; label: string } | null) ?? undefined,
    }),
  });

  // Schritt 2: Helferschichten der gewählten Veranstaltung
  const helferschichten = useRecordSearch(servicePort, 'helferschichten', {
    searchFields: ['bezeichnung'],
    filter: selectedVeranstaltungId
      ? refFilter('veranstaltung', selectedVeranstaltungId)
      : tx('r.v_bezeichnung == \'__kein_treffer__\''),
    where: r => {
      if (!selectedVeranstaltungId) return false;
      const ref = fieldRef(r, 'veranstaltung');
      return ref === selectedVeranstaltungId;
    },
    toItem: s => {
      const beginn = s.fields.beginn as string | null;
      const ende = s.fields.ende as string | null;
      const zeitraum = beginn && ende
        ? tx`${beginn.slice(11, 16)} – ${ende.slice(11, 16)} Uhr`
        : undefined;
      const benoetigte = fieldNumber(s, 'benoetigte_helfer') ?? 0;
      const vorhandene = Array.isArray(s.fields.helfer) ? (s.fields.helfer as unknown[]).length : 0;
      return {
        id: s.id,
        title: fieldText(s, 'bezeichnung'),
        subtitle: zeitraum,
        stats: [
          { label: tx('Benötigt'), value: benoetigte },
          { label: tx('Eingetragen'), value: vorhandene },
          { label: tx('Frei'), value: Math.max(0, benoetigte - vorhandene) },
        ],
      };
    },
  });

  // Schritt 3: Mitglieder — nur aktive
  const mitglieder = useRecordSearch(servicePort, 'mitglieder', {
    searchFields: ['vorname', 'nachname', 'mitgliedsnummer'],
    filter: "r.v_status == 'aktiv'",
    where: r => (r.fields.status as { key: string } | null)?.key === 'aktiv',
    toItem: m => ({
      id: m.id,
      title: `${fieldText(m, 'vorname')} ${fieldText(m, 'nachname')}`.trim(),
      subtitle: fieldText(m, 'mitgliedsnummer'),
    }),
  });

  // Form (für SummaryStep / Validierung — nur Pflichtfeld-Marker, kein echtes Input-Binding)
  const f = useStepForm('helferschichten', {
    fields: ['veranstaltung', 'helfer'],
    steps: { veranstaltung: 1, helfer: 3 },
    required: { veranstaltung: true, helfer: true },
  });

  // Kapazitätsinfos aus der gewählten Schicht
  const selectedSchicht = selectedSchichtId ? helferschichten.recordOf(selectedSchichtId) : undefined;
  const benoetigte = selectedSchicht ? (fieldNumber(selectedSchicht, 'benoetigte_helfer') ?? 0) : 0;
  const vorhandeneHelfer: string[] = selectedSchicht && Array.isArray(selectedSchicht.fields.helfer)
    ? (selectedSchicht.fields.helfer as string[])
    : [];
  const aktuelleAnzahl = vorhandeneHelfer.length;
  const gesamtNachZuordnung = aktuelleAnzahl + (neuerHelferId && !vorhandeneHelfer.includes(neuerHelferId) ? 1 : 0);

  // Plan: Update der Helferschicht — helfer-Feld auf erweiterte Liste setzen
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'schicht',
      entity: 'helferschichten',
      updates: selectedSchichtId ?? '',
      primary: true,
      verb: 'update',
      values: () => {
        const neueHelfer = neuerHelferId && !vorhandeneHelfer.includes(neuerHelferId)
          ? [...vorhandeneHelfer, neuerHelferId]
          : vorhandeneHelfer;
        return { helfer: neueHelfer };
      },
    },
  ], { draftKey: 'helferschicht-besetzen' });

  // Anzeige-Namen für Summary / Success
  const veranstaltungName = selectedVeranstaltungId
    ? (veranstaltungen.labelOf(selectedVeranstaltungId) ?? '—')
    : '—';
  const schichtName = selectedSchichtId
    ? (helferschichten.labelOf(selectedSchichtId) ?? '—')
    : '—';
  const helferName = neuerHelferId
    ? (mitglieder.labelOf(neuerHelferId) ?? '—')
    : '—';

  const restart = () => {
    submit.reset();
    f.reset();
    setSelectedVeranstaltungId(null);
    setSelectedSchichtId(null);
    setNeuerHelferId(null);
    setDuplikatWarnung(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Helferschicht besetzen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="helferschicht-besetzen"
      intro={{
        description: tx('Einen Helfer einer bestehenden Helferschicht zuordnen.'),
        needs: [tx('Name des Helfers'), tx('Veranstaltung und Schichtbezeichnung')],
      }}
    >
      {/* Schritt 1: Veranstaltung wählen */}
      <WizardStep
        label={tx('Veranstaltung')}
        description={tx('Veranstaltung wählen, für die ein Helfer eingetragen werden soll.')}
      >
        <EntitySelectStep
          {...veranstaltungen.select}
          selectedId={selectedVeranstaltungId}
          onSelect={id => {
            setSelectedVeranstaltungId(id);
            f.set('veranstaltung', id, veranstaltungen.labelOf(id));
            setSelectedSchichtId(null);
            setNeuerHelferId(null);
            setDuplikatWarnung(false);
            setStep(2);
          }}
          emptyText={tx('Keine Veranstaltungen mit Status „Geplant" oder „Anmeldung offen" gefunden.')}
          create={false}
          avatar="none"
        />
      </WizardStep>

      {/* Schritt 2: Helferschicht wählen */}
      <WizardStep
        label={tx('Helferschicht')}
        description={tx('Schicht der gewählten Veranstaltung auswählen und freie Plätze prüfen.')}
        needs={['veranstaltung']}
      >
        {selectedVeranstaltungId ? (
          <EntitySelectStep
            {...helferschichten.select}
            selectedId={selectedSchichtId}
            onSelect={id => {
              setSelectedSchichtId(id);
              setNeuerHelferId(null);
              setDuplikatWarnung(false);
              setStep(3);
            }}
            emptyText={tx('Für diese Veranstaltung sind keine Helferschichten hinterlegt.')}
            create={false}
            avatar="none"
          />
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst eine Veranstaltung in Schritt 1 wählen.')}
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 3: Helfer auswählen */}
      <WizardStep
        label={tx('Helfer')}
        description={tx('Aktives Mitglied als Helfer für diese Schicht eintragen.')}
        needs={['veranstaltung']}
      >
        {selectedSchichtId ? (
          <div className="space-y-4">
            <BudgetTracker
              format="count"
              unit={tx('Plätze')}
              budget={benoetigte}
              booked={aktuelleAnzahl}
              label={tx('Schichtauslastung')}
              showRemaining
              texts={{
                booked: tx('Besetzt'),
                remaining: tx('frei'),
                over: tx('Kapazität überschritten'),
                none: tx('Keine Kapazität definiert'),
              }}
            />

            {duplikatWarnung && (
              <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {tx('Dieses Mitglied ist bereits als Helfer eingetragen.')}
              </p>
            )}

            <EntitySelectStep
              {...mitglieder.select}
              selectedId={neuerHelferId}
              onSelect={id => {
                const bereitsEingetragen = vorhandeneHelfer.includes(id);
                setDuplikatWarnung(bereitsEingetragen);
                if (!bereitsEingetragen) {
                  setNeuerHelferId(id);
                  f.set('helfer', [id], mitglieder.labelOf(id));
                }
              }}
              emptyText={tx('Keine aktiven Mitglieder gefunden.')}
              create={false}
              searchPlaceholder={tx('Vorname, Nachname oder Mitgliedsnummer')}
            />

            <StepNav
              onBack={() => setStep(2)}
              onNext={() => {
                if (!neuerHelferId) return tx('Bitte einen Helfer auswählen.');
                if (duplikatWarnung) return tx('Dieses Mitglied ist bereits als Helfer eingetragen.');
              }}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(2)} nextDisabled>
            {tx('Bitte zuerst eine Helferschicht in Schritt 2 wählen.')}
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 4: Prüfen & Bestätigen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && selectedSchichtId && neuerHelferId ? (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Der Helfer wird sofort der Schicht zugeordnet und in der Helferliste angezeigt.')}
            items={[
              { key: 'veranstaltung_name', label: tx('Veranstaltung'), value: veranstaltungName },
              { key: 'schicht_name', label: tx('Helferschicht'), value: schichtName },
              { key: 'neuer_helfer', label: tx('Neuer Helfer'), value: helferName },
              {
                key: 'gesamt_helfer',
                label: tx('Helfer gesamt nach Zuordnung'),
                value: String(gesamtNachZuordnung),
              },
            ]}
          />
        ) : !selectedSchichtId || !neuerHelferId ? (
          <StepNav onBack={() => setStep(!neuerHelferId ? 3 : 2)} nextDisabled>
            {tx('Bitte alle vorherigen Schritte abschließen.')}
          </StepNav>
        ) : null}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          restartLabel={tx('Weiteren Helfer zuordnen')}
          whatHappensNext={tx('Der Helfer ist jetzt für die Schicht eingetragen.')}
          next={[
            { label: tx('Zum Dashboard'), href: '#/' },
            { label: tx('Zur Veranstaltung anmelden'), href: '#/intents/veranstaltung-anmelden' },
          ]}
          facts={[
            { label: tx('Helferschicht'), value: schichtName },
            { label: tx('Zugeordneter Helfer'), value: helferName },
          ]}
          actions={{ copy: false, print: false }}
        />
      )}
    </IntentWizardShell>
  );
}
