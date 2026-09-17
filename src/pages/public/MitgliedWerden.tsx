import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  prepareChallenge,
  type PublicPageConfig,
  type PublicPagesConfig,
  type PublicRecordResult,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  fieldLookup,
  fieldNumber,
  useStepForm,
  useJourneySubmit,
} from '@/lib/journey';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';

const SLUG = 'mitglied-werden';

interface AbteilungCard {
  id: string;
  label: string;
  beitragErwachsene: number | null;
  beitragKinder: number | null;
}

function AbteilungCards({
  cards,
  selectedId,
  onSelect,
  invalid,
  errorId,
}: {
  cards: AbteilungCard[];
  selectedId: string | null;
  onSelect: (id: string, label: string) => void;
  invalid: boolean;
  errorId?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-required="true"
      aria-invalid={invalid || undefined}
      aria-describedby={errorId}
      className="grid gap-3 sm:grid-cols-2"
    >
      {cards.map((card) => {
        const selected = card.id === selectedId;
        return (
          <button
            key={card.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(card.id, card.label)}
            className={[
              'flex flex-col gap-2 rounded-xl border-2 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/40',
              invalid && !selected ? 'border-destructive/40' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="text-base font-semibold leading-snug">
              {card.label}
            </span>
            <span className="text-sm text-muted-foreground">
              {card.beitragErwachsene != null
                ? `${card.beitragErwachsene} €/${tx('Jahr')} (${tx('Erwachsene')})`
                : '—'}
            </span>
            <span className="text-sm text-muted-foreground">
              {card.beitragKinder != null
                ? `${card.beitragKinder} €/${tx('Jahr')} (${tx('Kinder')})`
                : '—'}
            </span>
            {selected && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                <span aria-hidden="true">✓</span> {tx('Ausgewählt')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function MitgliedWerden() {
  const STEPS = [
  { label: tx('Persönliche Daten'), key: 'personal' },
  { label: tx('Abteilung & Beitrag'), key: 'abteilung' },
  { label: tx('SEPA-Mandat'), key: 'sepa' },
  { label: tx('Überprüfen'), key: 'review' },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [abteilungen, setAbteilungen] = useState<AbteilungCard[]>([]);
  const [abteilungenLoading, setAbteilungenLoading] = useState(false);
  const [step, setStep] = useState(1);

  // ALL hooks before any early return
  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  const f = useStepForm('mitglieder', {
    fields: [
      'vorname',
      'nachname',
      'geburtsdatum',
      'email',
      'telefon',
      'strasse',
      'hausnummer',
      'plz',
      'ort',
      'abteilung',
      'sepa_mandat',
    ],
    required: {
      vorname: true,
      nachname: true,
      geburtsdatum: true,
      abteilung: true,
      email: false,
      telefon: false,
      strasse: false,
      hausnummer: false,
      plz: false,
      ort: false,
      sepa_mandat: false,
    },
    messages: {
      vorname: tx('Bitte den Vornamen eingeben.'),
      nachname: tx('Bitte den Nachnamen eingeben.'),
      geburtsdatum: tx('Bitte das Geburtsdatum wählen.'),
      abteilung: tx('Bitte eine Abteilung wählen.'),
    },
    steps: {
      vorname: 1,
      nachname: 1,
      geburtsdatum: 1,
      email: 1,
      telefon: 1,
      strasse: 1,
      hausnummer: 1,
      plz: 1,
      ort: 1,
      abteilung: 2,
      sepa_mandat: 3,
    },
    autoComplete: true,
  });

  // useJourneySubmit must be called unconditionally (Rules of Hooks)
  // port may be null while loading — pass a stable no-op port when not ready
  const activePort = port ?? { door: 'public' as const, list: async () => [], count: async () => null, get: async () => null, create: async () => ({ id: '', fields: {}, createdAt: null }), ref: () => '' };
  const submit = useJourneySubmit(
    activePort,
    [
      {
        key: 'mitglied',
        entity: 'mitglieder',
        form: f,
        primary: true,
      },
    ],
    { draftKey: SLUG },
  );

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then((c) => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(
      (e) => e.entity === 'abteilungen' && e.op === 'list',
    );
    if (!ep) return;
    setAbteilungenLoading(true);
    import('@/lib/publicClient')
      .then(({ listPublicRecords }) =>
        listPublicRecords(cfg, page, { appId: ep.app_id }),
      )
      .then((result: Record<string, PublicRecordResult>) => {
        const cards: AbteilungCard[] = Object.values(result).map((r) => {
          const jr = { id: r.id, fields: r.fields, createdAt: r.created_at ?? null };
          const nameLookup = fieldLookup(jr, 'name');
          return {
            id: r.id,
            label: nameLookup?.label ?? r.id,
            beitragErwachsene: fieldNumber(jr, 'jahresbeitrag_erwachsene'),
            beitragKinder: fieldNumber(jr, 'jahresbeitrag_kinder'),
          };
        });
        setAbteilungen(cards);
        setAbteilungenLoading(false);
      })
      .catch(() => setAbteilungenLoading(false));
  }, [cfg, page]);

  const handleFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(
      (e) => e.entity === 'mitglieder' && e.op === 'create',
    );
    if (ep?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page) return <PublicShell unavailable />;

  const abteilungId = (f.get('abteilung') as string | null) ?? null;
  const abteilungErrorId = `${f.fieldId('abteilung')}-error`;

  const restart = () => {
    submit.reset();
    f.reset();
    setStep(1);
  };

  return (
    <PublicShell
      title={page.title ?? tx('Mitglied werden')}
      description={
        page.description ??
        tx(
          'Füll das Formular aus und werde Teil unseres Vereins. Wir melden uns nach Eingang deiner Anfrage.',
        )
      }
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onFocus={handleFirstInteraction} onPointerDown={handleFirstInteraction}>
        <IntentWizardShell
          steps={STEPS}
          currentStep={step}
          onStepChange={setStep}
          back={false}
          forms={[f]}
          draftKey={SLUG}
        >
          {/* Step 1 — Persönliche Daten */}
          {step === 1 && !submit.result && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Bound form={f} name="vorname" />
                <Bound form={f} name="nachname" />
              </div>
              <Bound form={f} name="geburtsdatum" />
              <Bound form={f} name="email" />
              <Bound form={f} name="telefon" />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Bound form={f} name="strasse" />
                </div>
                <Bound form={f} name="hausnummer" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Bound form={f} name="plz" />
                <div className="sm:col-span-2">
                  <Bound form={f} name="ort" />
                </div>
              </div>
              <StepNav
                onNext={() =>
                  f.validate(['vorname', 'nachname', 'geburtsdatum'])
                }
                nextStepLabel={tx('Abteilung & Beitrag')}
              />
            </div>
          )}

          {/* Step 2 — Abteilung & Beitrag */}
          {step === 2 && !submit.result && (
            <div className="space-y-4">
              {abteilungenLoading ? (
                <p className="text-sm text-muted-foreground">
                  {tx('Abteilungen werden geladen …')}
                </p>
              ) : (
                <Field form={f} name="abteilung" label={tx('Abteilung wählen')}>
                  <AbteilungCards
                    cards={abteilungen}
                    selectedId={abteilungId}
                    onSelect={(id, label) => {
                      f.set('abteilung', id, label);
                    }}
                    invalid={!!f.error('abteilung')}
                    errorId={abteilungErrorId}
                  />
                  {f.error('abteilung') && (
                    <p
                      id={abteilungErrorId}
                      role="alert"
                      className="mt-1 text-sm text-destructive"
                    >
                      {f.error('abteilung')}
                    </p>
                  )}
                </Field>
              )}
              <StepNav
                onNext={() => f.validate(['abteilung'])}
                nextStepLabel={tx('SEPA-Mandat')}
              />
            </div>
          )}

          {/* Step 3 — SEPA-Mandat */}
          {step === 3 && !submit.result && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {tx(
                  'Mit einem SEPA-Mandat ermächtigst du den Verein, fällige Mitgliedsbeiträge per Lastschrift einzuziehen.',
                )}
              </p>
              <Bound
                form={f}
                name="sepa_mandat"
                label={tx('Ich erteile dem Verein ein SEPA-Lastschriftmandat.')}
              />
              <StepNav
                onNext={() => true}
                nextStepLabel={tx('Überprüfen')}
              />
            </div>
          )}

          {/* Step 4 — Review */}
          {step === 4 && !submit.result && (
            <SummaryStep
              forms={[f]}
              submit={submit}
              whatHappensNext={tx(
                'Deine Anfrage wird vom Verein geprüft. Wir melden uns per E-Mail bei dir.',
              )}
            />
          )}

          {/* Success */}
          {submit.result && (
            <SuccessStep
              result={submit.result}
              forms={[f]}
              title={tx('Anfrage eingegangen!')}
              whatHappensNext={tx(
                'Deine Beitrittsanfrage wurde erfolgreich übermittelt. Der Verein prüft deine Angaben und meldet sich in Kürze bei dir.',
              )}
              next={[{ label: tx('Weitere Anfrage stellen'), onClick: restart }]}
            />
          )}
        </IntentWizardShell>
      </div>
    </PublicShell>
  );
}
