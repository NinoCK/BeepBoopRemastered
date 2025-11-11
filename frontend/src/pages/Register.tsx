import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register: registerUser, user, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorPulse, setErrorPulse] = useState(false);

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: string } | undefined;
    if (!state?.from || state.from === '/register') {
      return '/';
    }
    return state.from;
  }, [location.state]);

  useEffect(() => {
    if (!isLoading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, isLoading, redirectTo, navigate]);

  useEffect(() => {
    if (error) {
      setErrorPulse(true);
      const timer = setTimeout(() => setErrorPulse(false), 600);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await registerUser({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const responseMessage =
          err.response?.data?.message ||
          err.response?.data?.errors?.email?.[0] ||
          err.response?.data?.errors?.password?.[0] ||
          err.response?.data?.errors?.name?.[0];
        setError(responseMessage || 'Unable to create your account right now.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while trying to create your account.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-modal min-h-screen flex items-center justify-center bg-background px-4">
      <Card className={cn('auth-modal-card w-full max-w-md shadow-xl', errorPulse && 'auth-modal-card-alert')}>
        <CardHeader className="auth-modal-content">
          <CardTitle className="text-center text-subtext0">Create an account</CardTitle>
          <CardDescription className="text-center text-subtext1">
            Start a new conversation with your personal AI assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="auth-modal-content space-y-4">
          {error && (
            <Alert variant="destructive" className="auth-alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-subtext0">
                Name
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-subtext0">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-subtext0">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password_confirmation" className="text-subtext0">
                Confirm password
              </Label>
              <Input
                id="password_confirmation"
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="auth-modal-content justify-center">
          <p className="text-sm text-subtext1">
            Already have an account?{' '}
            <Link to="/login" className="text-primary underline-offset-2 hover:underline">
              Sign in instead
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Register;

