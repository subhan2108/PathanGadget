import React from 'react'
import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
    const year = new Date().getFullYear()
    return (
        <footer className="footer" id="footer">
            <div className="container">
                <div className="footer__grid">
                    {/* Brand */}
                    <div className="footer__brand">
                        <Link to="/" className="footer__logo">
                            <img src="/logo.png" alt="Smiley N Traders" className="footer__logo-img" />
                            <span>Smiley N <strong>Traders</strong></span>
                        </Link>
                        <p className="footer__tagline">
                            India's trusted B2B wholesale & retail supplier of automotive key blanks, remote shells, flip keys, transponder chips & locksmith tools.
                        </p>
                        <div className="footer__social">
                            <a href="https://wa.me/918178768308" target="_blank" rel="noopener noreferrer" id="footer-whatsapp" aria-label="WhatsApp" className="social-link" title="Chat on WhatsApp"><i className="bi bi-whatsapp" /></a>
                            <a href="#" id="footer-instagram" aria-label="Instagram" className="social-link"><i className="bi bi-instagram" /></a>
                            <a href="#" id="footer-youtube" aria-label="YouTube" className="social-link"><i className="bi bi-youtube" /></a>
                            <a href="#" id="footer-facebook" aria-label="Facebook" className="social-link"><i className="bi bi-facebook" /></a>
                        </div>
                    </div>

                    {/* Shop */}
                    <div className="footer__col">
                        <h4>Shop Automotive</h4>
                        <ul>
                            <li><Link to="/products?category=Remote%20Shell"><i className="bi bi-shield-check" /> Remote Shells</Link></li>
                            <li><Link to="/products?category=Car%20Remote"><i className="bi bi-key" /> Car Key Remotes</Link></li>
                            <li><Link to="/products?category=Smart%20Keys"><i className="bi bi-key-fill" /> Smart Keys</Link></li>
                            <li><Link to="/products?category=Flip%20Blades"><i className="bi bi-slash-square" /> Flip Key Blades</Link></li>
                            <li><Link to="/products?category=Transponder%20Chips"><i className="bi bi-cpu" /> Transponder Chips</Link></li>
                            <li><Link to="/products?category=Locksmith%20Tools"><i className="bi bi-tools" /> Locksmith Tools</Link></li>
                        </ul>
                    </div>

                    {/* Account */}
                    <div className="footer__col">
                        <h4>Account & Orders</h4>
                        <ul>
                            <li><Link to="/profile"><i className="bi bi-person-badge" /> My Profile & Orders</Link></li>
                            <li><Link to="/track"><i className="bi bi-geo-alt" /> Live Order Tracking</Link></li>
                            <li><a href="https://wa.me/918178768308?text=Hello%20Smiley%20N%20Traders,%20I%20need%20assistance" target="_blank" rel="noopener noreferrer"><i className="bi bi-whatsapp" /> WhatsApp Support</a></li>
                            <li><Link to="/refund"><i className="bi bi-arrow-return-left" /> Returns & Refunds</Link></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div className="footer__col">
                        <h4>Support</h4>
                        <ul>
                            <li><Link to="/shipping"><i className="bi bi-truck" /> Shipping Policy</Link></li>
                            <li><Link to="/terms"><i className="bi bi-file-earmark-text" /> Terms & Conditions</Link></li>
                            <li><Link to="/privacy"><i className="bi bi-shield-lock" /> Privacy Policy</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="footer__bottom">
                    <p>© {year} Smiley N Traders. All rights reserved.</p>
                    <div className="footer__payments">
                        <span className="payment-pill"><i className="bi bi-phone" /> UPI</span>
                        <span className="payment-pill"><i className="bi bi-credit-card" /> Visa</span>
                        <span className="payment-pill"><i className="bi bi-credit-card-2-back" /> Mastercard</span>
                        <span className="payment-pill"><i className="bi bi-bank" /> NetBanking</span>
                        <span className="payment-pill"><i className="bi bi-cash-coin" /> COD</span>
                    </div>
                </div>
            </div>
        </footer>
    )
}
