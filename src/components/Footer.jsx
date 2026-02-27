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
                            <i className="bi bi-lightning-charge-fill" />
                            <span>Pathan<strong>Gadgets</strong></span>
                        </Link>
                        <p className="footer__tagline">Premium wearable tech delivered to your doorstep. Curated. Trusted. Fast.</p>
                        <div className="footer__social">
                            <a href="#" id="footer-twitter" aria-label="Twitter" className="social-link"><i className="bi bi-twitter-x" /></a>
                            <a href="#" id="footer-instagram" aria-label="Instagram" className="social-link"><i className="bi bi-instagram" /></a>
                            <a href="#" id="footer-youtube" aria-label="YouTube" className="social-link"><i className="bi bi-youtube" /></a>
                            <a href="#" id="footer-facebook" aria-label="Facebook" className="social-link"><i className="bi bi-facebook" /></a>
                        </div>
                    </div>

                    {/* Shop */}
                    <div className="footer__col">
                        <h4>Shop</h4>
                        <ul>
                            <li><Link to="/?category=watches"><i className="bi bi-smartwatch" /> Smart Watches</Link></li>
                            <li><Link to="/?category=airpods"><i className="bi bi-earbuds" /> AirPods & Earbuds</Link></li>
                            <li><Link to="/?category=headphones"><i className="bi bi-headphones" /> Headphones</Link></li>
                            <li><Link to="/"><i className="bi bi-stars" /> New Arrivals</Link></li>
                            <li><Link to="/"><i className="bi bi-trophy" /> Best Sellers</Link></li>
                        </ul>
                    </div>

                    {/* Account */}
                    <div className="footer__col">
                        <h4>Account</h4>
                        <ul>
                            <li><Link to="/orders"><i className="bi bi-box-seam" /> My Orders</Link></li>
                            <li><Link to="/track/ORD-2024-002"><i className="bi bi-geo-alt" /> Track Order</Link></li>
                            <li><Link to="/payment"><i className="bi bi-bag-check" /> Checkout</Link></li>
                            <li><a href="#"><i className="bi bi-arrow-return-left" /> Returns & Refunds</a></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div className="footer__col">
                        <h4>Support</h4>
                        <ul>
                            <li><a href="#"><i className="bi bi-question-circle" /> Help Center</a></li>
                            <li><a href="#"><i className="bi bi-chat-dots" /> Contact Us</a></li>
                            <li><a href="#"><i className="bi bi-shield-check" /> Warranty Info</a></li>
                            <li><a href="#"><i className="bi bi-file-text" /> Privacy Policy</a></li>
                        </ul>
                    </div>
                </div>

                <div className="footer__bottom">
                    <p>© {year} ElectroCart. All rights reserved.</p>
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
