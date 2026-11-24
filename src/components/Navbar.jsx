import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import {
    SignedIn,
    SignedOut,
    SignInButton,
    UserButton,
    useClerk
} from '@clerk/clerk-react'
import './Navbar.css'

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [cartOpen, setCartOpen] = useState(false)

    const { cartItems, cartCount, cartTotal, removeFromCart, updateQty, checkout } = useCart()
    const { signOut } = useAuth()
    const location = useLocation()
    const isHome = location.pathname === '/'
    const isProducts = location.pathname.startsWith('/products')
    const isTransparent = isHome && !scrolled && !menuOpen

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20)
        handler()
        window.addEventListener('scroll', handler, { passive: true })
        return () => window.removeEventListener('scroll', handler)
    }, [])

    /* Close drawers and sync scroll on route change */
    useEffect(() => {
        setMenuOpen(false)
        setCartOpen(false)
        setScrolled(window.scrollY > 20)
    }, [location])

    /* Lock body scroll when cart or mobile menu is open */
    useEffect(() => {
        if (cartOpen || menuOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [cartOpen, menuOpen])

    const formatPrice = (p) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(p)

    const navLinks = [
        { to: '/', label: 'Home', icon: 'bi-house' },
        { to: '/products', label: 'Products', icon: 'bi-grid-3x3-gap' },
        { to: '/track', label: 'Track Order', icon: 'bi-geo-alt' },
        { to: '/profile', label: 'My Orders & Profile', icon: 'bi-person-badge' },
    ]

    return (
        <>
            <header
                id="navbar"
                className={`navbar ${isHome ? 'navbar--home' : ''} ${isProducts ? 'navbar--products' : ''} ${isTransparent ? 'navbar--transparent' : ''} ${scrolled ? 'navbar--scrolled' : ''}`}
            >
                <div className="container navbar__inner">

                    {/* Logo */}
                    <Link to="/" className="navbar__logo" id="nav-logo">
                        <img src="/logo.png" alt="Smiley N Traders" className="navbar__logo-img" />
                        <span className="logo-text">Smiley N <span className="logo-accent">Traders</span></span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="navbar__links" aria-label="Main navigation">
                        {navLinks.map(link => {
                            const isActive = location.pathname === link.to || (link.to === '/profile' && location.pathname === '/orders')
                            return (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    id={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                                    className={`navbar__link ${isActive ? 'active' : ''}`}
                                >
                                    <i className={`bi ${link.icon}`} />
                                    {link.label}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Right Actions */}
                    <div className="navbar__actions">
                        {/* Cart Button (Desktop only) */}
                        <button
                            id="cart-btn"
                            className="cart-btn desktop-cart-btn"
                            onClick={() => setCartOpen(!cartOpen)}
                            aria-label={`Open cart (${cartCount} items)`}
                        >
                            <i className="bi bi-cart3" />
                            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                        </button>

                        {/* Auth: Clerk handles SignedIn and SignedOut states */}
                        <SignedIn>
                            <div className="nav-profile">
                                <UserButton
                                    afterSignOutUrl="/"
                                    appearance={{
                                        elements: {
                                            userButtonAvatarBox: 'nav-avatar-img-clerk'
                                        }
                                    }}
                                />
                            </div>
                        </SignedIn>

                        <button
                            id="nav-checkout"
                            className="btn btn-primary navbar__cta"
                            onClick={() => checkout()}
                            disabled={cartCount === 0}
                        >
                            Buy Now <i className="bi bi-arrow-right" />
                        </button>

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
                    {navLinks.map(link => {
                        const isActive = location.pathname === link.to || (link.to === '/profile' && location.pathname === '/orders')
                        return (
                            <Link key={link.to} to={link.to} className={`mobile-menu__link ${isActive ? 'active' : ''}`}>
                                <i className={`bi ${link.icon}`} />
                                {link.label}
                            </Link>
                        )
                    })}

                    <SignedIn>
                        <button className="mobile-menu__link mobile-signout" onClick={() => signOut()}>
                            <i className="bi bi-box-arrow-right" /> Sign Out
                        </button>
                    </SignedIn>
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
                                    <img
                                        src={item.image || item.image_url || '/logo.png'}
                                        alt={item.name}
                                        className="cart-item__img"
                                        style={{ objectFit: 'contain', backgroundColor: '#FFFFFF', padding: '4px' }}
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = '/placeholder-key.svg';
                                        }}
                                    />
                                    <div className="cart-item__info">
                                        <p className="cart-item__name">{item.name}</p>
                                        <p className="cart-item__price" style={{ color: '#111827', fontWeight: 700 }}>{formatPrice(item.price)}</p>
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
                            <strong style={{ color: '#111827', fontWeight: 800 }}>{formatPrice(cartTotal)}</strong>
                        </div>

                        <button
                            className="btn btn-primary btn-lg btn-full"
                            onClick={() => {
                                setCartOpen(false);
                                checkout();
                            }}
                            id="proceed-checkout"
                        >
                            Proceed to Checkout <i className="bi bi-arrow-right" />
                        </button>
                    </div>
                )}
            </aside>

            {/* ── Mobile Floating Cart Button (Pinned to Bottom-Right on mobile) ── */}
            <button
                id="mobile-floating-cart-btn"
                className="mobile-floating-cart-btn"
                onClick={() => setCartOpen(!cartOpen)}
                aria-label={`Open cart (${cartCount} items)`}
            >
                <i className="bi bi-cart3" />
                {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>

            {/* ── Auth Modal is now handled by Clerk ── */}
        </>
    )
}
