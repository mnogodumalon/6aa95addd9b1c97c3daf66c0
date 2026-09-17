import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  recordRef,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm,
  useJourneySubmit,
  todayIso,
  fieldLookup,
  fieldNumber,
  type JourneyRecord,
} from '@/lib/journey';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { tx } from '@/i18n';

const SLUG = 'mitglied-werden';

interface AbteilungCard {
  id: string;
  nameLabel: string;
  beitragErwachsene: number | null;
  beitragKinder: number | null;
}

function toAbteilungCard(r: JourneyRecord): AbteilungCard {
  const nameLookup = fieldLookup(r, 'name');
  return {
    id: r.id,
    nameLabel: nameLookup?.label ?? r.id,
    beitragErwachsene: fieldNumber(r, 'jahresbeitrag_erwachsene'),
    beitragKinder: fieldNumber(r, 'jahresbeitrag_kinder'),
  };
}

function formatEur(val: number | null): string {
  if (val == null) return '—';
  return val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

interface AbteilungPickerProps {
  cards: AbteilungCard[];
  selected: string | null;
  onSelect: (id: string) => void;
  invalid: boolean;
  id: string;
}

function AbteilungPicker({ cards, selected, onSelect, invalid, id }: AbteilungPickerProps) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={tx('Abteilung wählen')}
      className={`grid gap-3 sm:grid-cols-2${invalid ? ' ring-1 ring-destructive rounded-lg p-1' : ''}`}
    >
      {cards.map(c => {
        const isSelected = selected === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(c.id)}
            className={[
              'text-left rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border bg-card hover:border-primary/50',
            ].join(' ')}
          >
            <div className="font-semibold text-base mb-2">{c.nameLabel}</div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <div>
                <span className="font-medium text-foreground">{formatEur(c.beitragErwachsene)}</span>
                {tx(' / Jahr (Erwachsene)')}
              </div>
              <div>
                <span className="font-medium text-foreground">{formatEur(c.beitragKinder)}</span>
                {tx(' / Jahr (Kinder)')}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

type Stage = 'form' | 'summary' | 'success';

export default function MitgliedWerden() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [abteilungen, setAbteilungen] = useState<AbteilungCard[]>([]);
  const [abteilungenLoading, setAbteilungenLoading] = useState(false);
  const [stage, setStage] = useState<Stage>('form');

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    }).catch(err => {
      if (err instanceof PageUnavailableError) {
        setLoading(false);
      }
    });
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  useEffect(() => {
    if (!port) return;
    setAbteilungenLoading(true);
    port.list('abteilungen').then(records => {
      setAbteilungen(records.map(toAbteilungCard));
      setAbteilungenLoading(false);
    }).catch(() => setAbteilungenLoading(false));
  }, [port]);

  // All hooks before any early return
  const f = useStepForm('mitglieder', {
    fields: [
      'vorname', 'nachname', 'geburtsdatum',
      'email', 'telefon',
      'strasse', 'hausnummer', 'plz', 'ort',
      'abteilung',
      'sepa_mandat',
      'eintrittsdatum',
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
      sepa_mandat: false,
      eintrittsdatum: true,
    },
    initial: { eintrittsdatum: todayIso() },
    autoComplete: true,
  });

  const fallbackPort = useMemo(() => ({
    door: 'public' as const,
    list: async () => [],
    count: async () => null,
    get: async () => null,
    create: async () => ({ id: '', fields: {}, createdAt: null }),
    ref: () => '',
  }), []);

  const submit = useJourneySubmit(
    port ?? fallbackPort,
    [{
      key: 'mitglied',
      entity: 'mitglieder',
      form: f,
      primary: true,
    }],
    { draftKey: 'mitglied-werden' },
  );

  if (loading) {
    return <PublicShell loading />;
  }
  if (!cfg || !page || !port) {
    return <PublicShell unavailable />;
  }

  const createEp = page.endpoints?.find(e => e.entity === 'mitglieder' && e.op === 'create');

  function handleAbteilungSelect(id: string) {
    if (!createEp?.app_id) return;
    const card = abteilungen.find(c => c.id === id);
    if (!card) return;
    const ref = recordRef(cfg!, page!, createEp.app_id, id);
    f.set('abteilung', ref, card.nameLabel);
  }

  // Derive selected abteilung id from form value (stored as a grant-scoped ref URL)
  const abteilungValue = f.get('abteilung') as string | null;
  const selectedAbteilungId: string | null = abteilungValue && createEp?.app_id
    ? (abteilungen.find(c => recordRef(cfg, page, createEp.app_id!, c.id) === abteilungValue)?.id ?? null)
    : null;

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = f.validate([
      'vorname', 'nachname', 'geburtsdatum', 'abteilung', 'eintrittsdatum',
    ]);
    if (valid) setStage('summary');
  }

  function handleRestart() {
    f.reset({ eintrittsdatum: todayIso() });
    submit.reset();
    setStage('form');
  }

  const selectedCard = abteilungen.find(c => c.id === selectedAbteilungId);

  return (
    <PublicShell
      title={page.title}
      description={tx('Füll das Formular aus – wir melden uns und bestätigen deine Mitgliedschaft.')}
      wide
    >
      {stage === 'form' && (
        <form onSubmit={handleFormSubmit} className="space-y-8" noValidate>
          {/* Section 1: Persönliche Daten */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground border-b pb-2">
              {tx('Persönliche Daten')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Bound form={f} name="vorname" />
              <Bound form={f} name="nachname" />
            </div>
            <Bound form={f} name="geburtsdatum" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Bound form={f} name="email" />
              <Bound form={f} name="telefon" />
            </div>
          </section>

          {/* Section 2: Adresse */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground border-b pb-2">
              {tx('Adresse')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Bound form={f} name="strasse" />
              </div>
              <Bound form={f} name="hausnummer" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Bound form={f} name="plz" />
              <Bound form={f} name="ort" />
            </div>
          </section>

          {/* Section 3: Abteilung */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground border-b pb-2">
              {tx('Abteilung wählen')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tx('Wähle die Abteilung, der du beitreten möchtest. Die Jahresbeiträge sind orientierend – der Verein bestätigt den genauen Betrag nach Prüfung deines Antrags.')}
            </p>
            <Field form={f} name="abteilung" label={tx('Abteilung')}>
              {abteilungenLoading ? (
                <p className="text-sm text-muted-foreground py-2">{tx('Abteilungen werden geladen…')}</p>
              ) : (
                <AbteilungPicker
                  cards={abteilungen}
                  selected={selectedAbteilungId}
                  onSelect={handleAbteilungSelect}
                  invalid={!!f.error('abteilung')}
                  id={f.fieldId('abteilung')}
                />
              )}
            </Field>
            {f.error('abteilung') && (
              <p className="text-sm text-destructive" role="alert">{f.error('abteilung')}</p>
            )}
          </section>

          {/* Section 4: SEPA-Mandat */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground border-b pb-2">
              {tx('Zahlungsweise')}
            </h2>
            <Bound
              form={f}
              name="sepa_mandat"
              label={tx('SEPA-Mandat erteilen')}
              hint={tx('Du ermächtigst den Verein, Beiträge per Lastschrift einzuziehen.')}
            />
          </section>

          {/* Eintrittsdatum — placeholder, not shown to visitor visually, sent as today */}
          <section className="space-y-4 rounded-xl border border-dashed border-border p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {tx('Das Eintrittsdatum ist zunächst auf heute gesetzt und wird vom Verein nach Prüfung deines Antrags bestätigt.')}
            </p>
            <Bound form={f} name="eintrittsdatum" hint={tx('Wird vom Verein nach Prüfung bestätigt')} />
          </section>

          <div>
            <button
              type="submit"
              className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              {tx('Jetzt Mitglied werden')}
            </button>
          </div>
        </form>
      )}

      {stage === 'summary' && !submit.done && (
        <div className="space-y-4">
          {selectedCard && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm space-y-1">
              <div className="font-semibold">
                {tx('Gewählte Abteilung:')} {selectedCard.nameLabel}
              </div>
              <div className="text-muted-foreground">
                {tx('Erwachsene:')} <span className="font-medium text-foreground">{formatEur(selectedCard.beitragErwachsene)}</span>
                {' · '}
                {tx('Kinder:')} <span className="font-medium text-foreground">{formatEur(selectedCard.beitragKinder)}</span>
                {tx(' / Jahr')}
              </div>
            </div>
          )}
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Wir melden uns nach Prüfung deines Antrags per E-Mail. Mitgliedsnummer und Eintrittsdatum bestätigt der Verein – das heute eingetragene Datum ist nur ein Platzhalter.')}
            confirmLabel={tx('Antrag absenden')}
          />
        </div>
      )}

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          title={tx('Antrag eingegangen!')}
          whatHappensNext={tx('Vielen Dank! Wir haben deinen Mitgliedschaftsantrag erhalten und melden uns in Kürze per E-Mail. Mitgliedsnummer und das gültige Eintrittsdatum teilt dir der Verein mit.')}
          next={[{ label: tx('Weiteren Antrag stellen'), onClick: handleRestart }]}
          actions={{ copy: true, print: false }}
        />
      )}
    </PublicShell>
  );
}
