import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import OrderListingPage from './pages/OrderListingPage'
import OrderDetailsPage from './pages/OrderDetailsPage'
import PaymentPage from './pages/PaymentPage'
import OrderTrackingPage from './pages/OrderTrackingPage'
import ProductDetailPage from './pages/ProductDetailPage'
import ProductsPage from './pages/ProductsPage'
import AdminPage from './pages/AdminPage'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'

export default function App() {
    return (
        // AuthProvider wraps everything so any component can access user state
        <AuthProvider>
            <CartProvider>
                <BrowserRouter>
                    <Navbar />
                    <main>
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/products" element={<ProductsPage />} />
                            <Route path="/products/:id" element={<ProductDetailPage />} />
                            <Route path="/orders" element={<OrderListingPage />} />
                            <Route path="/orders/:id" element={<OrderDetailsPage />} />
                            <Route path="/payment" element={<PaymentPage />} />
                            <Route path="/track/:id" element={<OrderTrackingPage />} />
                            <Route path="/admin" element={<AdminPage />} />
                        </Routes>
                    </main>
                    <Footer />
                </BrowserRouter>
            </CartProvider>
        </AuthProvider>
    )
}
