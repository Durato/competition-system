# Migração para Mercado Pago Checkout Bricks

## Resumo da Migração

Esta migração substitui o **Mercado Pago Checkout Pro** (redirecionamento) pelo **Checkout Bricks** (pagamento integrado no site), permitindo que usuários paguem sem criar conta no Mercado Pago.

## Alterações Realizadas

### Backend

#### 1. **backend/src/services/mercadopago.service.js**
- ✅ Adicionada função `createDirectPayment()` para processar pagamentos diretos (PIX e Cartão)
- ✅ Suporte para PIX com QR Code e código copia-e-cola
- ✅ Suporte para pagamentos com cartão de crédito
- ✅ Mantida função `createPaymentPreference()` para retrocompatibilidade

#### 2. **backend/src/routes/payment.routes.js**
- ✅ Nova rota `GET /payments/config` - Retorna a public key do Mercado Pago
- ✅ Nova rota `POST /payments/process` - Processa pagamentos PIX e Cartão
- ✅ Validações de limite de 400 inscritos
- ✅ Validação de pertencimento à equipe
- ✅ Retorna dados específicos do PIX (QR Code e código)
- ✅ Mantida rota `/checkout` para retrocompatibilidade

#### 3. **backend/src/routes/webhook.routes.js**
- ✅ Atualizado para suportar ambos os formatos de pagamento
- ✅ Busca por `mp_payment_id` (Checkout Bricks) primeiro
- ✅ Fallback para `mp_preference_id` (Checkout Pro legado)

### Frontend

#### 4. **frontend/app.html**
- ✅ Adicionado SDK do Mercado Pago
- ✅ Atualizada Content Security Policy para permitir SDK e APIs do MP
- ✅ Adicionado modal de pagamento com abas PIX e Cartão
- ✅ Versão dos scripts atualizada para v4

#### 5. **frontend/styles.css**
- ✅ Estilos do modal de pagamento
- ✅ Estilos das abas PIX/Cartão
- ✅ Animações e transições
- ✅ Tema dark compatível com Mercado Pago Bricks

#### 6. **frontend/payment.js** (NOVO ARQUIVO)
- ✅ Inicialização do SDK Mercado Pago
- ✅ Gestão do modal de pagamento
- ✅ Processamento de pagamento PIX
- ✅ Integração com Card Payment Brick (formulário de cartão seguro)
- ✅ Polling para confirmação de pagamento PIX
- ✅ Função de copiar código PIX

#### 7. **frontend/app.js**
- ✅ Função `handleCheckout()` atualizada para abrir modal ao invés de redirecionar
- ✅ Carrega dados do usuário para preencher informações de pagamento

## Como Funciona

### Fluxo de Pagamento PIX

1. Usuário seleciona itens e clica em "Pagar Agora"
2. Modal abre com aba PIX ativa
3. Backend cria pagamento PIX via API Mercado Pago
4. QR Code e código copia-e-cola são exibidos
5. Usuário paga via app do banco
6. Sistema faz polling a cada 3 segundos para verificar confirmação
7. Webhook do MP notifica backend quando pagamento é aprovado
8. Backend marca membros/robôs como pagos
9. Frontend detecta confirmação e atualiza UI

### Fluxo de Pagamento Cartão

1. Usuário seleciona itens e clica em "Pagar Agora"
2. Modal abre e usuário clica na aba "Cartão de Crédito"
3. Mercado Pago Card Payment Brick carrega formulário seguro
4. Usuário preenche dados do cartão
5. Ao submeter, MP tokeniza o cartão (dados nunca passam pelo backend)
6. Token é enviado ao backend para processar pagamento
7. Backend cria pagamento via API Mercado Pago
8. Se aprovado instantaneamente, marca como pago
9. Se em processamento, webhook confirmará posteriormente

