const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

/**
 * Loads the Razorpay Checkout script dynamically
 */
export function loadRazorpayScript() {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.id = 'razorpay-checkout-js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

/**
 * Opens the Razorpay payment modal
 */
export async function openRazorpayCheckout({
    orderId = null, // Optional if no backend
    amount,
    name = "ElectroCart",
    description = "Premium Electronics Purchase",
    user = {},
    onSuccess,
    onDismiss
}) {
    const options = {
        key: RAZORPAY_KEY_ID,
        amount: amount * 100, // amount in paise
        currency: "INR",
        name: name,
        description: description,
        handler: function (response) {
            onSuccess(response);
        },
        prefill: {
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            email: user.email || '',
            contact: user.phone || ''
        },
        notes: {
            address: user.address || ''
        },
        theme: {
            color: "#6366f1"
        },
        modal: {
            ondismiss: function() {
                if (onDismiss) onDismiss();
            }
        }
    };

    if (orderId) {
        options.order_id = orderId;
    }

    const rzp = new window.Razorpay(options);
    rzp.open();
}
