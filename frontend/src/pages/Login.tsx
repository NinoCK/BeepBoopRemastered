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

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorPulse, setErrorPulse] = useState(false);

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: string } | undefined;
    if (!state?.from || state.from === '/login') {
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
    setSubmitting(true);

    try {
      await login({
        email,
        password,
      });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const responseMessage =
          err.response?.data?.message ||
          err.response?.data?.errors?.email?.[0] ||
          err.response?.data?.errors?.password?.[0];
        setError(responseMessage || 'Unable to sign in with the provided credentials.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while trying to sign in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-modal min-h-screen flex items-center justify-center bg-background px-4">
      <Card className={cn('auth-modal-card w-full max-w-md shadow-xl', errorPulse && 'auth-modal-card-alert')}>
        <CardHeader className="auth-modal-content">
          <CardTitle className="text-center text-subtext0">Welcome back</CardTitle>
          <CardDescription className="text-center text-subtext1">
            Sign in to continue chatting with your personal AI assistant.
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
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="auth-modal-content justify-center">
          <p className="text-sm text-subtext1">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-primary underline-offset-2 hover:underline">
              Create one now
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;

