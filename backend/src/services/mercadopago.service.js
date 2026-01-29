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
        payer: payer ? {
          email: payer.email,
          name: payer.name
        } : undefined,
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

export default {
  createPaymentPreference,
  getPayment,
  isPaymentApproved,
  getPaymentMetadata
};
