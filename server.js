// ----- FAQ toggle -----
document.querySelectorAll('.faq-item').forEach(item => {
  item.querySelector('h4').addEventListener('click', () => {
    item.classList.toggle('active');
  });
});

// ----- Currency conversion -----
const exchangeRates = { USD: 1, EUR: 0.93, GBP: 0.81 };
const currencySymbols = { USD: '$', EUR: '€', GBP: '£' };
const currencySelector = document.getElementById('currency');

currencySelector.addEventListener('change', () => {
  const currency = currencySelector.value;
  const symbol = currencySymbols[currency];
  document.querySelectorAll('.card').forEach(card => {
    const usdPrice = parseFloat(card.dataset.priceUsd);
    const converted = Math.round(usdPrice * exchangeRates[currency]);
    card.querySelector('.price').textContent = `${symbol}${converted}`;
  });
});

// ----- FORM SUBMISSION (SEND TO RENDER BACKEND) -----

// CHANGE THIS TO YOUR RENDER URL
const API_URL = "https://recoverys.onrender.com/api/order";

document.getElementById('orderForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;

  const submitBtn = form.querySelector('button');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = "Sending...";
  submitBtn.disabled = true;

  const orderData = {
    name: form.name.value,
    email: form.email.value,
    discord: form.discord.value,
    packageSelected: form.package.value,
    currency: currencySelector.value
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData)
    });

    const data = await res.json();

    if (data.success) {
      alert("Order submitted successfully! We'll contact you on Discord shortly.");
      form.reset();
    } else {
      alert("Order failed: " + data.message);
    }

  } catch (err) {
    alert("Failed to connect to order server.");
    console.error(err);

  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});
