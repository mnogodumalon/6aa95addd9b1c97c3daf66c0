import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  createPublicRecord,
  prepareChallenge,
  recordRef,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
  type PublicRecordResult,
} from '@/lib/publicClient';
import { useStepForm, todayIso, optionsOf, fieldLookup, fieldNumber } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { FieldErrorSummary } from '@/components/blocks/FieldErrorSummary';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { tx } from '@/i18n';

interface AbteilungRecord {
  id: string;
  name: string;
  beitragErwachsene: number | null;
  beitragKinder: number | null;
}

export default function MitgliedWerden() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [abteilungen, setAbteilungen] = useState<AbteilungRecord[]>([]);
  const [abteilungenLoading, setAbteilungenLoading] = useState(false);

  const [selectedAbteilung, setSelectedAbteilung] = useState<AbteilungRecord | null>(null);
  const [abteilungError, setAbteilungError] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      'beitragsklasse',
      'sepa_mandat',
    ],
    required: {
      vorname: true,
      nachname: true,
      geburtsdatum: true,
      beitragsklasse: true,
      sepa_mandat: true,
      email: false,
      telefon: false,
      strasse: false,
      hausnummer: false,
      plz: false,
      ort: false,
    },
    autoComplete: true,
  });

  useEffect(() => {
    loadPublicPagesConfig('mitglied-werden')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['mitglied-werden'] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'list' && e.entity === 'abteilungen');
    if (!ep?.app_id) return;
    setAbteilungenLoading(true);
    listPublicRecords(cfg, page, { appId: ep.app_id })
      .then(result => {
        const records = Object.values(result as Record<string, PublicRecordResult>).map(r => {
          const nameLookup = fieldLookup(
            { id: r.id, fields: r.fields, createdAt: r.created_at },
            'name',
          );
          return {
            id: r.id,
            name: nameLookup?.label ?? r.id,
            beitragErwachsene: fieldNumber(
              { id: r.id, fields: r.fields, createdAt: r.created_at },
              'jahresbeitrag_erwachsene',
            ),
            beitragKinder: fieldNumber(
              { id: r.id, fields: r.fields, createdAt: r.created_at },
              'jahresbeitrag_kinder',
            ),
          };
        });
        setAbteilungen(records);
      })
      .catch(() => {
        // not fatal — show empty list
      })
      .finally(() => setAbteilungenLoading(false));
  }, [cfg, page]);

  // port is created but only used for prepareChallenge indirectly; kept for future use
  const _port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  const beitragsklasseOptions = optionsOf('mitglieder', 'beitragsklasse');

  function handleFirstInteraction() {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const formValid = f.validate();
    const abtValid = selectedAbteilung !== null;

    if (!abtValid) setAbteilungError(true);
    if (!formValid || !abtValid) return;

    if (!cfg || !page) return;

    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep?.app_id) return;

    const abtEp = page.endpoints?.find(e => e.op === 'list' && e.entity === 'abteilungen');
    if (!abtEp?.app_id) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const abteilungRef = recordRef(cfg, page, abtEp.app_id, selectedAbteilung.id);
      const payload = {
        ...f.payload(),
        abteilung: abteilungRef,
      };
      await createPublicRecord(cfg, page, payload);
      setSubmitted(true);
    } catch {
      setSubmitError(tx('Beim Absenden ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page) return <PublicShell unavailable />;

  if (submitted) {
    return (
      <PublicShell
        title={tx('Mitglied werden')}
        description={tx('Vielen Dank für dein Interesse!')}
      >
        <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center space-y-2">
          <p className="text-lg font-semibold text-green-800">
            {tx('Antrag eingegangen')}
          </p>
          <p className="text-green-700">
            {tx('Dein Antrag ist bei uns eingegangen. Wir melden uns in Kürze.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Mitglied werden')}
      description={tx('Füll das Formular aus und wir melden uns in Kürze bei dir.')}
      wide
    >
      <form
        onSubmit={handleSubmit}
        onFocus={handleFirstInteraction}
        className="space-y-8"
        noValidate
      >
        {/* Persönliche Daten */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {tx('Persönliche Daten')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field form={f} name="vorname">
              <Input {...f.field('vorname')} />
            </Field>
            <Field form={f} name="nachname">
              <Input {...f.field('nachname')} />
            </Field>
          </div>
          <Field form={f} name="geburtsdatum">
            <Bound form={f} name="geburtsdatum" />
          </Field>
          <Field
            form={f}
            name="email"
            hint={tx('Empfohlen — damit wir dich kontaktieren können')}
          >
            <Input {...f.field('email')} />
          </Field>
          <Field form={f} name="telefon">
            <Input {...f.field('telefon')} />
          </Field>
        </section>

        {/* Adresse */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {tx('Adresse')}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field form={f} name="strasse">
                <Input {...f.field('strasse')} />
              </Field>
            </div>
            <div className="col-span-1">
              <Field form={f} name="hausnummer">
                <Input {...f.field('hausnummer')} />
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field form={f} name="plz">
              <Input {...f.field('plz')} />
            </Field>
            <Field form={f} name="ort">
              <Input {...f.field('ort')} />
            </Field>
          </div>
        </section>

        {/* Abteilung wählen */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {tx('Abteilung wählen')}
          </h2>
          {abteilungenLoading && (
            <p className="text-sm text-muted-foreground">{tx('Abteilungen werden geladen …')}</p>
          )}
          {!abteilungenLoading && abteilungen.length === 0 && (
            <p className="text-sm text-muted-foreground">{tx('Keine Abteilungen gefunden.')}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {abteilungen.map(abt => {
              const isSelected = selectedAbteilung?.id === abt.id;
              return (
                <button
                  key={abt.id}
                  type="button"
                  onClick={() => {
                    setSelectedAbteilung(abt);
                    setAbteilungError(false);
                  }}
                  className={[
                    'rounded-xl border-2 p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/50',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  <p className="font-semibold text-foreground">{abt.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tx('Erwachsene')}{': '}
                    {abt.beitragErwachsene != null
                      ? `${abt.beitragErwachsene.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} / ${tx('Jahr')}`
                      : '—'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tx('Kinder')}{': '}
                    {abt.beitragKinder != null
                      ? `${abt.beitragKinder.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} / ${tx('Jahr')}`
                      : '—'}
                  </p>
                </button>
              );
            })}
          </div>
          {abteilungError && (
            <p className="text-sm text-destructive" role="alert">
              {tx('Bitte wähle eine Abteilung aus.')}
            </p>
          )}
        </section>

        {/* Beitragsklasse */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {tx('Beitragsklasse')}
          </h2>
          <Field form={f} name="beitragsklasse">
            <ChoiceGroup
              {...f.choice('beitragsklasse')}
              options={beitragsklasseOptions}
            />
          </Field>
        </section>

        {/* SEPA-Mandat */}
        <section className="space-y-2">
          <Field form={f} name="sepa_mandat" hideLabel>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                id={f.checkbox('sepa_mandat').id}
                checked={f.checkbox('sepa_mandat').checked}
                onCheckedChange={f.checkbox('sepa_mandat').onCheckedChange}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground leading-snug">
                {tx('Ich erteile ein SEPA-Lastschriftmandat')}
                {' '}
                <span className="text-destructive" aria-hidden="true">*</span>
              </span>
            </label>
          </Field>
          {f.error('sepa_mandat') && (
            <p className="text-sm text-destructive" role="alert">
              {f.error('sepa_mandat')}
            </p>
          )}
        </section>

        {/* Fehler-Zusammenfassung */}
        <FieldErrorSummary forms={[f]} />

        {submitError && (
          <p className="text-sm text-destructive" role="alert">{submitError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition-colors"
        >
          {submitting ? tx('Wird gesendet …') : tx('Jetzt Mitglied werden')}
        </button>
      </form>
    </PublicShell>
  );
}
