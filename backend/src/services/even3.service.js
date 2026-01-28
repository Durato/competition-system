// Serviço de integração com a API do Even3

const EVEN3_API_URL = process.env.EVEN3_API_URL || 'https://www.even3.com.br/api/v1';
const EVEN3_TOKEN = process.env.EVEN3_TOKEN;

// Mapeamento de categorias do sistema para IDs de tickets do Even3
// Os IDs devem ser configurados via variáveis de ambiente
const TICKET_IDS = {
  competidor: process.env.EVEN3_TICKET_COMPETIDOR,
  // Categorias de robôs - adicionar conforme necessário
  'combate_150g': process.env.EVEN3_TICKET_COMBATE_150G,
  'sumo_3kg': process.env.EVEN3_TICKET_SUMO_3KG,
  'artbot': process.env.EVEN3_TICKET_ARTBOT,
};

// Preços padrão
const PRICES = {
  competidor: 55.00,
  robot: 20.00,
};

/**
 * Cria uma inscrição no Even3
 * @param {Object} attendee - Dados do participante
 * @param {string} attendee.name - Nome do participante
 * @param {string} attendee.email - Email do participante
 * @param {number} ticketId - ID do ticket/entrada no Even3
 * @param {number} price - Preço do ingresso
 * @returns {Promise<Object>} - Resposta da API
 */
export async function createAttendee(attendee, ticketId, price) {
  if (!EVEN3_TOKEN) {
    throw new Error('EVEN3_TOKEN não configurado');
  }

  if (!ticketId) {
    throw new Error('ID do ticket não fornecido');
  }

  console.log(`[Even3] Criando inscrição para ${attendee.email} - Ticket: ${ticketId}`);

  try {
    const response = await fetch(`${EVEN3_API_URL}/attendees/create`, {
      method: 'POST',
      headers: {
        'Authorization-Token': EVEN3_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: attendee.name,
        email: attendee.email,
        registration_confirmed: false, // Deixa pendente até pagamento
        registration: {
          id_ticket_price: parseInt(ticketId),
          price: parseFloat(price)
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Even3] Erro ao criar inscrição:', data);
      throw new Error(data.message || 'Erro ao criar inscrição no Even3');
    }

    console.log(`[Even3] Inscrição criada com sucesso para ${attendee.email}`);
    return data;

  } catch (error) {
    console.error('[Even3] Erro na requisição:', error);
    throw error;
  }
}

/**
 * Busca informações do evento e tickets disponíveis
 * @returns {Promise<Object>} - Dados do evento
 */
export async function getEventInfo() {
  if (!EVEN3_TOKEN) {
    throw new Error('EVEN3_TOKEN não configurado');
  }

  const response = await fetch(`${EVEN3_API_URL}/event`, {
    headers: { 'Authorization-Token': EVEN3_TOKEN }
  });

  if (!response.ok) {
    throw new Error('Erro ao buscar informações do evento');
  }

  return response.json();
}

/**
 * Busca pagamentos do evento
 * @returns {Promise<Object>} - Lista de pagamentos
 */
export async function getPayments() {
  if (!EVEN3_TOKEN) {
    throw new Error('EVEN3_TOKEN não configurado');
  }

  const response = await fetch(`${EVEN3_API_URL}/payments`, {
    headers: { 'Authorization-Token': EVEN3_TOKEN }
  });

  if (!response.ok) {
    throw new Error('Erro ao buscar pagamentos');
  }

  return response.json();
}

/**
 * Busca participantes do evento
 * @returns {Promise<Object>} - Lista de participantes
 */
export async function getAttendees() {
  if (!EVEN3_TOKEN) {
    throw new Error('EVEN3_TOKEN não configurado');
  }

  const response = await fetch(`${EVEN3_API_URL}/attendees`, {
    headers: { 'Authorization-Token': EVEN3_TOKEN }
  });

  if (!response.ok) {
    throw new Error('Erro ao buscar participantes');
  }

  return response.json();
}

/**
 * Retorna o ID do ticket do Even3 para uma categoria de robô
 * @param {string} categoryName - Nome da categoria
 * @returns {string|null} - ID do ticket ou null
 */
export function getTicketIdForCategory(categoryName) {
  // Normaliza o nome da categoria para busca
  const normalized = categoryName.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');

  // Primeiro tenta buscar pelo nome normalizado
  if (TICKET_IDS[normalized]) {
    return TICKET_IDS[normalized];
  }

  // Tenta variações comuns
  const variations = {
    'competidor': TICKET_IDS.competidor,
    'combate': TICKET_IDS.combate_150g,
    'fairyweight': TICKET_IDS.combate_150g,
    'sumo': TICKET_IDS.sumo_3kg,
    'artbot': TICKET_IDS.artbot,
  };

  for (const [key, value] of Object.entries(variations)) {
    if (normalized.includes(key) && value) {
      return value;
    }
  }

  // Fallback: usa variável de ambiente genérica para robô
  return process.env.EVEN3_TICKET_ROBOT_DEFAULT || null;
}

/**
 * Retorna os preços configurados
 */
export function getPrices() {
  return PRICES;
}

/**
 * Retorna os IDs de tickets configurados
 */
export function getTicketIds() {
  return TICKET_IDS;
}

export default {
  createAttendee,
  getEventInfo,
  getPayments,
  getAttendees,
  getTicketIdForCategory,
  getPrices,
  getTicketIds,
};
