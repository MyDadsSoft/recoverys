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

// ----- Discord webhook form submission -----
const webhookURL = 'https://discord.com/api/webhooks/1438401042973720597/ucHdurwxn5uJuuJsh34IHwUvjj2ksiTHt5YRgFULSnlPyWYEPU-RKjAUSx6gap2Ly2hc';

document.getElementById('orderForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button');
  const originalText = submitBtn.textContent;
  
  submitBtn.textContent = 'Sending...';
  submitBtn.disabled = true;
  
  const data = {
    embeds: [{
      title: "New Order Received",
      color: 3735316,
      fields: [
        { name: "Name", value: form.name.value, inline: true },
        { name: "Email", value: form.email.value, inline: true },
        { name: "Discord", value: form.discord.value, inline: true },
        { name: "Package", value: form.package.value, inline: true },
        { name: "Currency", value: currencySelector.value, inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };
  
  try {
    const res = await fetch(webhookURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (res.ok) {
      alert('Order submitted successfully! We\'ll contact you on Discord shortly.');
      form.reset();
    } else {
      throw new Error(`Webhook returned status ${res.status}`);
    }
  } catch (err) {
    alert('Failed to submit order. Please try again.');
    console.error(err);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});