## Credenciais Configuradas

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-5780407957473382-012913-fa4efcd008ce016afae74d96575c98a2-137390542
MERCADOPAGO_PUBLIC_KEY=APP_USR-f8bdb89f-01be-4827-baae-e68d3bd7a9fb
```

## Endpoints da API

### GET `/payments/config`
**Público** - Retorna configurações de pagamento

**Response:**
```json
{
  "mercadoPagoPublicKey": "APP_USR-f8bdb89f-01be-4827-baae-e68d3bd7a9fb"
}
```

### POST `/payments/process`
**Autenticado + Líder** - Processa pagamento direto

**Request:**
```json
{
  "teamId": "uuid",
  "memberIds": ["uuid1", "uuid2"],
  "robotIds": ["uuid3"],
  "payment_method_id": "pix", // ou "credit_card", "debit_card", etc
  "token": "card_token", // apenas para cartão
  "installments": 1, // apenas para cartão
  "issuer_id": "issuer_id", // opcional, para cartão
  "payer": {
    "email": "user@example.com",
    "name": "Nome Usuário"
  }
}
```

**Response (PIX):**
```json
{
  "success": true,
  "payment": {
    "id": "123456789",
    "status": "pending",
    "payment_method_id": "pix",
    "pix": {
      "qr_code": "00020126...",
      "qr_code_base64": "iVBORw0KGgo...",
      "ticket_url": "https://..."
    }
  }
}
```

**Response (Cartão Aprovado):**
```json
{
  "success": true,
  "payment": {
    "id": "123456789",
    "status": "approved",
    "payment_method_id": "visa",
    "transaction_amount": 0.10
  }
}
```

### POST `/payments/checkout` (LEGADO)
**Autenticado + Líder** - Cria preferência Checkout Pro (mantido para retrocompatibilidade)

## Vantagens da Nova Implementação

✅ **Sem necessidade de conta MP** - Usuários pagam diretamente sem criar conta
✅ **Experiência integrada** - Pagamento sem sair do site
✅ **Suporte a PIX** - Método de pagamento mais usado no Brasil
✅ **Formulário seguro** - Card Payment Brick com PCI compliance
✅ **Melhor conversão** - Menos fricção no processo de pagamento
✅ **Feedback visual** - QR Code e status em tempo real
✅ **Tema dark** - Consistente com o design do site

## Preços Configurados (Teste)

```javascript
const PRICE_MEMBER = 0.10; // R$ 0,10 por membro
const PRICE_ROBOT = 0.10;  // R$ 0,10 por robô
```

## Metadata do Pagamento

Todos os pagamentos incluem metadata para rastreamento:

```json
{
  "teamId": "uuid-da-equipe",
  "memberIds": ["uuid1", "uuid2"],
  "robotIds": ["uuid3", "uuid4"],
  "userId": "uuid-do-usuario-que-pagou"
}
```

Esta metadata é usada pelo webhook para identificar quais membros/robôs marcar como pagos.

## Webhook

O webhook em `/webhook/mercadopago` foi atualizado para:

1. Aceitar notificações de ambos os sistemas (Checkout Pro e Bricks)
2. Buscar pagamento por ID
3. Verificar se foi aprovado
4. Extrair metadata
5. Marcar membros e robôs como pagos
6. Atualizar `pending_payments` como completo

## Segurança

- ✅ CSP atualizado para permitir apenas domínios do Mercado Pago
- ✅ Public key exposta via endpoint (seguro, é pública mesmo)
- ✅ Access token permanece apenas no backend
- ✅ Dados de cartão nunca passam pelo servidor (tokenização no cliente)
- ✅ Validação de autenticação e permissões (auth + leader)
- ✅ Validação de pertencimento à equipe antes de processar

## Testes Recomendados

### PIX
1. Selecionar membros/robôs
2. Clicar em "Pagar Agora"
3. Verificar que QR Code é gerado
4. Copiar código PIX
5. Simular pagamento em ambiente de teste
6. Verificar confirmação automática

### Cartão de Crédito
1. Selecionar membros/robôs
2. Clicar em "Pagar Agora"
3. Mudar para aba "Cartão de Crédito"
4. Preencher formulário com cartão de teste:
   - **Número:** 5031 4332 1540 6351 (Mastercard)
   - **CVV:** 123
   - **Validade:** 11/25
   - **Nome:** APRO (para aprovar)
5. Verificar aprovação instantânea
6. Verificar que membros/robôs foram marcados como pagos

## Cartões de Teste Mercado Pago

| Cartão | Número | CVV | Resultado |
|--------|--------|-----|-----------|
| Mastercard | 5031 4332 1540 6351 | 123 | Aprovado |
| Visa | 4509 9535 6623 3704 | 123 | Aprovado |
| Amex | 3711 803032 57522 | 1234 | Aprovado |
| Mastercard | 5031 4332 1540 6351 | 123 | Recusado (use nome "OTHE") |

**Data de validade:** Qualquer data futura
**Titular:** APRO (aprovado) ou OTHE (recusado)

## Migração Gradual

O sistema suporta **ambos** os fluxos simultaneamente:

- **Novo:** Modal com PIX/Cartão (recomendado)
- **Antigo:** Redirect para Checkout Pro (ainda funciona)

Para forçar uso exclusivo do novo sistema, remova a rota `/payments/checkout`.

## Rollback

Se necessário reverter:

1. Alterar `handleCheckout()` em `app.js` para versão anterior
2. Remover `payment.js` do HTML
3. Remover modal de pagamento do HTML
4. Rota `/payments/checkout` continua funcionando

## Suporte

Para dúvidas sobre:
- **Mercado Pago SDK:** https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks
- **Card Payment Brick:** https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick
- **Webhooks:** https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks

## Próximos Passos (Opcional)

- [ ] Adicionar suporte a outros métodos de pagamento (boleto, débito)
- [ ] Implementar parcelamento (remover `maxInstallments: 1`)
- [ ] Adicionar endpoint para consultar status de pagamento específico
- [ ] Adicionar notificações por email quando pagamento for confirmado
- [ ] Implementar dashboard de administração para visualizar todos os pagamentos
- [ ] Adicionar retry automático para webhooks falhados
