import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { LOOKUP_OPTIONS } from '@/types/app';
import { useStepForm, useJourneySubmit, useRecordSearch, optionsOf, type JourneyRecord } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Bound } from '@/components/blocks/Bound';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';

const SLUG = 'mitglied-werden';

interface AbteilungItem {
  id: string;
  title: string;
  subtitle?: string;
}

export default function MitgliedWerden() {
  const STEPS = [
  { label: tx('Persönliche Daten'), key: 'person' },
  { label: tx('Adresse'), key: 'adresse' },
  { label: tx('Mitgliedschaft'), key: 'mitgliedschaft' },
  { label: tx('SEPA-Mandat'), key: 'sepa' },
  { label: tx('Zusammenfassung'), key: 'zusammenfassung' },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [sepaMandatError, setSepaMandatError] = useState(false);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setPage(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  // Determine first status key at runtime
  const firstStatusKey = LOOKUP_OPTIONS['mitglieder']?.['status']?.[0]?.key ?? 'aktiv';

  const f = useStepForm('mitglieder', {
    fields: [
      'vorname', 'nachname', 'geburtsdatum', 'email', 'telefon',
      'strasse', 'hausnummer', 'plz', 'ort',
      'abteilung', 'beitragsklasse', 'sepa_mandat',
    ],
    required: {
      vorname: true,
      nachname: true,
      geburtsdatum: true,
      email: false,
      telefon: false,
      strasse: false,
      hausnummer: false,
      plz: false,
      ort: false,
      abteilung: true,
      beitragsklasse: true,
      sepa_mandat: false,
    },
    steps: {
      vorname: 1, nachname: 1, geburtsdatum: 1, email: 1, telefon: 1,
      strasse: 2, hausnummer: 2, plz: 2, ort: 2,
      abteilung: 3, beitragsklasse: 3,
      sepa_mandat: 4,
    },
    autoComplete: true,
  });

  const abteilungSearch = useRecordSearch(
    port ?? ({} as never),
    'abteilungen',
    {
      searchFields: [],
      toItem: (r): AbteilungItem => ({
        id: r.id,
        title: (r.fields.name as string) ?? r.id,
      }),
    },
  );

  const submit = useJourneySubmit(
    port ?? ({} as never),
    [
      {
        key: 'mitglied',
        entity: 'mitglieder',
        form: f,
        primary: true,
        values: { status: firstStatusKey },
      },
    ],
    { draftKey: 'mitglied-werden' },
  );

  // ALL hooks above this point — early returns only after all hooks
  if (loading) return <PublicShell loading />;
  if (!cfg || !page || !port) return <PublicShell unavailable />;

  const sepaChecked = f.get('sepa_mandat') as boolean | undefined;

  const handleSepaNext = () => {
    if (!sepaChecked) {
      setSepaMandatError(true);
      return false;
    }
    setSepaMandatError(false);
    return true;
  };

  const beitragsklasseOptions = optionsOf('mitglieder', 'beitragsklasse');

  const abteilungId = f.get('abteilung') as string | null;
  const selectedAbteilung: JourneyRecord | undefined = abteilungSearch.records.find(r => r.id === abteilungId);
  const jahresbeitragErwachsene = selectedAbteilung
    ? (selectedAbteilung.fields.jahresbeitrag_erwachsene as number | null)
    : null;
  const jahresbeitragKinder = selectedAbteilung
    ? (selectedAbteilung.fields.jahresbeitrag_kinder as number | null)
    : null;

  const restart = () => {
    f.reset();
    submit.reset();
    setSepaMandatError(false);
    setStep(1);
  };

  return (
    <PublicShell
      title={tx('Mitglied werden')}
      description={tx('Füllen Sie das Formular aus, um Mitglied in unserem Verein zu werden.')}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey="mitglied-werden"
      >
        {/* Schritt 1: Persönliche Daten */}
        {step === 1 && !submit.done && (
          <WizardStep
            label={tx('Persönliche Daten')}
            description={tx('Bitte geben Sie Ihre persönlichen Daten ein.')}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field form={f} name="vorname">
                  <input {...f.field('vorname')} className="input" />
                </Field>
                <Field form={f} name="nachname">
                  <input {...f.field('nachname')} className="input" />
                </Field>
              </div>
              <Bound form={f} name="geburtsdatum" as="date" />
              <Field form={f} name="email">
                <input {...f.field('email')} className="input" />
              </Field>
              <Field form={f} name="telefon">
                <input {...f.field('telefon')} className="input" />
              </Field>
              <StepNav
                onNext={() => f.validate(['vorname', 'nachname', 'geburtsdatum'])}
                nextStepLabel={tx('Adresse')}
                hideBack
              />
            </div>
          </WizardStep>
        )}

        {/* Schritt 2: Adresse */}
        {step === 2 && !submit.done && (
          <WizardStep
            label={tx('Adresse')}
            description={tx('Ihre Wohnanschrift (optional, aber empfohlen).')}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field form={f} name="strasse">
                    <input {...f.field('strasse')} className="input" />
                  </Field>
                </div>
                <Field form={f} name="hausnummer">
                  <input {...f.field('hausnummer')} className="input" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field form={f} name="plz">
                  <input {...f.field('plz')} className="input" />
                </Field>
                <div className="col-span-2">
                  <Field form={f} name="ort">
                    <input {...f.field('ort')} className="input" />
                  </Field>
                </div>
              </div>
              <StepNav
                onBack={() => setStep(1)}
                onNext={() => true}
                nextStepLabel={tx('Mitgliedschaft')}
              />
            </div>
          </WizardStep>
        )}

        {/* Schritt 3: Mitgliedschaft */}
        {step === 3 && !submit.done && (
          <WizardStep
            label={tx('Mitgliedschaft')}
            description={tx('Wählen Sie Ihre Abteilung und Beitragsklasse.')}
          >
            <div className="space-y-6">
              <Field form={f} name="abteilung">
                <EntitySelectStep
                  {...abteilungSearch.select}
                  id={f.record('abteilung').id}
                  invalid={f.record('abteilung').invalid}
                  selectedId={abteilungId}
                  onSelect={(id) => {
                    const label = abteilungSearch.labelOf(id);
                    f.set('abteilung', id, label ?? id);
                  }}
                  avatar="none"
                  columns={1}
                />
              </Field>

              {/* Jahresbeitrag-Anzeige */}
              {selectedAbteilung && (jahresbeitragErwachsene !== null || jahresbeitragKinder !== null) && (
                <div className="rounded-lg bg-muted px-4 py-3 text-sm space-y-1">
                  <p className="font-semibold text-foreground">{tx('Jahresbeiträge dieser Abteilung')}</p>
                  {jahresbeitragErwachsene !== null && (
                    <p>
                      {tx('Erwachsene')}{': '}
                      <span className="font-medium">{jahresbeitragErwachsene} €</span>
                    </p>
                  )}
                  {jahresbeitragKinder !== null && (
                    <p>
                      {tx('Kinder')}{': '}
                      <span className="font-medium">{jahresbeitragKinder} €</span>
                    </p>
                  )}
                </div>
              )}

              <Field form={f} name="beitragsklasse">
                <ChoiceGroup
                  {...f.choice('beitragsklasse')}
                  options={beitragsklasseOptions}
                />
              </Field>

              <StepNav
                onBack={() => setStep(2)}
                onNext={() => f.validate(['abteilung', 'beitragsklasse'])}
                nextStepLabel={tx('SEPA-Mandat')}
              />
            </div>
          </WizardStep>
        )}

        {/* Schritt 4: SEPA-Mandat */}
        {step === 4 && !submit.done && (
          <WizardStep
            label={tx('SEPA-Mandat')}
            description={tx('Erteilen Sie dem Verein eine SEPA-Lastschrift-Genehmigung.')}
          >
            <div className="space-y-5">
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {tx('Mit Ihrer Unterschrift (Klick auf die Checkbox) ermächtigen Sie den Verein, Beiträge von Ihrem Konto per Lastschrift einzuziehen. Sie können das Mandat jederzeit schriftlich widerrufen.')}
                </p>
                <Field form={f} name="sepa_mandat" hideLabel>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={f.checkbox('sepa_mandat').id}
                      checked={!!sepaChecked}
                      onChange={e => {
                        f.set('sepa_mandat', e.target.checked);
                        if (e.target.checked) setSepaMandatError(false);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-input"
                      aria-required="true"
                      aria-invalid={sepaMandatError || undefined}
                    />
                    <label htmlFor={f.checkbox('sepa_mandat').id} className="text-sm font-medium leading-snug cursor-pointer">
                      {tx('Ich ermächtige den Verein zum Lastschrifteinzug (SEPA-Mandat)')}
                      <span className="text-destructive ml-1">*</span>
                    </label>
                  </div>
                </Field>
                {sepaMandatError && (
                  <p className="text-sm text-destructive">
                    {tx('Bitte bestätigen Sie das SEPA-Mandat, um fortzufahren.')}
                  </p>
                )}
              </div>
              <StepNav
                onBack={() => setStep(3)}
                onNext={handleSepaNext}
                nextStepLabel={tx('Zusammenfassung')}
              />
            </div>
          </WizardStep>
        )}

        {/* Schritt 5: Zusammenfassung */}
        {step === 5 && !submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Ihr Beitrittsantrag wird vom Vorstand geprüft. Sie erhalten eine Bestätigung per E-Mail.')}
            confirmLabel={tx('Jetzt Mitglied werden')}
          />
        )}

        {/* Erfolg */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            title={tx('Beitrittsantrag eingereicht')}
            whatHappensNext={tx('Ihr Beitrittsantrag wurde erfolgreich übermittelt. Der Vorstand wird sich in Kürze bei Ihnen melden.')}
            next={[{ label: tx('Weiteren Antrag stellen'), onClick: restart }]}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
