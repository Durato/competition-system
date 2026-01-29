// Payment Modal Handler
// Mercado Pago Integration with Checkout Bricks

let mp = null;
let cardPaymentBrickController = null;
let currentPaymentData = null;
let currentPixPaymentId = null; // Track current PIX payment to avoid recreating

// Initialize Mercado Pago SDK
async function initMercadoPago() {
  try {
    // Fetch public key from backend
    const res = await fetch(`${API}/payments/config`);
    const config = await res.json();

    if (!config.mercadoPagoPublicKey) {
      throw new Error('Public key not configured');
    }

    mp = new MercadoPago(config.mercadoPagoPublicKey, {
      locale: 'pt-BR'
    });
    console.log('[Payment] Mercado Pago SDK initialized');
  } catch (err) {
    console.error('[Payment] Error initializing Mercado Pago:', err);
    showToast('Erro ao inicializar sistema de pagamento', 'error');
  }
}

// Open payment modal
function openPaymentModal(paymentData) {
  currentPaymentData = paymentData;
  currentPixPaymentId = null; // Reset PIX payment

  // Update total display
  const totalDisplay = document.getElementById('paymentTotalDisplay');
  totalDisplay.textContent = `Total: R$ ${paymentData.total.toFixed(2).replace('.', ',')}`;

  // Show modal
  document.getElementById('paymentModal').style.display = 'flex';

  // Initialize with PIX tab
  switchPaymentTab('pix');
}

// Close payment modal
function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';

  // Stop polling
  if (paymentPollingInterval) {
    clearInterval(paymentPollingInterval);
    paymentPollingInterval = null;
  }

  // Cleanup card brick
  if (cardPaymentBrickController) {
    try {
      cardPaymentBrickController.unmount();
    } catch (e) {
      console.log('[Payment] Error unmounting brick on close:', e);
    }
    cardPaymentBrickController = null;
  }

  // Reset state
  currentPaymentData = null;
  currentPixPaymentId = null;

  // Reset PIX content
  document.getElementById('pixResult').style.display = 'none';
  document.getElementById('pixLoading').style.display = 'block';
}

// Switch between payment tabs
function switchPaymentTab(tab) {
  // Update tab buttons
  const tabs = document.querySelectorAll('.payment-tab');
  tabs.forEach(t => t.classList.remove('active'));
  event?.target?.classList.add('active') || document.querySelector(`.payment-tab:${tab === 'pix' ? 'first' : 'last'}-child`).classList.add('active');

  // Update content
  const contents = document.querySelectorAll('.payment-content');
  contents.forEach(c => c.classList.remove('active'));

  if (tab === 'pix') {
    document.getElementById('pixContent').classList.add('active');
    // SEMPRE gera um novo PIX quando a aba é aberta
    // Isso garante que cada novo pagamento tenha seu próprio QR code
    processPIXPayment();
  } else if (tab === 'card') {
    // Stop PIX polling when switching to card
    if (paymentPollingInterval) {
      clearInterval(paymentPollingInterval);
      paymentPollingInterval = null;
    }
    document.getElementById('cardContent').classList.add('active');
    loadCardPaymentBrick();
  }
}

