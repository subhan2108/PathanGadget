import React, { createContext, useContext } from 'react'
import { 
    useUser, 
    useAuth as useClerkAuth, 
    useClerk,
    SignInButton,
    SignUpButton,
    SignOutButton
} from '@clerk/clerk-react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const { isLoaded, isSignedIn, user } = useUser()
    const { signOut: clerkSignOut } = useClerk()
    const { getToken } = useClerkAuth()

    const value = {
        user,
        profile: user ? {
            id: user.id,
            full_name: user.fullName,
            email: user.primaryEmailAddress?.emailAddress,
            avatar_url: user.imageUrl
        } : null,
        loading: !isLoaded,
        isAuthenticated: !!isSignedIn,
        signOut: async () => {
            await clerkSignOut()
        },
        // These can be used to trigger Clerk modals
        openSignIn: () => {}, // Handled by Clerk components usually
        getToken
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
