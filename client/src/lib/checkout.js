const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.body.appendChild(script);
  });
}

export async function collectPayment({ order, bookingId, user, call }) {
  if (order.gateway === 'mock') {
    return call('/payments/mock-pay', { method: 'POST', body: { bookingId } });
  }
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'EasyBook',
      description: 'Table booking deposit',
      prefill: { name: user.name, email: user.email },
      handler: (response) =>
        resolve({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        }),
      modal: { ondismiss: () => reject(new Error('Payment was cancelled. Your table is held until the timer ends.')) },
    });
    checkout.on('payment.failed', (response) => reject(new Error(response.error?.description ?? 'Payment failed')));
    checkout.open();
  });
}
