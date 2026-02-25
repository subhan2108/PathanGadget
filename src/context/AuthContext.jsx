import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchProfile = async (user) => {
            if (!user) return;
            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()

            if (!data && !error) {
                // Profile doesn't exist, create it
                const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
                const { data: newProfile } = await supabase.from('profiles').upsert({
                    id: user.id,
                    full_name: fullName
                }).select().maybeSingle();
                setProfile(newProfile);
            } else {
                setProfile(data);
            }

            setLoading(false)
        }

        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user)
            } else {
                setLoading(false)
            }
        })

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchProfile(session.user)
            } else {
                setProfile(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const signUp = async ({ email, password, fullName }) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                },
                emailRedirectTo: window.location.origin
            }
        })

        if (data?.user && !error) {
            // Insert profile securely
            await supabase.from('profiles').upsert({
                id: data.user.id,
                full_name: fullName
            })
        }
        return { data, error }
    }

    const signIn = async ({ email, password }) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        return { data, error }
    }

    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (!error) {
            setUser(null)
            setProfile(null)
        }
    }

    const signInWithGoogle = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        })
        return { data, error }
    }

    const resetPassword = async (email) => {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        })
        return { data, error }
    }

    const value = {
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        signInWithGoogle,
        resetPassword,
        isAuthenticated: !!user,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}

export default AuthContext
