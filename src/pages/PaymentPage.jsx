import React from 'react';
import { Navigate } from 'react-router-dom';

export default function PaymentPage() {
    // This page is deprecated. All checkouts should go to Shopify.
    // If you are seeing this, please clear your browser cache.
    return <Navigate to="/" replace />;
}
