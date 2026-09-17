import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  recordRef,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
  type PublicRecordResult,
} from '@/lib/publicClient';
import { useStepForm, useJourneySubmit, optionsOf, fieldLookup } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Checkbox } from '@/components/ui/checkbox';
import { tx } from '@/i18n';

// ---- Types ------------------------------------------------------------------

interface AbteilungCard {
  id: string;
  nameKey: string;
  nameLabel: string;
  beitragErwachsene: number | null;
  beitragKinder: number | null;
}

// ---- Helpers ----------------------------------------------------------------

function formatEur(n: number | null): string {
  if (n === null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

// ---- Steps ------------------------------------------------------------------

const STEP_PERSONAL = 1;
const STEP_ABTEILUNG = 2;
const STEP_BEITRAG = 3;
const STEP_SUMMARY = 4;

// ---- Page -------------------------------------------------------------------

export default function MitgliedWerden() {
  const STEPS_LABELS = [
  tx('Persönliche Daten'),
  tx('Abteilung'),
  tx('Beitrag & SEPA'),
  tx('Zusammenfassung'),
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [abteilungen, setAbteilungen] = useState<AbteilungCard[]>([]);
  const [abteilungenLoading, setAbteilungenLoading] = useState(false);

  const [step, setStep] = useState(STEP_PERSONAL);
  const [selectedAbteilungId, setSelectedAbteilungId] = useState<string | null>(null);
  const [sepaError, setSepaError] = useState(false);
  const [challengePrepared, setChallengePrepared] = useState(false);

  // ---- Load config ----------------------------------------------------------

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

  // ---- Load Abteilungen -----------------------------------------------------

  useEffect(() => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.entity === 'abteilungen' && e.op === 'list');
    if (!ep) return;
    setAbteilungenLoading(true);
    listPublicRecords(cfg, page, { appId: ep.app_id })
      .then(raw => {
        const cards: AbteilungCard[] = Object.values(raw as Record<string, PublicRecordResult>).map(r => {
          const nameVal = r.fields.name as { key: string; label: string } | null | undefined;
          return {
            id: r.id,
            nameKey: nameVal?.key ?? '',
            nameLabel: nameVal?.label ?? (nameVal?.key ?? ''),
            beitragErwachsene: (r.fields.jahresbeitrag_erwachsene as number) ?? null,
            beitragKinder: (r.fields.jahresbeitrag_kinder as number) ?? null,
          };
        });
        setAbteilungen(cards);
      })
      .finally(() => setAbteilungenLoading(false));
  }, [cfg, page]);

  // ---- Form & port ----------------------------------------------------------

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  const f = useStepForm('mitglieder', {
    fields: [
      'vorname', 'nachname', 'geburtsdatum',
      'email', 'telefon',
      'strasse', 'hausnummer', 'plz', 'ort',
      'beitragsklasse', 'sepa_mandat', 'abteilung',
    ],
    required: {
      vorname: true,
      nachname: true,
      geburtsdatum: true,
      beitragsklasse: true,
      abteilung: true,
      sepa_mandat: false, // enforced manually
    },
    steps: {
      vorname: STEP_PERSONAL,
      nachname: STEP_PERSONAL,
      geburtsdatum: STEP_PERSONAL,
      email: STEP_PERSONAL,
      telefon: STEP_PERSONAL,
      strasse: STEP_PERSONAL,
      hausnummer: STEP_PERSONAL,
      plz: STEP_PERSONAL,
      ort: STEP_PERSONAL,
      abteilung: STEP_ABTEILUNG,
      beitragsklasse: STEP_BEITRAG,
      sepa_mandat: STEP_BEITRAG,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
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

  // ---- Derived state --------------------------------------------------------

  const selectedAbteilung = abteilungen.find(a => a.id === selectedAbteilungId) ?? null;
  const beitragOptionen = optionsOf('mitglieder', 'beitragsklasse');

  // ---- Handlers -------------------------------------------------------------

  function prepareOnFirstInteraction(appId: string) {
    if (challengePrepared || !cfg || !page) return;
    setChallengePrepared(true);
    prepareChallenge(cfg, page, 'POST', `/apps/${appId}/records`);
  }

  function handleSelectAbteilung(card: AbteilungCard) {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.entity === 'mitglieder' && e.op === 'create');
    if (ep) prepareOnFirstInteraction(ep.app_id);
    setSelectedAbteilungId(card.id);
    const ep2 = page.endpoints?.find(e => e.entity === 'abteilungen' && e.op === 'list');
    if (!ep2) return;
    f.set('abteilung', card.id, card.nameLabel);
    // store the recordRef in the form value via the port
    // The port's ref() will be used during submission
  }

  function handleNextPersonal() {
    const ok = f.validate(['vorname', 'nachname', 'geburtsdatum']);
    if (ok) setStep(STEP_ABTEILUNG);
  }

  function handleNextAbteilung() {
    if (!selectedAbteilungId) {
      f.validate(['abteilung']);
      return;
    }
    setStep(STEP_BEITRAG);
  }

  function handleNextBeitrag() {
    const beitragOk = f.validate(['beitragsklasse']);
    const sepaChecked = f.get('sepa_mandat') === true;
    setSepaError(!sepaChecked);
    if (beitragOk && sepaChecked) setStep(STEP_SUMMARY);
  }

  function handleRestart() {
    f.reset();
    setSelectedAbteilungId(null);
    setSepaError(false);
    submit.reset();
    setStep(STEP_PERSONAL);
  }

  // ---- Early returns (after all hooks) --------------------------------------

  if (loading || unavailable || !cfg || !page || !port) {
    return <PublicShell loading={loading} unavailable={unavailable || (!loading && (!cfg || !page))} />;
  }

  const createEp = page.endpoints?.find(e => e.entity === 'mitglieder' && e.op === 'create');
  const abteilungEp = page.endpoints?.find(e => e.entity === 'abteilungen' && e.op === 'list');

  // ---- Render ---------------------------------------------------------------

  return (
    <PublicShell
      title={tx('Mitglied werden')}
      description={tx('Werde jetzt Teil unseres Vereins – füll das Formular aus und wir melden uns bei dir.')}
      wide
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS_LABELS.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={n} className="flex items-center gap-2">
              <div
                className={[
                  'flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold transition-colors',
                  active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {done ? '✓' : n}
              </div>
              <span className={['text-sm hidden sm:inline', active ? 'font-medium text-foreground' : 'text-muted-foreground'].join(' ')}>
                {label}
              </span>
              {i < STEPS_LABELS.length - 1 && (
                <div className={['flex-1 h-px w-4 sm:w-8', done ? 'bg-primary/40' : 'bg-border'].join(' ')} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Persönliche Daten ── */}
      {step === STEP_PERSONAL && !submit.result && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">{tx('Persönliche Daten')}</h2>

          <div className="grid grid-cols-2 gap-4">
            <Bound form={f} name="vorname" />
            <Bound form={f} name="nachname" />
          </div>

          <Bound form={f} name="geburtsdatum" />
          <Bound form={f} name="email" />
          <Bound form={f} name="telefon" />

          <div className="border-t pt-4 mt-2">
            <p className="text-sm text-muted-foreground mb-3">{tx('Adresse (optional)')}</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Bound form={f} name="strasse" />
              </div>
              <Bound form={f} name="hausnummer" />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Bound form={f} name="plz" />
              <Bound form={f} name="ort" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleNextPersonal}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              {tx('Weiter: Abteilung wählen')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Abteilung wählen ── */}
      {step === STEP_ABTEILUNG && !submit.result && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">{tx('Abteilung wählen')}</h2>
          <p className="text-sm text-muted-foreground">
            {tx('Wähle die Abteilung, der du beitreten möchtest.')}
          </p>

          {abteilungenLoading && (
            <p className="text-sm text-muted-foreground">{tx('Abteilungen werden geladen …')}</p>
          )}

          {!abteilungenLoading && abteilungen.length === 0 && (
            <p className="text-sm text-muted-foreground">{tx('Keine Abteilungen verfügbar.')}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {abteilungen.map(card => {
              const active = selectedAbteilungId === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleSelectAbteilung(card)}
                  className={[
                    'text-left rounded-xl border-2 p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  <div className="font-semibold text-base mb-2">{card.nameLabel}</div>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <div>
                      {tx('Erwachsene')}: <span className="font-medium text-foreground">{formatEur(card.beitragErwachsene)}{tx('/Jahr')}</span>
                    </div>
                    <div>
                      {tx('Kinder')}: <span className="font-medium text-foreground">{formatEur(card.beitragKinder)}{tx('/Jahr')}</span>
                    </div>
                  </div>
                  {active && (
                    <div className="mt-2 text-xs font-medium text-primary flex items-center gap-1">
                      <span>✓</span> {tx('Ausgewählt')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {f.error('abteilung') && (
            <p className="text-sm text-destructive">{f.error('abteilung')}</p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(STEP_PERSONAL)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {tx('Zurück')}
            </button>
            <button
              type="button"
              onClick={handleNextAbteilung}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={!selectedAbteilungId}
            >
              {tx('Weiter: Beitrag & SEPA')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Beitragsklasse & SEPA ── */}
      {step === STEP_BEITRAG && !submit.result && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">{tx('Beitragsklasse & SEPA-Mandat')}</h2>

          {selectedAbteilung && (
            <div className="rounded-lg bg-muted/50 border p-3 text-sm">
              <span className="font-medium">{selectedAbteilung.nameLabel}</span>
              {' — '}
              {tx('Erwachsene')}: {formatEur(selectedAbteilung.beitragErwachsene)}{tx('/Jahr,')}{' '}
              {tx('Kinder')}: {formatEur(selectedAbteilung.beitragKinder)}{tx('/Jahr')}
            </div>
          )}

          <Field form={f} name="beitragsklasse" label={tx('Beitragsklasse')}>
            <ChoiceGroup
              {...f.choice('beitragsklasse')}
              options={beitragOptionen.map(o => {
                if (!selectedAbteilung) return o;
                if (o.key === 'erwachsener') {
                  return { ...o, label: tx`${o.label} (${formatEur(selectedAbteilung.beitragErwachsene)}/Jahr)` };
                }
                if (o.key === 'kind') {
                  return { ...o, label: tx`${o.label} (${formatEur(selectedAbteilung.beitragKinder)}/Jahr)` };
                }
                return o;
              })}
            />
          </Field>

          <div className="border-t pt-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="sepa_mandat_public"
                checked={f.get('sepa_mandat') === true}
                onCheckedChange={checked => {
                  f.set('sepa_mandat', checked === true);
                  if (checked === true) setSepaError(false);
                }}
                aria-required="true"
                aria-invalid={sepaError || undefined}
                aria-describedby={sepaError ? 'sepa-error' : undefined}
                className="mt-0.5"
              />
              <label htmlFor="sepa_mandat_public" className="text-sm leading-snug cursor-pointer">
                {tx('Ich erteile dem Verein ein SEPA-Lastschriftmandat. Der Jahresbeitrag wird von meinem Konto eingezogen.')}
              </label>
            </div>
            {sepaError && (
              <p id="sepa-error" className="mt-2 text-sm text-destructive">
                {tx('Bitte stimme dem SEPA-Lastschriftmandat zu, um fortzufahren.')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(STEP_ABTEILUNG)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {tx('Zurück')}
            </button>
            <button
              type="button"
              onClick={handleNextBeitrag}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              {tx('Weiter: Zusammenfassung')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Zusammenfassung ── */}
      {step === STEP_SUMMARY && !submit.result && (
        <SummaryStep
          forms={[f]}
          submit={submit}
          title={tx('Alles korrekt?')}
          whatHappensNext={tx('Nach dem Absenden erhältst du eine Bestätigung per E-Mail. Der Verein prüft deinen Antrag und meldet sich in Kürze bei dir.')}
          items={
            selectedAbteilung
              ? [{ key: 'abteilung_name', label: tx('Abteilung'), value: selectedAbteilung.nameLabel }]
              : []
          }
        />
      )}

      {/* ── Erfolg ── */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          title={tx('Willkommen im Verein!')}
          whatHappensNext={
            <span>
              {tx('Dein Beitrittsantrag wurde erfolgreich eingereicht.')}
              {selectedAbteilung && (
                <> {tx('Wir freuen uns, dich in der Abteilung')}{' '}<strong>{selectedAbteilung.nameLabel}</strong>{' '}{tx('begrüßen zu dürfen.')}</>
              )}
              {' '}{tx('Der Verein wird sich in Kürze bei dir melden.')}
            </span>
          }
          next={[{ label: tx('Weiteren Antrag einreichen'), onClick: handleRestart }]}
          submit={submit}
          restartLabel={tx('Weiteren Antrag einreichen')}
        />
      )}
    </PublicShell>
  );
}
