import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import './AuthModal.css'

/* ── Tiny Input Field ── */
function Field({ id, label, type = 'text', value, onChange, placeholder, icon, error, autoComplete }) {
    const [show, setShow] = useState(false)
    const isPassword = type === 'password'
    return (
        <div className={`auth-field ${error ? 'auth-field--error' : ''}`}>
            <label htmlFor={id}>{label}</label>
            <div className="auth-field__wrap">
                <i className={`bi ${icon} auth-field__icon`} />
                <input
                    id={id}
                    type={isPassword ? (show ? 'text' : 'password') : type}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    required
                />
                {isPassword && (
                    <button
                        type="button"
                        className="auth-field__eye"
                        onClick={() => setShow(s => !s)}
                        tabIndex={-1}
                    >
                        <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`} />
                    </button>
                )}
            </div>
            {error && <span className="auth-field__err"><i className="bi bi-exclamation-circle" /> {error}</span>}
        </div>
    )
}

/* ── Main Modal ── */
export default function AuthModal({ isOpen, onClose, initialTab = 'login' }) {
    const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth()
    const [tab, setTab] = useState(initialTab)   // 'login' | 'register' | 'forgot'
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')
    const [globalError, setGlobalError] = useState('')
    const modalRef = useRef(null)

    // Form state
    const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
    const [errors, setErrors] = useState({})

    // Reset form when tab changes or modal opens
    useEffect(() => {
        setForm({ fullName: '', email: '', password: '', confirmPassword: '' })
        setErrors({})
        setGlobalError('')
        setSuccessMsg('')
        setLoading(false)
    }, [tab, isOpen])

    useEffect(() => {
        setTab(initialTab)
    }, [initialTab])

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return
        const handler = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isOpen, onClose])

    // Prevent body scroll when modal open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [isOpen])

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

    /* ── Validation ── */
    const validate = () => {
        const errs = {}
        if (tab === 'register' && !form.fullName.trim()) errs.fullName = 'Name is required'
        if (!form.email.trim()) errs.email = 'Email is required'
        else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email'
        if (tab !== 'forgot') {
            if (!form.password) errs.password = 'Password is required'
            else if (form.password.length < 6) errs.password = 'Minimum 6 characters'
        }
        if (tab === 'register' && form.password !== form.confirmPassword)
            errs.confirmPassword = 'Passwords do not match'
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    /* ── Submit ── */
    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validate()) return
        setLoading(true)
        setGlobalError('')
        setSuccessMsg('')

        try {
            if (tab === 'login') {
                const { error } = await signIn({ email: form.email, password: form.password })
                if (error) { setGlobalError(error.message); return }
                onClose()

            } else if (tab === 'register') {
                const { error } = await signUp({
                    email: form.email,
                    password: form.password,
                    fullName: form.fullName,
                })
                if (error) { setGlobalError(error.message); return }
                setSuccessMsg('🎉 Account created! Check your email to confirm, then log in.')
                setTimeout(() => setTab('login'), 3000)

            } else if (tab === 'forgot') {
                const { error } = await resetPassword(form.email)
                if (error) { setGlobalError(error.message); return }
                setSuccessMsg('📧 Password reset link sent! Check your inbox.')
            }
        } finally {
            setLoading(false)
        }
    }

    /* ── Google Sign-In ── */
    const handleGoogle = async () => {
        setGoogleLoading(true)
        setGlobalError('')
        const { error } = await signInWithGoogle()
        if (error) { setGlobalError(error.message); setGoogleLoading(false) }
        // On success, Supabase redirects — no need to close modal
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="auth-backdrop"
                onClick={onClose}
                id="auth-backdrop"
            />

            {/* Modal */}
            <div
                className="auth-modal"
                id="auth-modal"
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="auth-modal-title"
            >
                {/* Close */}
                <button className="auth-modal__close" onClick={onClose} id="auth-close-btn" aria-label="Close">
                    <i className="bi bi-x-lg" />
                </button>

                {/* Header */}
                <div className="auth-modal__header">
                    <div className="auth-logo">
                        <i className="bi bi-lightning-charge-fill" />
                    </div>
                    <h2 id="auth-modal-title">
                        {tab === 'login' && 'Welcome Back'}
                        {tab === 'register' && 'Create Account'}
                        {tab === 'forgot' && 'Reset Password'}
                    </h2>
                    <p>
                        {tab === 'login' && 'Sign in to your ElectroCart account'}
                        {tab === 'register' && 'Join 50,000+ happy customers'}
                        {tab === 'forgot' && "We'll send you a reset link"}
                    </p>
                </div>

                {/* Tab switcher (only for login/register) */}
                {tab !== 'forgot' && (
                    <div className="auth-tabs">
                        <button
                            id="auth-tab-login"
                            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
                            onClick={() => setTab('login')}
                        >
                            <i className="bi bi-box-arrow-in-right" /> Sign In
                        </button>
                        <button
                            id="auth-tab-register"
                            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
                            onClick={() => setTab('register')}
                        >
                            <i className="bi bi-person-plus" /> Register
                        </button>
                    </div>
                )}

                {/* Google OAuth */}
                {tab !== 'forgot' && (
                    <div className="auth-oauth">
                        <button
                            id="auth-google-btn"
                            className="google-btn"
                            onClick={handleGoogle}
                            disabled={googleLoading || loading}
                        >
                            {googleLoading
                                ? <><i className="bi bi-arrow-repeat auth-spin" /> Redirecting…</>
                                : <>
                                    <svg width="18" height="18" viewBox="0 0 48 48" className="google-icon">
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                    </svg>
                                    Continue with Google
                                </>
                            }
                        </button>

                        <div className="auth-divider">
                            <span>or continue with email</span>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form className="auth-form" onSubmit={handleSubmit} noValidate>

                    {/* Global Error */}
                    {globalError && (
                        <div className="auth-alert auth-alert--error">
                            <i className="bi bi-exclamation-triangle-fill" />
                            {globalError}
                        </div>
                    )}

                    {/* Success Message */}
                    {successMsg && (
                        <div className="auth-alert auth-alert--success">
                            <i className="bi bi-check-circle-fill" />
                            {successMsg}
                        </div>
                    )}

                    {/* Full Name (register only) */}
                    {tab === 'register' && (
                        <Field
                            id="auth-fullname"
                            label="Full Name"
                            type="text"
                            value={form.fullName}
                            onChange={set('fullName')}
                            placeholder="Rahul Sharma"
                            icon="bi-person"
                            error={errors.fullName}
                            autoComplete="name"
                        />
                    )}

                    {/* Email */}
                    <Field
                        id="auth-email"
                        label="Email Address"
                        type="email"
                        value={form.email}
                        onChange={set('email')}
                        placeholder="you@example.com"
                        icon="bi-envelope"
                        error={errors.email}
                        autoComplete="email"
                    />

                    {/* Password */}
                    {tab !== 'forgot' && (
                        <Field
                            id="auth-password"
                            label="Password"
                            type="password"
                            value={form.password}
                            onChange={set('password')}
                            placeholder={tab === 'register' ? 'Min 6 characters' : '••••••••'}
                            icon="bi-lock"
                            error={errors.password}
                            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                        />
                    )}

                    {/* Confirm Password (register only) */}
                    {tab === 'register' && (
                        <Field
                            id="auth-confirm-password"
                            label="Confirm Password"
                            type="password"
                            value={form.confirmPassword}
                            onChange={set('confirmPassword')}
                            placeholder="Re-enter password"
                            icon="bi-lock-fill"
                            error={errors.confirmPassword}
                            autoComplete="new-password"
                        />
                    )}

                    {/* Forgot Password link */}
                    {tab === 'login' && (
                        <button
                            type="button"
                            id="auth-forgot-link"
                            className="auth-forgot-link"
                            onClick={() => setTab('forgot')}
                        >
                            Forgot password?
                        </button>
                    )}

                    {/* Submit Button */}
                    <button
                        id="auth-submit-btn"
                        type="submit"
                        className="btn btn-primary btn-full auth-submit"
                        disabled={loading || !!successMsg}
                    >
                        {loading
                            ? <><i className="bi bi-arrow-repeat auth-spin" /> Please wait…</>
                            : tab === 'login'
                                ? <><i className="bi bi-box-arrow-in-right" /> Sign In</>
                                : tab === 'register'
                                    ? <><i className="bi bi-person-check" /> Create Account</>
                                    : <><i className="bi bi-envelope-check" /> Send Reset Link</>
                        }
                    </button>

                    {/* Back to login from forgot */}
                    {tab === 'forgot' && (
                        <button
                            type="button"
                            className="auth-back-btn"
                            onClick={() => setTab('login')}
                            id="auth-back-to-login"
                        >
                            <i className="bi bi-arrow-left" /> Back to Sign In
                        </button>
                    )}
                </form>

                {/* Footer toggle */}
                {tab !== 'forgot' && (
                    <p className="auth-footer">
                        {tab === 'login'
                            ? <>Don't have an account? <button id="auth-goto-register" className="auth-link" onClick={() => setTab('register')}>Create one</button></>
                            : <>Already have an account? <button id="auth-goto-login" className="auth-link" onClick={() => setTab('login')}>Sign in</button></>
                        }
                    </p>
                )}

                {/* Trust badges */}
                <div className="auth-trust">
                    <span><i className="bi bi-shield-lock-fill" /> Secured by Supabase</span>
                    <span><i className="bi bi-lock-fill" /> 256-bit SSL</span>
                </div>
            </div>
        </>
    )
}
