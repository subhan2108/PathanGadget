import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import AuthModal from './AuthModal'
import './Navbar.css'

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [cartOpen, setCartOpen] = useState(false)
    const [authOpen, setAuthOpen] = useState(false)
    const [authTab, setAuthTab] = useState('login')
    const [profileOpen, setProfileOpen] = useState(false)

    const { cartItems, cartCount, cartTotal, removeFromCart, updateQty } = useCart()
    const { user, profile, signOut, isAuthenticated } = useAuth()
    const location = useLocation()
    const profileRef = useRef(null)

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handler)
        return () => window.removeEventListener('scroll', handler)
    }, [])

    /* Close drawers on route change */
    useEffect(() => {
        setMenuOpen(false)
        setCartOpen(false)
        setProfileOpen(false)
    }, [location])

    /* Close profile dropdown on outside click */
    useEffect(() => {
        if (!profileOpen) return
        const handler = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target))
                setProfileOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [profileOpen])

    const formatPrice = (p) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(p)

    const openAuth = (tab = 'login') => {
        setAuthTab(tab)
        setAuthOpen(true)
        setMenuOpen(false)
    }

    const handleSignOut = async () => {
        setProfileOpen(false)
        await signOut()
    }

    /* Get user display name */
    const displayName = profile?.full_name
        || user?.user_metadata?.full_name
        || user?.email?.split('@')[0]
        || 'Account'

    /* Get user avatar */
    const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || null

    const navLinks = [
        { to: '/', label: 'Home', icon: 'bi-house' },
        { to: '/products', label: 'Products', icon: 'bi-grid-3x3-gap' },
        { to: '/orders', label: 'My Orders', icon: 'bi-box-seam' },
    ]

    return (
        <>
            <header id="navbar" className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
                <div className="container navbar__inner">

                    {/* Logo */}
                    <Link to="/" className="navbar__logo" id="nav-logo">
                        <i className="bi bi-lightning-charge-fill logo-icon" />
                        <span className="logo-text">Pathan<span className="logo-accent">Gadgets</span></span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="navbar__links" aria-label="Main navigation">
                        {navLinks.map(link => (
                            <Link
                                key={link.to}
                                to={link.to}
                                id={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                                className={`navbar__link ${location.pathname === link.to ? 'active' : ''}`}
                            >
                                <i className={`bi ${link.icon}`} />
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Right Actions */}
                    <div className="navbar__actions">
                        {/* Cart Button */}
                        <button
                            id="cart-btn"
                            className="cart-btn"
                            onClick={() => setCartOpen(!cartOpen)}
                            aria-label={`Open cart (${cartCount} items)`}
                        >
                            <i className="bi bi-cart3" />
                            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                        </button>

                        {/* Auth: logged in → avatar dropdown, logged out → Sign In btn */}
                        {isAuthenticated ? (
                            <div className="nav-profile" ref={profileRef}>
                                <button
                                    id="nav-profile-btn"
                                    className="nav-avatar-btn"
                                    onClick={() => setProfileOpen(o => !o)}
                                    aria-label="Account menu"
                                >
                                    {avatarUrl
                                        ? <img src={avatarUrl} alt={displayName} className="nav-avatar-img" />
                                        : <span className="nav-avatar-initials">
                                            {displayName.charAt(0).toUpperCase()}
                                        </span>
                                    }
                                    <span className="nav-display-name">{displayName.split(' ')[0]}</span>
                                    <i className={`bi bi-chevron-${profileOpen ? 'up' : 'down'} nav-chevron`} />
                                </button>

                                {/* Profile Dropdown */}
                                {profileOpen && (
                                    <div className="profile-dropdown" id="profile-dropdown">
                                        <div className="profile-dropdown__head">
                                            <p className="profile-name">{displayName}</p>
                                            <p className="profile-email">{user?.email}</p>
                                        </div>
                                        <div className="profile-dropdown__links">
                                            <Link to="/orders" className="profile-link" id="dd-orders">
                                                <i className="bi bi-box-seam" /> My Orders
                                            </Link>
                                            <Link to="/admin" className="profile-link text-primary" id="dd-admin">
                                                <i className="bi bi-shield-lock" /> Admin Dashboard
                                            </Link>
                                        </div>
                                        <div className="profile-dropdown__footer">
                                            <button
                                                id="nav-signout-btn"
                                                className="signout-btn"
                                                onClick={handleSignOut}
                                            >
                                                <i className="bi bi-box-arrow-right" /> Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                id="nav-signin-btn"
                                className="btn btn-outline navbar__signin"
                                onClick={() => openAuth('login')}
                            >
                                <i className="bi bi-person-circle" /> Sign In
                            </button>
                        )}

                        <Link to="/payment" id="nav-checkout" className="btn btn-primary navbar__cta">
                            Buy Now <i className="bi bi-arrow-right" />
                        </Link>

                        <button
                            id="menu-toggle"
                            className={`hamburger ${menuOpen ? 'active' : ''}`}
                            onClick={() => setMenuOpen(!menuOpen)}
                            aria-label="Toggle menu"
                        >
                            {menuOpen
                                ? <i className="bi bi-x-lg" style={{ fontSize: '1.25rem' }} />
                                : <i className="bi bi-list" style={{ fontSize: '1.35rem' }} />
                            }
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} id="mobile-menu">
                    {navLinks.map(link => (
                        <Link key={link.to} to={link.to} className={`mobile-menu__link ${location.pathname === link.to ? 'active' : ''}`}>
                            <i className={`bi ${link.icon}`} />
                            {link.label}
                        </Link>
                    ))}

                    {isAuthenticated ? (
                        <button className="mobile-menu__link mobile-signout" onClick={handleSignOut}>
                            <i className="bi bi-box-arrow-right" /> Sign Out ({displayName.split(' ')[0]})
                        </button>
                    ) : (
                        <>
                            <button className="mobile-menu__link" onClick={() => openAuth('login')} id="mobile-signin">
                                <i className="bi bi-box-arrow-in-right" /> Sign In
                            </button>
                            <button className="mobile-menu__link" onClick={() => openAuth('register')} id="mobile-register">
                                <i className="bi bi-person-plus" /> Create Account
                            </button>
                        </>
                    )}

                    <Link to="/payment" className="btn btn-primary btn-full mobile-menu__cta">
                        Buy Now <i className="bi bi-arrow-right" />
                    </Link>
                </div>
            </header>

            {/* ── Cart Overlay ── */}
            <div className={`cart-overlay ${cartOpen ? 'open' : ''}`} onClick={() => setCartOpen(false)} />

            {/* ── Cart Drawer ── */}
            <aside id="cart-drawer" className={`cart-drawer ${cartOpen ? 'open' : ''}`} aria-label="Shopping cart">
                <div className="cart-drawer__header">
                    <h3>
                        <i className="bi bi-cart3" />
                        My Cart
                        {cartCount > 0 && <span className="cart-count-pill">{cartCount}</span>}
                    </h3>
                    <button id="close-cart" onClick={() => setCartOpen(false)} className="close-btn" aria-label="Close cart">
                        <i className="bi bi-x-lg" />
                    </button>
                </div>

                <div className="cart-drawer__body">
                    {cartItems.length === 0 ? (
                        <div className="cart-empty">
                            <i className="bi bi-cart-x cart-empty__icon" />
                            <p>Your cart is empty</p>
                            <Link to="/products" className="btn btn-primary" onClick={() => setCartOpen(false)}>
                                <i className="bi bi-shop" /> Shop Now
                            </Link>
                        </div>
                    ) : (
                        <ul className="cart-items">
                            {cartItems.map(item => (
                                <li key={item.id} className="cart-item">
                                    <img src={item.image} alt={item.name} className="cart-item__img" />
                                    <div className="cart-item__info">
                                        <p className="cart-item__name">{item.name}</p>
                                        <p className="cart-item__price">{formatPrice(item.price)}</p>
                                        <div className="cart-item__qty">
                                            <button id={`qty-dec-${item.id}`} onClick={() => updateQty(item.id, item.quantity - 1)} aria-label="Decrease">
                                                <i className="bi bi-dash" />
                                            </button>
                                            <span>{item.quantity}</span>
                                            <button id={`qty-inc-${item.id}`} onClick={() => updateQty(item.id, item.quantity + 1)} aria-label="Increase">
                                                <i className="bi bi-plus" />
                                            </button>
                                        </div>
                                    </div>
                                    <button id={`remove-${item.id}`} className="cart-item__remove" onClick={() => removeFromCart(item.id)} aria-label="Remove item">
                                        <i className="bi bi-trash3" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {cartItems.length > 0 && (
                    <div className="cart-drawer__footer">
                        <div className="cart-total">
                            <span>Total</span>
                            <strong>{formatPrice(cartTotal)}</strong>
                        </div>
                        {!isAuthenticated && (
                            <p className="cart-auth-notice">
                                <i className="bi bi-info-circle" />
                                <button className="auth-link" onClick={() => { setCartOpen(false); openAuth('login') }}>
                                    Sign in
                                </button> to save your cart & checkout
                            </p>
                        )}
                        <Link
                            to="/payment"
                            className="btn btn-primary btn-lg btn-full"
                            onClick={() => setCartOpen(false)}
                            id="proceed-checkout"
                        >
                            Proceed to Checkout <i className="bi bi-arrow-right" />
                        </Link>
                    </div>
                )}
            </aside>

            {/* ── Auth Modal ── */}
            <AuthModal
                isOpen={authOpen}
                onClose={() => setAuthOpen(false)}
                initialTab={authTab}
            />
        </>
    )
}