// Process PIX payment
async function processPIXPayment() {
  if (!currentPaymentData) return;

  const pixLoading = document.getElementById('pixLoading');
  const pixResult = document.getElementById('pixResult');

  pixLoading.style.display = 'block';
  pixResult.style.display = 'none';

  try {
    const res = await authFetch(`${API}/payments/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: currentPaymentData.teamId,
        memberIds: currentPaymentData.memberIds,
        robotIds: currentPaymentData.robotIds,
        payment_method_id: 'pix',
        payer: {
          email: currentPaymentData.email,
          name: currentPaymentData.userName
        }
      })
    });

    const data = await res.json();

    if (data.success && data.payment.pix) {
      // Save payment ID to avoid recreating
      currentPixPaymentId = data.payment.id;

      // Display PIX QR Code and code
      document.getElementById('pixQRCode').src = `data:image/png;base64,${data.payment.pix.qr_code_base64}`;
      document.getElementById('pixCode').value = data.payment.pix.qr_code;

      pixLoading.style.display = 'none';
      pixResult.style.display = 'block';

      // Start polling for payment confirmation
      startPaymentPolling(data.payment.id);
    } else {
      throw new Error(data.error || 'Erro ao gerar PIX');
    }
  } catch (err) {
    console.error('[Payment] Error processing PIX:', err);
    showToast('Erro ao gerar código PIX: ' + err.message, 'error');
    closePaymentModal();
  }
}

// Copy PIX code to clipboard
function copyPixCode() {
  const pixCode = document.getElementById('pixCode');
  pixCode.select();
  pixCode.setSelectionRange(0, 99999); // For mobile devices

  navigator.clipboard.writeText(pixCode.value).then(() => {
    showToast('Código PIX copiado!', 'success');
  }).catch(() => {
    // Fallback for older browsers
    document.execCommand('copy');
    showToast('Código PIX copiado!', 'success');
  });
}

// Load Card Payment Brick
async function loadCardPaymentBrick() {
  if (!mp) {
    await initMercadoPago();
  }

  if (!mp) {
    showToast('Erro ao inicializar Mercado Pago. Tente novamente.', 'error');
    return;
  }

  if (!currentPaymentData) return;

  // Unmount previous instance if exists
  if (cardPaymentBrickController) {
    try {
      cardPaymentBrickController.unmount();
    } catch (e) {
      console.log('[Payment] Error unmounting previous brick:', e);
    }
    cardPaymentBrickController = null;
  }

  try {
    const bricksBuilder = mp.bricks();

    cardPaymentBrickController = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', {
      initialization: {
        amount: currentPaymentData.total,
        payer: {
          email: currentPaymentData.email
        }
      },
      customization: {
        visual: {
          style: {
            theme: 'dark'
          }
        },
        paymentMethods: {
          maxInstallments: 1 // Only allow single payment
        }
      },
      callbacks: {
        onReady: () => {
          console.log('[Payment] Card Payment Brick ready');
        },
        onSubmit: async (formData) => {
          return await processCardPayment(formData);
        },
        onError: (error) => {
          console.error('[Payment] Card Payment Brick error:', error);
          showCardPaymentError('Erro ao processar pagamento: ' + error.message);
        }
      }
    });
  } catch (err) {
    console.error('[Payment] Error loading Card Payment Brick:', err);
    showToast('Erro ao carregar formulário de cartão', 'error');
  }
}

// Process credit card payment
async function processCardPayment(formData) {
  try {
    toggleLoader(true);

    const res = await authFetch(`${API}/payments/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamId: currentPaymentData.teamId,
        memberIds: currentPaymentData.memberIds,
        robotIds: currentPaymentData.robotIds,
        payment_method_id: formData.payment_method_id,
        token: formData.token,
        installments: formData.installments || 1,
        issuer_id: formData.issuer_id,
        payer: formData.payer
      })
    });

    const data = await res.json();

    if (data.success) {
      if (data.payment.status === 'approved') {
        showToast('Pagamento aprovado com sucesso!', 'success');
        closePaymentModal();

        // Reload payment data to update UI
        setTimeout(() => {
          loadPaymentData();
          loadMembers();
          loadRobots();
        }, 1000);
      } else if (data.payment.status === 'in_process') {
        showToast('Pagamento em processamento. Você receberá uma confirmação em breve.', 'warning');
        closePaymentModal();
      } else {
        throw new Error(data.payment.status_detail || 'Pagamento não aprovado');
      }
    } else {
      throw new Error(data.error || 'Erro ao processar pagamento');
    }
  } catch (err) {
    console.error('[Payment] Error processing card payment:', err);
    showCardPaymentError(err.message);
    throw err; // Re-throw to prevent brick from clearing form
  } finally {
    toggleLoader(false);
  }
}

// Show card payment error
function showCardPaymentError(message) {
  const errorDiv = document.getElementById('cardPaymentError');
  const errorMessage = document.getElementById('cardPaymentErrorMessage');

  errorMessage.textContent = message;
  errorDiv.style.display = 'block';

  // Hide after 5 seconds
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Poll for payment confirmation (for PIX)
let paymentPollingInterval = null;

function startPaymentPolling(paymentId) {
  // Clear any existing polling
  if (paymentPollingInterval) {
    clearInterval(paymentPollingInterval);
  }

  // Poll every 3 seconds for up to 5 minutes
  let pollCount = 0;
  const maxPolls = 100; // 5 minutes

  paymentPollingInterval = setInterval(async () => {
    pollCount++;

    if (pollCount > maxPolls) {
      clearInterval(paymentPollingInterval);
      showToast('Tempo de espera excedido. Recarregue a página para verificar o status.', 'warning');
      return;
    }

    try {
      // Check if payment was approved by checking both members and robots
      let allItemsPaid = false;

      // Check members if any were selected
      if (currentPaymentData.memberIds && currentPaymentData.memberIds.length > 0) {
        const memberRes = await authFetch(`${API}/teams/${currentPaymentData.teamId}/members`);
        const members = await memberRes.json();

        const membersPaid = currentPaymentData.memberIds.every(id =>
          members.find(m => m.id === id)?.is_paid
        );

        allItemsPaid = membersPaid;
      } else {
        // If no members selected, consider this part as "paid"
        allItemsPaid = true;
      }

      // Check robots if any were selected
      if (allItemsPaid && currentPaymentData.robotIds && currentPaymentData.robotIds.length > 0) {
        const robotRes = await authFetch(`${API}/teams/${currentPaymentData.teamId}/robots`);
        const robots = await robotRes.json();

        const robotsPaid = currentPaymentData.robotIds.every(id =>
          robots.find(r => r.id === id)?.is_paid
        );

        allItemsPaid = robotsPaid;
      }

      // Only close modal if we actually had items to pay and they're all paid
      const hasItems = (currentPaymentData.memberIds?.length > 0 || currentPaymentData.robotIds?.length > 0);

      if (allItemsPaid && hasItems) {
        clearInterval(paymentPollingInterval);
        showToast('Pagamento confirmado com sucesso!', 'success');
        closePaymentModal();

        // Reload UI
        loadPaymentData();
        loadMembers();
        loadRobots();
      }
    } catch (err) {
      console.error('[Payment] Error polling payment status:', err);
    }
  }, 3000);
}

// Initialize Mercado Pago on page load
if (typeof MercadoPago !== 'undefined') {
  initMercadoPago();
} else {
  window.addEventListener('load', () => {
    setTimeout(initMercadoPago, 500);
  });
}
