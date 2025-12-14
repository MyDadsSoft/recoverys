// ----- FAQ toggle -----
document.querySelectorAll('.faq-item').forEach(item => {
  item.querySelector('h4').addEventListener('click', () => {
    item.classList.toggle('active');
  });
});

// ----- Currency conversion (GBP default) -----
const fallbackRates = {
  USD: 1,
  EUR: 0.93,
  GBP: 0.81,
  AUD: 1.52
};

const currencySymbols = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$'
};

const currencySelector = document.getElementById('currency');

// Format price nicely (e.g. £19.99)
function formatPrice(amount) {
  return amount.toFixed(2);
}

async function loadExchangeRates() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();

    if (data?.rates) {
      return {
        USD: 1,
        EUR: data.rates.EUR,
        GBP: data.rates.GBP,
        AUD: data.rates.AUD
      };
    }
  } catch (err) {
    console.warn('Live rates failed, using fallback rates');
  }

  return fallbackRates;
}

async function setupCurrencyConversion() {
  const exchangeRates = await loadExchangeRates();

  // DEFAULT TO GBP
  currencySelector.value = 'GBP';

  function updatePrices() {
    const currency = currencySelector.value;
    const symbol = currencySymbols[currency];
    const rate = exchangeRates[currency];

    document.querySelectorAll('.card').forEach(card => {
      const usdPrice = parseFloat(card.dataset.priceUsd);
      const converted = usdPrice * rate;
      card.querySelector('.price').textContent =
        `${symbol}${formatPrice(converted)}`;
    });
  }

  currencySelector.addEventListener('change', updatePrices);
  updatePrices(); // run once on load
}

setupCurrencyConversion();

// ----- Order form submission to deployed backend -----
document.getElementById('orderForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button');
  const originalText = submitBtn.textContent;

  submitBtn.textContent = 'Sending...';
  submitBtn.disabled = true;

  const payload = {
    name: form.name.value,
    email: form.email.value,
    discord: form.discord.value,
    packageSelected: form.package.value,
    currency: currencySelector.value
  };

  try {
    const res = await fetch('https://recoverys.onrender.com/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      alert(data.message || 'Order submitted successfully! We\'ll contact you on Discord shortly.');
      form.reset();
    } else {
      const errorData = await res.json();
      alert(errorData.message || 'Failed to submit order. Please try again.');
    }
  } catch (err) {
    alert('Failed to submit order. Please check your internet connection and try again.');
    console.error('Order submission error:', err);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});
document.addEventListener('DOMContentLoaded', () => {
  setupCurrencyConversion();
});
