import { useState, useRef, type FormEvent, type ReactNode } from 'react';
import { Loader2, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { analytics } from '../lib/analytics';

/**
 * Signup form island.
 *
 * Client-side validation mirrors the Zod schema on the server, but the server remains the
 * source of truth — the client checks exist to give fast feedback, not to be trusted.
 * Server field errors are merged into the same error map so both render identically.
 */

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface Props {
  /** Experiment id carried through from the landing page, forwarded to the API. */
  lp: string | null;
  submitLabel: string;
  variantId: string;
  experimentId: string | null;
}

const TRADING_GOALS = [
  { value: 'prop_firm', label: 'Pass a prop firm challenge' },
  { value: 'weekend', label: 'Build an edge around a full-time job' },
  { value: 'systematizer', label: 'Validate a system with precise data' },
  { value: 'general', label: 'Something else / still exploring' },
] as const;

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'icp_focus' | 'form', string>>;

/** Mirrors CreateUserSchema in src/lib/schemas.ts. */
function validate(values: { name: string; email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};

  if (values.name.trim().length < 2) errors.name = 'Please enter your full name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = 'Please enter a valid email address';
  if (values.password.length < 6) errors.password = 'Password must be at least 6 characters';

  return errors;
}

export default function SignupForm({ lp, submitLabel, variantId, experimentId }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const hasStartedRef = useRef(false);

  const analyticsContext = {
    variant_id: variantId,
    ...(experimentId ? { experiment_id: experimentId } : {}),
  };

  /** Fires once, on first interaction — the funnel step between page view and submit. */
  const handleFirstInteraction = () => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    analytics.track('signup_form_started', analyticsContext);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'submitting') return;

    const formData = new FormData(event.currentTarget);
    const values = {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      icp_focus: String(formData.get('icp_focus') ?? 'general'),
    };

    const clientErrors = validate(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setStatus('error');
      analytics.track('signup_error_encountered', {
        ...analyticsContext,
        error_message: 'client_validation',
        error_field: Object.keys(clientErrors).join(','),
      });
      return;
    }

    setErrors({});
    setStatus('submitting');
    analytics.track('signup_form_submitted', { ...analyticsContext, icp_focus: values.icp_focus });

    try {
      const response = await fetch(`/api/users${lp ? `?lp=${encodeURIComponent(lp)}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        // Server field errors arrive keyed by field so they render on the right input.
        const serverFieldErrors = body?.fieldErrors as
          | Record<string, string[] | undefined>
          | undefined;

        const mapped: FieldErrors = {};
        if (serverFieldErrors) {
          for (const [field, messages] of Object.entries(serverFieldErrors)) {
            if (messages?.[0]) mapped[field as keyof FieldErrors] = messages[0];
          }
        }
        if (Object.keys(mapped).length === 0) {
          mapped.form = body?.error ?? 'Something went wrong. Please try again.';
        }

        setErrors(mapped);
        setStatus('error');
        analytics.track('signup_error_encountered', {
          ...analyticsContext,
          error_message: body?.error ?? `http_${response.status}`,
          error_code: response.status,
        });
        return;
      }

      setName(body?.data?.name ?? values.name);
      setStatus('success');
      // Client-side mirror of the canonical server event, for funnel completeness.
      analytics.track('signup_completed', { ...analyticsContext, icp_focus: values.icp_focus });
    } catch {
      // Network failure, offline, or a blocked request.
      setErrors({ form: 'We could not reach the server. Check your connection and try again.' });
      setStatus('error');
      analytics.track('signup_error_encountered', {
        ...analyticsContext,
        error_message: 'network_error',
      });
    }
  };

  if (status === 'success') {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-success-dark bg-surface-raised shadow-2xl shadow-black/50"
        role="status"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-success/10 via-transparent to-transparent"
          aria-hidden="true"
        />
        <CardChrome tone="success" label="Account ready" />
        <div className="relative p-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-success/15">
            <Check className="h-6 w-6 text-success" aria-hidden="true" />
          </div>
          <h2 className="mb-2 font-display text-2xl font-black text-ink">
            You&rsquo;re in{name ? `, ${name.split(' ')[0]}` : ''}.
          </h2>
          <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-ink-muted">
            Your free account is ready. Open a replay session and start testing your strategy
            against real historical markets.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-hover"
          >
            <PlayGlyph />
            Launch your first replay
          </a>
        </div>
      </div>
    );
  }

  const isSubmitting = status === 'submitting';

  return (
    <form
      onSubmit={handleSubmit}
      onFocusCapture={handleFirstInteraction}
      noValidate
      className="relative overflow-hidden rounded-2xl border border-line-strong bg-surface-raised shadow-2xl shadow-black/50"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-transparent"
        aria-hidden="true"
      />
      <CardChrome tone="brand" label="New account" />

      <div className="relative p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="font-display text-xl font-black text-ink">Create your free account</h2>
          <p className="mt-1 text-sm text-ink-subtle">Takes about thirty seconds.</p>
        </div>

        {errors.form && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-lg border border-error-dark bg-error/10 p-3.5 text-sm text-error-light"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errors.form}</span>
          </div>
        )}

        <div className="space-y-5">
          <Field
            id="name"
            label="Full name"
            type="text"
            autoComplete="name"
            placeholder="Alex Morgan"
            error={errors.name}
            disabled={isSubmitting}
          />
          <Field
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email}
            disabled={isSubmitting}
          />
          <Field
            id="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            error={errors.password}
            disabled={isSubmitting}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isSubmitting}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="rounded-md p-1.5 text-ink-subtle transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-60"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            }
          />

          <fieldset disabled={isSubmitting}>
            <legend className="mb-2 block text-sm font-semibold text-ink">Primary trading goal</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TRADING_GOALS.map((goal) => (
                <label key={goal.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="icp_focus"
                    value={goal.value}
                    defaultChecked={goal.value === 'general'}
                    className="peer sr-only"
                  />
                  <span className="flex h-full items-center rounded-lg border border-line-strong bg-surface-inset px-3.5 py-2.5 text-sm leading-snug text-ink-muted transition-colors hover:border-line-strongest peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand/60 peer-disabled:opacity-60">
                    {goal.label}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-subtle">
              Tailors the setups and analytics we surface first.
            </p>
          </fieldset>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Creating your account…' : submitLabel}
        </button>

        <p className="mt-4 text-center text-xs text-ink-subtle">
          No credit card required. Free plan available forever.
        </p>
      </div>
    </form>
  );
}

/** Window-style strip along the top of the card, echoing the hero's product frame. */
function CardChrome({ tone, label }: { tone: 'brand' | 'success'; label: string }) {
  const chip =
    tone === 'success'
      ? 'border-success/30 bg-success/10 text-success'
      : 'border-brand/25 bg-brand/10 text-brand-light';
  const dot = tone === 'success' ? 'bg-success' : 'bg-brand-light';

  return (
    <div className="relative flex items-center justify-between border-b border-line px-6 py-3">
      <span className="flex items-center gap-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-line-strongest" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strongest" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strongest" />
        </span>
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          {label}
        </span>
      </span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] ${chip}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
        Free plan
      </span>
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0 fill-current" aria-hidden="true">
      <path d="M2.5 1.2v9.6L10.5 6z" />
    </svg>
  );
}

interface FieldProps {
  id: 'name' | 'email' | 'password';
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  error?: string;
  disabled: boolean;
  /** Control rendered inside the input's right edge, e.g. a show/hide toggle. */
  trailing?: ReactNode;
}

function Field({ id, label, type, autoComplete, placeholder, error, disabled, trailing }: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-lg border bg-surface-inset px-3.5 py-3 text-sm text-ink placeholder:text-ink-subtle outline-none transition-colors focus:ring-2 disabled:opacity-60 ${
            trailing ? 'pr-11' : ''
          } ${
            error
              ? 'border-error focus:border-error focus:ring-error/30'
              : 'border-line-strong focus:border-brand focus:ring-brand/30'
          }`}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-error-light">
          {error}
        </p>
      )}
    </div>
  );
}
