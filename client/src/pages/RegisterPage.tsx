import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Card, Field } from '../components/ui';

const EMPTY = { email: '', password: '', firstName: '', lastName: '', phone: '' };

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  /** Per-field messages from a 422, so each error appears under its own input. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // One handler for every input, keyed by the input's `name` attribute.
  function update(name: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      await register(form);
      navigate('/kyc');
    } catch (err) {
      if (err instanceof ApiError) {
        // A 422 carries a details[] array; surface those next to their fields.
        const fields = err.fieldErrors;
        if (Object.keys(fields).length) setFieldErrors(fields);
        else setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-lg font-bold text-white">
            OB
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Open an account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Takes a minute. You will verify your BVN or NIN next.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <Alert>{error}</Alert>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                name="firstName"
                value={form.firstName}
                onChange={update('firstName')}
                error={fieldErrors.firstName}
                required
              />
              <Field
                label="Last name"
                name="lastName"
                value={form.lastName}
                onChange={update('lastName')}
                error={fieldErrors.lastName}
                required
              />
            </div>

            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={update('email')}
              error={fieldErrors.email}
              required
            />

            <Field
              label="Phone number"
              name="phone"
              placeholder="08012345678"
              hint="11 digits, starting with 0"
              value={form.phone}
              onChange={update('phone')}
              error={fieldErrors.phone}
              required
            />

            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters"
              value={form.password}
              onChange={update('password')}
              error={fieldErrors.password}
              required
            />

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Creating your account' : 'Create account'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
