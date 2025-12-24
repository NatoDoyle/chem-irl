'use client'

import { FormEvent, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const defaultEmail = searchParams.get('email') ?? ''
  const redirectTo = searchParams.get('redirect_to') ?? undefined

  const [email, setEmail] = useState(defaultEmail)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string>('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('Sending magic link…')

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, redirectTo }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? 'Unable to send magic link')
      }

      setStatus('success')
      setMessage('Check your email for the magic link. It expires in 1 hour.')
    } catch (error: unknown) {
      console.error(error)
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Something went wrong, please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in to Chem IRL</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email and we&apos;ll send you a secure magic link. No passwords, ever.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <button
            type="submit"
            disabled={status === 'loading' || !email}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {status === 'loading' ? 'Sending…' : 'Send magic link'}
          </button>
        </form>

        {status !== 'idle' ? (
          <p
            className={`mt-4 text-sm ${
              status === 'success'
                ? 'text-green-600'
                : status === 'error'
                ? 'text-red-600'
                : 'text-slate-600'
            }`}
          >
            {message}
          </p>
        ) : null}

        <p className="mt-8 text-xs text-slate-500">
          By continuing you agree to our Community Guidelines and Safety Standards. No spam, no endless chats—just
          real dates.
        </p>
      </div>
    </div>
  )
}
