// Extended product details for the ProductDetailPage
// Each entry enriches the base products from mockData.js

export const productDetails = {
    1: {
        brand: 'ProWatch',
        brandLogo: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=60&h=60&fit=crop',
        sku: 'PW-ULTRA-X1-BLK',
        longDescription: `The ProWatch Ultra X1 is engineered for the modern professional who demands both style and performance. Featuring a 1.9" AMOLED display with 60Hz refresh rate, it delivers crisp visuals day and night. The titanium-alloy frame weighs just 45g yet feels impossibly durable. Built with advanced health sensors including 24/7 heart rate, SpO2, stress monitoring, and AI-powered sleep coaching, it truly understands your body.`,
        features: [
            { icon: 'bi-heart-pulse-fill', label: 'Health Monitoring', desc: '24/7 Heart Rate, SpO2, Stress & Sleep tracking' },
            { icon: 'bi-battery-full', label: '7-Day Battery', desc: 'Up to 7 days typical use, 14 days power-saving' },
            { icon: 'bi-geo-alt-fill', label: 'Built-in GPS', desc: 'Multi-system GPS + GLONASS + Beidou' },
            { icon: 'bi-water', label: '5ATM Water Resistant', desc: 'Swim-proof, wear it in rain or pool' },
            { icon: 'bi-phone', label: 'NFC Payments', desc: 'Pay on the go with tap-to-pay' },
            { icon: 'bi-bluetooth', label: 'Bluetooth 5.3', desc: 'Fast pairing, stable connection' },
        ],
        images: [
            'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&h=700&fit=crop',
            'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=700&h=700&fit=crop',
            'https://images.unsplash.com/photo-1617043786394-f977fa12eddf?w=700&h=700&fit=crop',
            'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=700&h=700&fit=crop',
        ],
        colorVariants: [
            { name: 'Midnight Black', hex: '#1a1a2e', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&h=700&fit=crop' },
            { name: 'Silver Storm', hex: '#c0c0c0', image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=700&h=700&fit=crop' },
            { name: 'Ocean Blue', hex: '#0077FF', image: 'https://images.unsplash.com/photo-1617043786394-f977fa12eddf?w=700&h=700&fit=crop' },
            { name: 'Rose Gold', hex: '#b76e79', image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=700&h=700&fit=crop' },
        ],
        highlights: ['Free delivery in 2 days', '1-Year Brand Warranty', '7-Day Easy Returns', '100% Genuine Product'],
        similarIds: [4, 7, 2, 3],
        reviews: [
            { id: 1, user: 'Ravi K.', avatar: 'RK', rating: 5, date: 'Feb 12, 2024', title: 'Absolutely stunning watch!', body: "I've been using this for 3 months and the battery life is insane. AMOLED display is gorgeous even in direct sunlight. The health tracking is very accurate compared to my medical devices.", verified: true, helpful: 34 },
            { id: 2, user: 'Meena S.', avatar: 'MS', rating: 5, date: 'Jan 28, 2024', title: 'Best smartwatch under 25k', body: 'Switched from a premium brand and honestly this is better. NFC payments work flawlessly in India. The GPS accuracy is spot on for my morning runs.', verified: true, helpful: 21 },
            { id: 3, user: 'Aditya P.', avatar: 'AP', rating: 4, date: 'Jan 15, 2024', title: 'Great product, minor software niggles', body: 'Hardware is 10/10. App could use some polish but the watch itself is phenomenal. Sleep tracking is the most accurate I have seen. Highly recommend!', verified: true, helpful: 15 },
            { id: 4, user: 'Priya N.', avatar: 'PN', rating: 5, date: 'Dec 20, 2023', title: 'Gift for husband – he loves it!', body: 'Bought it as a Christmas gift. The unboxing experience is premium. My husband wears it 24/7. Highly satisfied with the purchase.', verified: false, helpful: 8 },
        ],
        ratingBreakdown: { 5: 68, 4: 18, 3: 8, 2: 4, 1: 2 },
    },
    2: {
        brand: 'AirBuds',
        sku: 'AB-PRO-MAX-WHT',
        longDescription: `AirBuds Pro Max redefines the true wireless experience with Adaptive Active Noise Cancellation that automatically adjusts to your environment. Whether you're on a noisy metro or in a quiet café, the Pro Max delivers crystal-clear audio with deep, punchy bass and sparkly highs. The ergonomic silicon tips ensure a secure, comfortable fit for all-day wear.`,
        features: [
            { icon: 'bi-soundwave', label: 'Adaptive ANC', desc: 'AI-powered noise cancellation adjusts in real-time' },
            { icon: 'bi-battery-charging', label: '30-Hour Total', desc: '6h earbud + 24h charging case battery' },
            { icon: 'bi-music-note-beamed', label: 'Spatial Audio', desc: 'Immersive 3D audio with head tracking' },
            { icon: 'bi-water', label: 'IPX5 Rating', desc: 'Sweat and splash resistant for workouts' },
            { icon: 'bi-telephone-fill', label: 'AI Call Clarity', desc: '6 microphones with wind noise suppression' },
            { icon: 'bi-lightning-charge', label: 'Fast Charge', desc: '10 min charge = 1.5 hours playback' },
        ],
        images: [
            'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=700&h=700&fit=crop',
            'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=700&h=700&fit=crop',
            'https://images.unsplash.com/photo-1572645315416-6c5bc4fcabba?w=700&h=700&fit=crop',
            'https://images.unsplash.com/photo-1631281891830-77e92d0e8a1f?w=700&h=700&fit=crop',
        ],
        colorVariants: [
            { name: 'Pearl White', hex: '#f5f5f5', image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=700&h=700&fit=crop' },
            { name: 'Midnight Black', hex: '#1a1a2e', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=700&h=700&fit=crop' },
            { name: 'Sky Blue', hex: '#2EA8FF', image: 'https://images.unsplash.com/photo-1572645315416-6c5bc4fcabba?w=700&h=700&fit=crop' },
        ],
        highlights: ['Free delivery in 2 days', '1-Year Brand Warranty', '7-Day Easy Returns', '100% Genuine Product'],
        similarIds: [5, 8, 3, 6],
        reviews: [
            { id: 1, user: 'Kabir T.', avatar: 'KT', rating: 5, date: 'Feb 14, 2024', title: 'ANC is next level!', body: 'I work in an open-plan office and these earbuds changed my work life. ANC blocks out everything. Bass is deep without being muddy. Totally worth it.', verified: true, helpful: 67 },
            { id: 2, user: 'Sneha R.', avatar: 'SR', rating: 5, date: 'Feb 01, 2024', title: 'Perfect gym companion', body: 'IPX5 rating holds up really well, been using them through intense workouts. Spatial audio when watching movies on my phone is incredible.', verified: true, helpful: 43 },
            { id: 3, user: 'Arjun M.', avatar: 'AM', rating: 4, date: 'Jan 20, 2024', title: 'Great but case could be smaller', body: 'Sound quality is exceptional for this price. Only wish the case was more pocketable. Everything else is top class.', verified: true, helpful: 29 },
        ],
        ratingBreakdown: { 5: 72, 4: 15, 3: 7, 2: 4, 1: 2 },
    },
};

// Default fallback for products without extended details
export function getProductDetail(id) {
    return productDetails[id] || productDetails[1];
}
