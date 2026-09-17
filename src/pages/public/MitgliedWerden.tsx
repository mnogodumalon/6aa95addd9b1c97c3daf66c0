import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldLookup, fieldNumber,
  type JourneyRecord,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { FieldErrorSummary } from '@/components/blocks/FieldErrorSummary';
import { Bound } from '@/components/blocks/Bound';
import { Input } from '@/components/ui/input';
import { tx } from '@/i18n';

// ── Abteilung item ──────────────────────────────────────────────────────────

interface AbteilungItem {
  id: string;
  title: string;
  stats?: { label: string; value: string | number }[];
}

function toAbteilungItem(r: JourneyRecord): AbteilungItem {
  const name = fieldLookup(r, 'name');
  const beitragErw = fieldNumber(r, 'jahresbeitrag_erwachsene');
  const beitragKind = fieldNumber(r, 'jahresbeitrag_kinder');

  const fmt = (n: number | null) =>
    n != null
      ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
      : '—';

  return {
    id: r.id,
    title: name?.label ?? r.id,
    stats: [
      { label: tx('Erwachsene / Jahr'), value: fmt(beitragErw) },
      { label: tx('Kinder / Jahr'), value: fmt(beitragKind) },
    ],
  };
}

// ── Steps ───────────────────────────────────────────────────────────────────

// ── Page ────────────────────────────────────────────────────────────────────

