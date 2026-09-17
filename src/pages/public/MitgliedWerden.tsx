import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  prepareChallenge,
  PageUnavailableError,
  recordRef,
  type PublicPagesConfig,
  type PublicPageConfig,
  type PublicRecordResult,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import {
  useStepForm,
  useJourneySubmit,
  fieldLookup,
  fieldNumber,
  optionsOf,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';

// ─── Step definitions ────────────────────────────────────────────────────────

// ─── Inner component (runs after cfg/page loaded) ─────────────────────────────

interface AbteilungCard {
  id: string;
  nameKey: string;
  nameLabel: string;
  beitragErwachsene: number | null;
  beitragKinder: number | null;
}

function formatEuro(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

interface FormProps {
  cfg: PublicPagesConfig;
  page: PublicPageConfig;
}

function MitgliedWerdenForm({ cfg, page }: FormProps) {
  const STEPS = [
  { label: tx('Persönliche Daten'), key: 'persoenlich' },
  { label: tx('Adresse'), key: 'adresse' },
  { label: tx('Abteilung'), key: 'abteilung' },
  { label: tx('Beitrag & SEPA'), key: 'beitrag' },
  { label: tx('Prüfen'), key: 'pruefen' },
];

  const [step, setStep] = useState(1);
  const [abteilungen, setAbteilungen] = useState<AbteilungCard[]>([]);
  const [abteilungenLoading, setAbteilungenLoading] = useState(true);

  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);

  // ─── Form setup ────────────────────────────────────────────────────────────
  const f = useStepForm('mitglieder', {
    fields: [
      'vorname', 'nachname', 'geburtsdatum',
      'email', 'telefon',
      'strasse', 'hausnummer', 'plz', 'ort',
      'abteilung',
      'beitragsklasse',
      'sepa_mandat',
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
      beitragsklasse: false,
      sepa_mandat: false,
    },
    steps: {
      vorname: 1, nachname: 1, geburtsdatum: 1, email: 1, telefon: 1,
      strasse: 2, hausnummer: 2, plz: 2, ort: 2,
      abteilung: 3,
      beitragsklasse: 4, sepa_mandat: 4,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port,
    [{ key: 'mitglied', entity: 'mitglieder', form: f, primary: true }],
    { draftKey: 'mitglied-werden' },
  );

  // ─── Load Abteilungen ──────────────────────────────────────────────────────
  useEffect(() => {
    const listEp = page.endpoints?.find(e => e.entity === 'abteilungen' && e.op === 'list');
    if (!listEp?.app_id) {
      setAbteilungenLoading(false);
      return;
    }
    listPublicRecords(cfg, page, { appId: listEp.app_id })
      .then((raw: Record<string, PublicRecordResult>) => {
        const cards: AbteilungCard[] = Object.values(raw).map(r => {
          const nameLv = fieldLookup(r as never, 'name');
          return {
            id: r.id,
            nameKey: nameLv?.key ?? '',
            nameLabel: nameLv?.label ?? r.id,
            beitragErwachsene: fieldNumber(r as never, 'jahresbeitrag_erwachsene'),
            beitragKinder: fieldNumber(r as never, 'jahresbeitrag_kinder'),
          };
        });
        setAbteilungen(cards);
      })
      .catch(() => {/* silently show empty list */})
      .finally(() => setAbteilungenLoading(false));
  }, [cfg, page]);

  // Warm up challenge on first interaction
  const handleFirstInteraction = () => {
    const createEp = page.endpoints?.find(e => e.entity === 'mitglieder' && e.op === 'create');
    if (createEp?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${createEp.app_id}/records`);
    }
  };

  const selectedAbteilungId = f.get('abteilung') as string | null;
  const selectedCard = abteilungen.find(a => a.id === selectedAbteilungId) ?? null;

  const beitragsklasseOptions = optionsOf('mitglieder', 'beitragsklasse').filter(
    o => o.key === 'erwachsener' || o.key === 'kind',
  );

  const restart = () => {
    submit.reset();
    f.reset();
    setStep(1);
  };

  // ─── After success ────────────────────────────────────────────────────────
  if (submit.result) {
    return (
      <SuccessStep
        result={submit.result}
        forms={[f]}
        whatHappensNext={tx('Wir melden uns bei dir und begrüßen dich als neues Mitglied.')}
        next={[{ label: tx('Weiteres Mitglied anmelden'), onClick: restart }]}
        submit={submit}
        restartLabel={tx('Weiteres Mitglied anmelden')}
      />
    );
  }

  return (
    <div onFocus={handleFirstInteraction} onClick={handleFirstInteraction}>
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey="mitglied-werden"
      >
        {/* ── Step 1: Persönliche Daten ─────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Bound form={f} name="vorname" />
              <Bound form={f} name="nachname" />
            </div>
            <Bound form={f} name="geburtsdatum" />
            <Bound form={f} name="email" />
            <Bound form={f} name="telefon" />
            <StepNav
              onNext={() => f.validate(['vorname', 'nachname', 'geburtsdatum'])}
              nextStepLabel={tx('Adresse')}
            />
          </div>
        )}

        {/* ── Step 2: Adresse ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Bound form={f} name="strasse" />
              </div>
              <Bound form={f} name="hausnummer" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Bound form={f} name="plz" />
              <div className="col-span-2">
                <Bound form={f} name="ort" />
              </div>
            </div>
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => true}
              nextStepLabel={tx('Abteilung wählen')}
            />
          </div>
        )}

        {/* ── Step 3: Abteilung wählen ──────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {abteilungenLoading && (
              <p className="text-sm text-muted-foreground">{tx('Abteilungen werden geladen…')}</p>
            )}
            {!abteilungenLoading && abteilungen.length === 0 && (
              <p className="text-sm text-muted-foreground">{tx('Keine Abteilungen verfügbar.')}</p>
            )}
            {!abteilungenLoading && abteilungen.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {abteilungen.map(ab => {
                  const createEp = page.endpoints?.find(e => e.entity === 'mitglieder' && e.op === 'create');
                  const abtEp = page.endpoints?.find(e => e.entity === 'abteilungen' && e.op === 'list');
                  const isSelected = selectedAbteilungId === ab.id;
                  return (
                    <button
                      key={ab.id}
                      type="button"
                      onClick={() => {
                        const ref = (createEp?.app_id && abtEp?.app_id)
                          ? recordRef(cfg, page, abtEp.app_id, ab.id)
                          : ab.id;
                        f.set('abteilung', ref, ab.nameLabel);
                      }}
                      className={[
                        'rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/50',
                      ].join(' ')}
                      aria-pressed={isSelected}
                    >
                      <p className="font-semibold text-base">{ab.nameLabel}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 text-sm text-muted-foreground">
                        <span>{tx('Erwachsene')}: <strong className="text-foreground">{formatEuro(ab.beitragErwachsene)}</strong></span>
                        <span>{tx('Kinder')}: <strong className="text-foreground">{formatEuro(ab.beitragKinder)}</strong></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {f.error('abteilung') && (
              <p className="text-sm text-destructive" role="alert">{f.error('abteilung')}</p>
            )}
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => f.validate(['abteilung'])}
              nextStepLabel={tx('Beitrag & SEPA')}
            />
          </div>
        )}

        {/* ── Step 4: Beitragsklasse + SEPA ─────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-6">
            {selectedCard && (
              <div className="rounded-lg bg-muted px-4 py-3 text-sm">
                <p className="font-medium">{selectedCard.nameLabel}</p>
                <p className="text-muted-foreground mt-1">
                  {tx('Jahresbeitrag Erwachsene')}: {formatEuro(selectedCard.beitragErwachsene)} {tx('&nbsp;·&nbsp;')}
                  {tx('Kinder')}: {formatEuro(selectedCard.beitragKinder)}
                </p>
              </div>
            )}
            <Field form={f} name="beitragsklasse" label={tx('Beitragsklasse (optional)')}>
              <ChoiceGroup
                {...f.choice('beitragsklasse')}
                options={beitragsklasseOptions}
                allowClear
              />
            </Field>
            <Bound
              form={f}
              name="sepa_mandat"
              as="checkbox"
              label={tx('Ich erteile dem Verein ein SEPA-Lastschriftmandat zur Einziehung der Mitgliedsbeiträge.')}
            />
            <StepNav
              onBack={() => setStep(3)}
              onNext={() => true}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}

        {/* ── Step 5: Summary ───────────────────────────────────────────── */}
        {step === 5 && !submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Wir prüfen deine Angaben und melden uns mit allen weiteren Infos zum Vereinseintritt.')}
            confirmLabel={tx('Mitgliedschaft beantragen')}
          />
        )}
      </IntentWizardShell>
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function MitgliedWerden() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    loadPublicPagesConfig('mitglied-werden')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['mitglied-werden'] ?? null);
        if (!c?.pages['mitglied-werden']) setUnavailable(true);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  return (
    <PublicShell
      title={page.title ?? tx('Mitglied werden')}
      description={page.description ?? tx('Fülle das Formular aus — wir melden uns mit allen weiteren Infos zum Vereinseintritt.')}
    >
      <MitgliedWerdenForm cfg={cfg} page={page} />
    </PublicShell>
  );
}
