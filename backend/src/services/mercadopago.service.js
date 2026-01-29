import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// Inicializa o cliente do Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  options: {
    timeout: 5000,
    idempotencyKey: 'abc'
  }
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);

/**
 * Cria uma preferência de pagamento no Mercado Pago
 * @param {Object} data - Dados do pagamento
 * @param {Array} data.items - Items do carrinho [{title, quantity, unit_price}]
 * @param {Object} data.metadata - Dados customizados (teamId, memberIds, robotIds)
 * @param {Object} data.payer - Dados do pagador {email, name}
 * @returns {Promise<Object>} - Preferência criada com init_point
 */
export async function createPaymentPreference(data) {
  const { items, metadata, payer } = data;

  if (!items || items.length === 0) {
    throw new Error('Nenhum item fornecido');
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado no .env');
  }

  console.log('[MercadoPago] Criando preferência de pagamento:', {
    items: items.length,
    total: items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
    metadata
  });

  try {
    const preference = await preferenceClient.create({
      body: {
        items: items.map(item => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          currency_id: 'BRL'
        })),
        payment_methods: {
          installments: 1 // Apenas à vista
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/app.html?payment=success`,
          failure: `${process.env.FRONTEND_URL}/app.html?payment=failure`,
          pending: `${process.env.FRONTEND_URL}/app.html?payment=pending`
        },
        auto_return: 'approved',
        notification_url: `${process.env.BACKEND_URL}/webhook/mercadopago`,
        statement_descriptor: 'TECHNOVACAO',
        external_reference: metadata.teamId, // ID do time para referência
        metadata: metadata // Dados customizados que voltam no webhook
      }
    });

    console.log('[MercadoPago] Preferência criada com sucesso:', preference.id);

    return {
      id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point
    };

  } catch (error) {
    console.error('[MercadoPago] Erro ao criar preferência:', error);
    throw new Error('Erro ao criar pagamento no Mercado Pago: ' + error.message);
  }
}

/**
 * Busca informações de um pagamento
 * @param {string} paymentId - ID do pagamento
 * @returns {Promise<Object>} - Dados do pagamento
 */
export async function getPayment(paymentId) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
  }

  try {
    const payment = await paymentClient.get({ id: paymentId });
    return payment;
  } catch (error) {
    console.error('[MercadoPago] Erro ao buscar pagamento:', error);
    throw error;
  }
}

/**
 * Verifica se um pagamento foi aprovado
 * @param {Object} payment - Objeto do pagamento
 * @returns {boolean} - true se aprovado
 */
export function isPaymentApproved(payment) {
  return payment.status === 'approved' && payment.status_detail === 'accredited';
}

/**
 * Extrai metadata de um pagamento
 * @param {Object} payment - Objeto do pagamento
 * @returns {Object} - Metadata (teamId, memberIds, robotIds)
 */
export function getPaymentMetadata(payment) {
  return payment.metadata || {};
}

/**
 * Cria um pagamento direto (PIX ou Cartão de Crédito) - Checkout Bricks
 * @param {Object} data - Dados do pagamento
 * @param {string} data.payment_method_id - Método de pagamento (pix, credit_card, etc)
 * @param {number} data.transaction_amount - Valor total do pagamento
 * @param {string} data.description - Descrição do pagamento
 * @param {Object} data.payer - Dados do pagador {email, first_name, last_name}
 * @param {Object} data.metadata - Dados customizados (teamId, memberIds, robotIds, userId)
 * @param {Object} [data.token] - Token do cartão (obrigatório para cartão de crédito)
 * @param {number} [data.installments] - Número de parcelas (padrão: 1)
 * @param {string} [data.issuer_id] - ID do emissor do cartão
 * @returns {Promise<Object>} - Pagamento criado
 */
export async function createDirectPayment(data) {
  const {
    payment_method_id,
    transaction_amount,
    description,
    payer,
    metadata,
    token,
    installments = 1,
    issuer_id
  } = data;

  if (!payment_method_id) {
    throw new Error('payment_method_id é obrigatório');
  }

  if (!transaction_amount || transaction_amount <= 0) {
    throw new Error('transaction_amount deve ser maior que zero');
  }

  if (!payer || !payer.email) {
    throw new Error('Dados do pagador (email) são obrigatórios');
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado no .env');
  }

  // Para cartão de crédito, o token é obrigatório
  if (payment_method_id !== 'pix' && !token) {
    throw new Error('Token do cartão é obrigatório para pagamento com cartão');
  }

  console.log('[MercadoPago] Criando pagamento direto:', {
    payment_method_id,
    transaction_amount,
    payer_email: payer.email,
    metadata
  });

  try {
    const paymentData = {
      payment_method_id,
      transaction_amount,
      description,
      payer: {
        email: payer.email,
        first_name: payer.first_name || payer.name?.split(' ')[0] || 'Cliente',
        last_name: payer.last_name || payer.name?.split(' ').slice(1).join(' ') || 'Technovação'
      },
      notification_url: `${process.env.BACKEND_URL}/webhook/mercadopago`,
      statement_descriptor: 'TECHNOVACAO',
      metadata: metadata || {}
    };

    // Adiciona token e installments apenas para pagamentos com cartão
    if (payment_method_id !== 'pix') {
      paymentData.token = token;
      paymentData.installments = installments;
      if (issuer_id) {
        paymentData.issuer_id = issuer_id;
      }
    }

    const payment = await paymentClient.create({
      body: paymentData
    });

    console.log('[MercadoPago] Pagamento criado com sucesso:', {
      id: payment.id,
      status: payment.status,
      payment_method_id: payment.payment_method_id
    });

    return payment;

  } catch (error) {
    console.error('[MercadoPago] Erro ao criar pagamento direto:', error);
    throw new Error('Erro ao processar pagamento: ' + error.message);
  }
}

export default {
  createPaymentPreference,
  createDirectPayment,
  getPayment,
  isPaymentApproved,
  getPaymentMetadata
};
