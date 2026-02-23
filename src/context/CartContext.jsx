import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { fetchCart, addToCartDB, updateCartQtyDB, removeFromCartDB, clearCartDB } from '../lib/cartService'

const CartContext = createContext()

export function useCart() {
    return useContext(CartContext)
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

    const addToCart = async (product, qty = 1) => {
        setCartItems(prev => {
            const exists = prev.find(i => i.id === product.id)
            let newCart;
            if (exists) {
                newCart = prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + qty } : i)
            } else {
                newCart = [...prev, { ...product, quantity: qty }]
            }
            if (!user) localStorage.setItem('local_cart', JSON.stringify(newCart))
            return newCart
        })

        if (user) {
            const exists = cartItems.find(i => i.id === product.id)
            if (exists) {
                await updateCartQtyDB(user.id, product.id, exists.quantity + qty)
            } else {
                await addToCartDB(user.id, { ...product, quantity: qty })
            }
        }
    }

    const removeFromCart = async (productId) => {
        setCartItems(prev => {
            const newCart = prev.filter(i => i.id !== productId)
            if (!user) localStorage.setItem('local_cart', JSON.stringify(newCart))
            return newCart
        })
        if (user) await removeFromCartDB(user.id, productId)
    }

    const updateQty = async (productId, qty) => {
        if (qty < 1) return removeFromCart(productId)

        setCartItems(prev => {
            const newCart = prev.map(i => i.id === productId ? { ...i, quantity: qty } : i)
            if (!user) localStorage.setItem('local_cart', JSON.stringify(newCart))
            return newCart
        })

        if (user) await updateCartQtyDB(user.id, productId, qty)
    }

    const clearCart = async () => {
        setCartItems([])
        if (user) {
            await clearCartDB(user.id)
        } else {
            localStorage.removeItem('local_cart')
        }
    }

    const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0)
    const cartTotal = cartItems.reduce((sum, i) => Number(sum) + (Number(i.price) * i.quantity), 0)

    return (
        <CartContext.Provider value={{
            cartItems,
            addToCart,
            removeFromCart,
            updateQty,
            clearCart,
            cartCount,
            cartTotal,
            loading
        }}>
            {children}
        </CartContext.Provider>
    )
}
