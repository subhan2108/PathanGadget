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

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handler)
        return () => window.removeEventListener('scroll', handler)
    }, [])

    /* Close drawers on route change */
    /* Close drawers on route change */
    useEffect(() => {
        setMenuOpen(false)
        setCartOpen(false)
    }, [location])

    const formatPrice = (p) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(p)

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
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button
                                    id="nav-signin-btn"
                                    className="btn btn-outline navbar__signin"
                                >
                                    <i className="bi bi-person-circle" /> Sign In
                                </button>
                            </SignInButton>
                        </SignedOut>

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
                    {navLinks.map(link => (
                        <Link key={link.to} to={link.to} className={`mobile-menu__link ${location.pathname === link.to ? 'active' : ''}`}>
                            <i className={`bi ${link.icon}`} />
                            {link.label}
                        </Link>
                    ))}

                    <SignedIn>
                        <button className="mobile-menu__link mobile-signout" onClick={() => signOut()}>
                            <i className="bi bi-box-arrow-right" /> Sign Out
                        </button>
                    </SignedIn>
                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="mobile-menu__link" id="mobile-signin">
                                <i className="bi bi-box-arrow-in-right" /> Sign In
                            </button>
                        </SignInButton>
                        <SignInButton mode="modal">
                            <button className="mobile-menu__link" id="mobile-register">
                                <i className="bi bi-person-plus" /> Create Account
                            </button>
                        </SignInButton>
                    </SignedOut>

                    <button 
                        className="btn btn-primary btn-full mobile-menu__cta"
                        onClick={() => {
                            setMenuOpen(false);
                            checkout();
                        }}
                    >
                        Buy Now <i className="bi bi-arrow-right" />
                    </button>
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
                        <SignedOut>
                            <p className="cart-auth-notice">
                                <i className="bi bi-info-circle" />
                                <SignInButton mode="modal">
                                    <button className="auth-link">Sign in</button>
                                </SignInButton> to save your cart & checkout
                            </p>
                        </SignedOut>
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

            {/* ── Auth Modal is now handled by Clerk ── */}
        </>
    )
}
