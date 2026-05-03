// Supabase has been removed from this project.
// This file is kept as a dummy to prevent import errors in other files.

export const supabase = {
    auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
        select: () => ({
            eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
                single: () => Promise.resolve({ data: null, error: null }),
                then: (fn) => fn({ data: [], error: null })
            }),
            single: () => Promise.resolve({ data: null, error: null }),
            then: (fn) => fn({ data: [], error: null })
        }),
        insert: () => ({
            select: () => ({
                single: () => Promise.resolve({ data: null, error: null })
            }),
            then: (fn) => fn({ data: null, error: null })
        }),
        upsert: () => ({
            select: () => ({
                single: () => Promise.resolve({ data: null, error: null })
            }),
            then: (fn) => fn({ data: null, error: null })
        }),
        update: () => ({
            eq: () => ({
                select: () => ({
                    single: () => Promise.resolve({ data: null, error: null })
                })
            })
        }),
        delete: () => ({
            eq: () => Promise.resolve({ error: null })
        })
    }),
    functions: {
        invoke: () => Promise.resolve({ data: null, error: new Error("Supabase disabled") })
    }
};
