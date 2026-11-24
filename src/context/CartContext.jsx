import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { fetchCart, addToCartDB, updateCartQtyDB, removeFromCartDB, clearCartDB } from '../lib/cartService'

const CartContext = createContext()
const CartActionsContext = createContext()

export function useCart() {
    return useContext(CartContext)
}

export function useCartActions() {
    return useContext(CartActionsContext)
}

export function CartProvider({ children }) {
    const { user } = useAuth()
    const [cartItems, setCartItems] = useState([])
    const [loading, setLoading] = useState(true)

    // Initial Load & Auth Sync
    useEffect(() => {
        const loadCart = async () => {
            setLoading(true)
            if (user) {
                // User logged in: Fetch from DB
                const dbCart = await fetchCart(user.id)

                // Merge local cart if exists
                const localStr = localStorage.getItem('local_cart')
                if (localStr) {
                    const localCart = JSON.parse(localStr)
                    for (const item of localCart) {
                        const exists = dbCart.find(i => i.id === item.id)
                        if (exists) {
                            await updateCartQtyDB(user.id, item.id, exists.quantity + item.quantity)
                        } else {
                            await addToCartDB(user.id, item)
                        }
                    }
                    localStorage.removeItem('local_cart') // Merged, clear local

                    // Reload db cart
                    const mergedCart = await fetchCart(user.id)
                    setCartItems(mergedCart)
                } else {
                    setCartItems(dbCart)
                }
            } else {
                // Guest: Fetch from LocalStorage
                const localStr = localStorage.getItem('local_cart')
                if (localStr) setCartItems(JSON.parse(localStr))
                else setCartItems([])
            }
            setLoading(false)
        }

        loadCart()
    }, [user])

    const addToCart = useCallback(async (product, qty = 1) => {
        const inStock = product.in_stock !== false && product.inStock !== false

        if (!inStock) {
            alert(`Sorry, "${product.name}" is currently out of stock.`)
            return { success: false, message: 'Item is out of stock' }
        }

        setCartItems(prev => {
            const itemExists = prev.find(i => i.id === product.id)
            let newCart;
            if (itemExists) {
                newCart = prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + qty } : i)
            } else {
                newCart = [...prev, { ...product, quantity: qty }]
            }
            if (!user) localStorage.setItem('local_cart', JSON.stringify(newCart))
            return newCart
        })

        if (user) {
            try {
                const currentItems = JSON.parse(localStorage.getItem('local_cart') || '[]')
                const exists = currentItems.find(i => i.id === product.id)
                if (exists) {
                    updateCartQtyDB(user.id, product.id, exists.quantity + qty).catch(() => {})
                } else {
                    addToCartDB(user.id, { ...product, quantity: qty }).catch(() => {})
                }
            } catch (_) {}
        }
        return { success: true }
    }, [user])

    const removeFromCart = useCallback(async (productId) => {
        setCartItems(prev => {
            const newCart = prev.filter(i => i.id !== productId)
            if (!user) localStorage.setItem('local_cart', JSON.stringify(newCart))
            return newCart
        })
        if (user) removeFromCartDB(user.id, productId).catch(() => {})
    }, [user])

    const updateQty = useCallback(async (productId, qty) => {
        if (qty < 1) return removeFromCart(productId)

        setCartItems(prev => {
            const newCart = prev.map(i => i.id === productId ? { ...i, quantity: qty } : i)
            if (!user) localStorage.setItem('local_cart', JSON.stringify(newCart))
            return newCart
        })

        if (user) updateCartQtyDB(user.id, productId, qty).catch(() => {})
    }, [user, removeFromCart])

    const clearCart = useCallback(async () => {
        setCartItems([])
        if (user) {
            await clearCartDB(user.id)
        } else {
            localStorage.removeItem('local_cart')
        }
    }, [user])

    const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0)
    const cartTotal = cartItems.reduce((sum, i) => Number(sum) + (Number(i.price) * i.quantity), 0)

    const checkout = useCallback(async () => {
        try {
            window.location.href = '/payment';
        } catch (err) {
            console.error('Checkout failed:', err)
            alert('Failed to start checkout. Please try again.')
        }
    }, [])

    const actions = useMemo(() => ({
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        checkout
    }), [addToCart, removeFromCart, updateQty, clearCart, checkout])

    return (
        <CartActionsContext.Provider value={actions}>
            <CartContext.Provider value={{
                cartItems,
                addToCart,
                removeFromCart,
                updateQty,
                clearCart,
                checkout,
                cartCount,
                cartTotal,
                loading
            }}>
                {children}
            </CartContext.Provider>
        </CartActionsContext.Provider>
    )
}
