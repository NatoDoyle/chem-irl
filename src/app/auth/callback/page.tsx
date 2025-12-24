'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Status = 'loading' | 'success' | 'error'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('Completing sign in…')

  useEffect(() => {
    const hash = window.location.hash

    if (!hash) {
      setStatus('error')
      setMessage('Missing authentication data. Please request a new magic link.')
      return
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const redirectTo = params.get('redirect_to') ?? '/onboarding'

    if (!accessToken || !refreshToken) {
      setStatus('error')
      setMessage('Authentication link is invalid or expired. Please request a new magic link.')
      return
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          console.error(error)
          setStatus('error')
          setMessage(error.message ?? 'Failed to finalize sign in. Try again.')
          return
        }

        setStatus('success')
        setMessage('Signed in. Redirecting…')
        router.replace(redirectTo)
      })
      .catch((error) => {
        console.error(error)
        setStatus('error')
        setMessage('Unexpected error while signing in. Please try again.')
      })
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg text-center">
        <p
          className={`text-sm ${
            status === 'success'
              ? 'text-green-600'
              : status === 'error'
              ? 'text-red-600'
              : 'text-slate-600'
          }`}
        >
          {message}
        </p>

        {status === 'error' ? (
          <button
            onClick={() => router.replace('/auth/login')}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Back to sign in
          </button>
        ) : null}
      </div>
    </div>
  )
}