export default function MitgliedWerden() {
  const STEPS: WizardStep[] = [
  { label: tx('Persönliche Daten'), key: 'persoenlich' },
  { label: tx('Abteilung'), key: 'abteilung' },
  { label: tx('SEPA-Mandat'), key: 'sepa' },
  { label: tx('Prüfen & Absenden'), key: 'zusammenfassung' },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig('mitglied-werden')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['mitglied-werden'] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  // All hooks before any early return
  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  const f = useStepForm('mitglieder', {
    fields: [
      'vorname', 'nachname', 'geburtsdatum',
      'email', 'telefon',
      'strasse', 'hausnummer', 'plz', 'ort',
      'abteilung',
      'sepa_mandat',
    ],
    required: {
      vorname: true,
      nachname: true,
      geburtsdatum: true,
      abteilung: true,
      sepa_mandat: true,
    },
    steps: {
      vorname: 1, nachname: 1, geburtsdatum: 1,
      email: 1, telefon: 1,
      strasse: 1, hausnummer: 1, plz: 1, ort: 1,
      abteilung: 2,
      sepa_mandat: 3,
    },
    autoComplete: true,
  });

  const abteilungSearch = useRecordSearch(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    'abteilungen',
    {
      searchFields: [],
      toItem: toAbteilungItem,
    },
  );

  const submit = useJourneySubmit(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    [
      {
        key: 'mitglied',
        entity: 'mitglieder',
        form: f,
        primary: true,
      },
    ],
    { draftKey: 'mitglied-werden' },
  );

  if (loading || unavailable || !cfg || !page || !port) {
    return <PublicShell loading={loading} unavailable={unavailable || (!loading && (!cfg || !page))} />;
  }

  const createEp = page.endpoints?.find(e => e.entity === 'mitglieder' && e.op === 'create');
  if (createEp) {
    prepareChallenge(cfg, page, 'POST', `/apps/${createEp.app_id}/records`);
  }

  const selectedAbteilungId = f.get('abteilung') as string | null;

  const handleSelectAbteilung = (id: string) => {
    const label = abteilungSearch.labelOf(id) ?? id;
    f.set('abteilung', id, label);
    setStep(3);
  };

  const handleRestart = () => {
    submit.reset();
    f.reset();
    setStep(1);
  };

  return (
    <PublicShell
      title={tx('Mitglied werden')}
      description={tx('Werden Sie Mitglied in unserem Verein. Füllen Sie das Formular aus – wir prüfen Ihren Antrag und melden uns.')}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey="mitglied-werden"
      >
        {/* ── Schritt 1: Persönliche Daten ── */}
        {step === 1 && !submit.done && (
          <div className="space-y-4">
            <FieldErrorSummary forms={[f]} step={1} />

            <div className="grid grid-cols-2 gap-4">
              <Field form={f} name="vorname">
                <Input {...f.field('vorname')} placeholder={tx('Max')} />
              </Field>
              <Field form={f} name="nachname">
                <Input {...f.field('nachname')} placeholder={tx('Mustermann')} />
              </Field>
            </div>

            <Field form={f} name="geburtsdatum">
              <Bound form={f} name="geburtsdatum" />
            </Field>

            <Field form={f} name="email">
              <Input {...f.field('email')} placeholder={tx('max@beispiel.de')} />
            </Field>

            <Field form={f} name="telefon">
              <Input {...f.field('telefon')} placeholder="+49 170 1234567" />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field form={f} name="strasse">
                  <Input {...f.field('strasse')} placeholder={tx('Musterstraße')} />
                </Field>
              </div>
              <Field form={f} name="hausnummer">
                <Input {...f.field('hausnummer')} placeholder="1a" />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field form={f} name="plz">
                <Input {...f.field('plz')} placeholder="12345" />
              </Field>
              <div className="col-span-2">
                <Field form={f} name="ort">
                  <Input {...f.field('ort')} placeholder={tx('Musterstadt')} />
                </Field>
              </div>
            </div>

            <StepNav
              hideBack
              onNext={() => f.validate(['vorname', 'nachname', 'geburtsdatum'])}
              nextStepLabel={tx('Abteilung')}
            />
          </div>
        )}

        {/* ── Schritt 2: Abteilung wählen ── */}
        {step === 2 && !submit.done && (
          <div className="space-y-4">
            <FieldErrorSummary forms={[f]} step={2} />

            {abteilungSearch.select.loading && (
              <p className="text-sm text-muted-foreground">{tx('Abteilungen werden geladen …')}</p>
            )}
            {abteilungSearch.select.error && (
              <p className="text-sm text-destructive">{abteilungSearch.select.error}</p>
            )}

            <div className="grid gap-3">
              {abteilungSearch.select.items.map(item => {
                const isSelected = selectedAbteilungId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectAbteilung(item.id)}
                    className={[
                      'w-full rounded-lg border-2 p-4 text-left transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-muted/40',
                    ].join(' ')}
                  >
                    <div className="font-semibold text-base mb-2">{item.title}</div>
                    {item.stats && (
                      <div className="flex gap-6 text-sm">
                        {item.stats.map(s => (
                          <div key={s.label}>
                            <span className="text-muted-foreground">{s.label}: </span>
                            <span className="font-medium">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {f.error('abteilung') && (
              <p className="text-sm text-destructive">{f.error('abteilung')}</p>
            )}

            <StepNav
              onBack={() => setStep(1)}
              onNext={() => f.validate(['abteilung'])}
              nextStepLabel={tx('SEPA-Mandat')}
            />
          </div>
        )}

        {/* ── Schritt 3: SEPA-Mandat ── */}
        {step === 3 && !submit.done && (
          <div className="space-y-6">
            <FieldErrorSummary forms={[f]} step={3} />

            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
              <p className="font-medium">{tx('SEPA-Lastschriftmandat')}</p>
              <p className="text-muted-foreground">
                {tx('Ich ermächtige den Verein, Zahlungen von meinem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die vom Verein auf mein Konto gezogenen Lastschriften einzulösen.')}
              </p>
            </div>

            <Field form={f} name="sepa_mandat" hideLabel>
              <div className="flex items-start gap-3">
                <Bound form={f} name="sepa_mandat" as="checkbox" />
                <label
                  htmlFor={f.fieldId('sepa_mandat')}
                  className="text-sm leading-snug cursor-pointer"
                >
                  {tx('Ich erteile dem Verein ein SEPA-Lastschriftmandat.')}
                  <span className="text-destructive ml-1" aria-hidden="true">*</span>
                </label>
              </div>
            </Field>

            <StepNav
              onBack={() => setStep(2)}
              onNext={() => {
                const checked = f.get('sepa_mandat') as boolean | undefined;
                if (!checked) {
                  f.validate(['sepa_mandat']);
                  return false;
                }
                return true;
              }}
              nextStepLabel={tx('Prüfen & Absenden')}
            />
          </div>
        )}

        {/* ── Schritt 4: Zusammenfassung ── */}
        {step === 4 && !submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Der Verein prüft Ihren Antrag und meldet sich in Kürze bei Ihnen. Mitgliedsnummer, Eintrittsdatum und Beitragsklasse werden vom Verein vergeben.')}
            confirmLabel={tx('Antrag absenden')}
          />
        )}

        {/* ── Erfolg ── */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            title={tx('Antrag eingereicht!')}
            whatHappensNext={tx('Der Verein prüft Ihren Beitrittsantrag und sendet Ihnen eine Bestätigung. Mitgliedsnummer und Eintrittsdatum erhalten Sie nach Freigabe durch den Verein.')}
            next={[{ label: tx('Weiteren Antrag stellen'), onClick: handleRestart }]}
            actions={{ copy: true, print: false }}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
