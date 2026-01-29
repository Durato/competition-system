# Fluxo de Pagamento - Checkout Bricks

## Visão Geral

```
┌─────────────┐
│   Usuário   │
│   (Líder)   │
└──────┬──────┘
       │
       │ 1. Seleciona membros/robôs
       │
       ▼
┌──────────────────────────────┐
│  Frontend (app.html/app.js)  │
│  - Lista itens pendentes     │
│  - Calcula total             │
└──────┬───────────────────────┘
       │
       │ 2. Clica "Pagar Agora"
       │
       ▼
┌──────────────────────────────┐
│   payment.js                 │
│   openPaymentModal()         │
│   - Abre modal              │
│   - Mostra tabs PIX/Cartão  │
└──────┬───────────────────────┘
       │
       ├─────────────────────┬─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
  [PIX Flow]          [Card Flow]           [Close]
```

---

## Fluxo PIX Detalhado

```
┌──────────────────────────────────────────────────────────────┐
│                       FLUXO PIX                              │
└──────────────────────────────────────────────────────────────┘

1. USUÁRIO SELECIONA PIX
   │
   ├─► Frontend chama processPIXPayment()
   │
   └─► Exibe loading spinner

2. BACKEND PROCESSA
   │
   ├─► POST /payments/process
   │   Body: {
   │     teamId, memberIds, robotIds,
   │     payment_method_id: "pix",
   │     payer: { email, name }
   │   }
   │
   ├─► Backend valida:
   │   • Limite de 400 inscritos
   │   • Pertencimento à equipe
   │   • Dados obrigatórios
   │
   ├─► mercadopago.service.js → createDirectPayment()
   │   • Chama API Mercado Pago
   │   • Gera QR Code e código PIX
   │
   └─► Retorna response:
       {
         success: true,
         payment: {
           id: "123456",
           status: "pending",
           pix: {
             qr_code: "00020126...",
             qr_code_base64: "iVBORw0KGgo...",
             ticket_url: "https://..."
           }
         }
       }

3. FRONTEND EXIBE QR CODE
   │
   ├─► Converte base64 em imagem
   ├─► Exibe código copia-e-cola
   ├─► Botão "Copiar" habilitado
   │
   └─► Inicia polling (a cada 3s)

4. USUÁRIO PAGA
   │
   ├─► Abre app do banco
   ├─► Escaneia QR Code OU cola código
   └─► Confirma pagamento

5. MERCADO PAGO CONFIRMA
   │
   └─► Envia webhook para backend

6. WEBHOOK PROCESSA
   │
   ├─► POST /webhook/mercadopago
   │   Body: { type: "payment", data: { id: "123456" } }
   │
   ├─► Backend busca detalhes do pagamento
   │   • Verifica se status = "approved"
   │   • Extrai metadata (teamId, memberIds, robotIds)
   │
   ├─► Atualiza banco de dados:
   │   • UPDATE team_members SET is_paid = true
   │   • UPDATE robots SET is_paid = true
   │   • UPDATE pending_payments SET status = 'completed'
   │
   └─► Retorna 200 OK

7. POLLING DETECTA
   │
   ├─► Frontend faz GET /teams/{id}/members
   ├─► Verifica se membros estão is_paid = true
   │
   └─► SIM?
       ├─► Para polling
       ├─► Toast "Pagamento confirmado!"
       ├─► Fecha modal
       └─► Atualiza UI

┌──────────────────────────────────────────────────────────────┐
│  TEMPO TOTAL: 3-10 segundos (típico)                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Fluxo Cartão de Crédito Detalhado

```
┌──────────────────────────────────────────────────────────────┐
│                   FLUXO CARTÃO DE CRÉDITO                    │
└──────────────────────────────────────────────────────────────┘

1. USUÁRIO SELECIONA CARTÃO
   │
   ├─► Frontend chama switchPaymentTab('card')
   │
   └─► Chama loadCardPaymentBrick()

2. MERCADO PAGO BRICK CARREGA
   │
   ├─► payment.js inicializa MP SDK
   │   const mp = new MercadoPago(publicKey)
   │
   ├─► Cria Card Payment Brick:
   │   mp.bricks().create('cardPayment', ...)
   │
   └─► Formulário seguro aparece:
       ┌─────────────────────────┐
       │  Número do cartão       │
       │  ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓   │
       │                         │
       │  Nome do titular        │
       │  ___________________    │
       │                         │
       │  Validade    CVV        │
       │  MM/AA       ▓▓▓        │
       │                         │
       │  [ Pagar R$ 0,10 ]      │
       └─────────────────────────┘

3. USUÁRIO PREENCHE
   │
   ├─► Digite número do cartão
   ├─► Digite nome
   ├─► Digite validade
   ├─► Digite CVV
   │
   └─► Clica "Pagar"

4. TOKENIZAÇÃO (CLIENT-SIDE)
   │
   ├─► MP Brick valida campos
   │   • Verifica número do cartão (Luhn)
   │   • Verifica validade
   │   • Verifica CVV
   │
   ├─► Envia dados para MP API (HTTPS)
   │   ⚠️ DADOS NUNCA PASSAM PELO SEU SERVIDOR
   │
   └─► MP retorna token seguro:
       {
         token: "abc123token",
         payment_method_id: "visa",
         issuer_id: "123"
       }

5. FRONTEND ENVIA TOKEN
   │
   ├─► Callback onSubmit() é chamado
   │
   └─► POST /payments/process
       Body: {
         teamId, memberIds, robotIds,
         payment_method_id: "visa",
         token: "abc123token",  ← Token seguro
         installments: 1,
         issuer_id: "123",
         payer: { email, name }
       }

6. BACKEND PROCESSA
   │
   ├─► Valida dados (limite, equipe, etc)
   │
   ├─► mercadopago.service.js → createDirectPayment()
   │   • Usa token (não dados do cartão)
   │   • Chama API Mercado Pago
   │
   └─► MP processa pagamento:
       • Verifica com banco emissor
       • Retorna resultado INSTANTÂNEO

7. BACKEND RETORNA
   │
   └─► Response (se aprovado):
       {
         success: true,
         payment: {
           id: "789012",
           status: "approved",  ← Aprovado!
           payment_method_id: "visa",
           transaction_amount: 0.10
         }
       }

8. FRONTEND CONFIRMA
   │
   ├─► Se status = "approved":
   │   ├─► Marca membros/robôs como pagos (backend já fez)
   │   ├─► Toast "Pagamento aprovado!"
   │   ├─► Fecha modal
   │   └─► Atualiza UI
   │
   ├─► Se status = "in_process":
   │   ├─► Toast "Em processamento..."
   │   └─► Webhook confirmará depois
   │
   └─► Se status = "rejected":
       ├─► Mostra mensagem de erro
       └─► Mantém modal aberto

┌──────────────────────────────────────────────────────────────┐
│  TEMPO TOTAL: 1-3 segundos (aprovação instantânea)           │
└──────────────────────────────────────────────────────────────┘
```

---

## Diagrama de Sequência - PIX

```
Usuário    Frontend    Backend    MercadoPago    Banco    Webhook
  │           │           │            │           │         │
  │ Clica     │           │            │           │         │
  │ "Pagar"   │           │            │           │         │
  ├──────────►│           │            │           │         │
  │           │           │            │           │         │
  │           │ POST /payments/process │           │         │
  │           ├──────────►│            │           │         │
  │           │           │            │           │         │
  │           │           │ Create PIX │           │         │
  │           │           ├───────────►│           │         │
  │           │           │            │           │         │
  │           │           │◄───────────┤           │         │
  │           │           │ QR Code    │           │         │
  │           │           │            │           │         │
  │           │◄──────────┤            │           │         │
  │           │ QR Code   │            │           │         │
  │           │           │            │           │         │
  │◄──────────┤           │            │           │         │
  │ Mostra QR │           │            │           │         │
  │           │           │            │           │         │
  │ Escaneia  │           │            │           │         │
  │ QR Code   │           │            │           │         │
  ├──────────────────────────────────────────────►│         │
  │           │           │            │           │         │
  │           │           │            │           │         │
  │           │           │            │  Payment  │         │
  │           │           │            │◄──────────┤         │
  │           │           │            │           │         │
  │           │           │            │ Webhook   │         │
  │           │           │            ├──────────────────►  │
  │           │           │            │           │         │
  │           │           │  POST /webhook/mp      │         │
  │           │           │◄───────────────────────────────  │
  │           │           │            │           │         │
  │           │           │ Update DB  │           │         │
  │           │           │ is_paid=T  │           │         │
  │           │           │            │           │         │
  │           │ Polling   │            │           │         │
  │           ├──────────►│            │           │         │
  │           │           │            │           │         │
  │           │◄──────────┤            │           │         │
  │           │ is_paid=T │            │           │         │
  │           │           │            │           │         │
  │◄──────────┤           │            │           │         │
  │ "Confirmado!"         │            │           │         │
  │           │           │            │           │         │
```

---

## Diagrama de Sequência - Cartão

```
Usuário    Frontend    MP-Brick    Backend    MercadoPago
  │           │           │           │            │
  │ Preenche  │           │           │            │
  │ Cartão    │           │           │            │
  ├──────────►│           │           │            │
  │           │           │           │            │
  │           │ Submit    │           │            │
  │           ├──────────►│           │            │
  │           │           │           │            │
  │           │           │ Tokenize  │            │
  │           │           ├───────────────────────►│
  │           │           │           │            │
  │           │           │◄───────────────────────┤
  │           │           │ Token     │            │
  │           │           │           │            │
  │           │◄──────────┤           │            │
  │           │ Token     │           │            │
  │           │           │           │            │
  │           │ POST /payments/process │            │
  │           │   (with token)         │            │
  │           ├──────────────────────►│            │
  │           │           │           │            │
  │           │           │           │ Process    │
  │           │           │           ├───────────►│
  │           │           │           │            │
  │           │           │           │◄───────────┤
  │           │           │           │ Approved   │
  │           │           │           │            │
  │           │           │ Update DB │            │
  │           │           │ is_paid=T │            │
  │           │           │           │            │
  │           │◄──────────────────────┤            │
  │           │ Success   │           │            │
  │           │           │           │            │
  │◄──────────┤           │           │            │
  │ "Aprovado!"           │           │            │
  │           │           │           │            │
```

---

## Estrutura de Dados

### Request - PIX
```json
{
  "teamId": "550e8400-e29b-41d4-a716-446655440000",
  "memberIds": [
    "660e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002"
  ],
  "robotIds": [
    "880e8400-e29b-41d4-a716-446655440003"
  ],
  "payment_method_id": "pix",
  "payer": {
    "email": "joao@example.com",
    "name": "João Silva"
  }
}
```

### Response - PIX
```json
{
  "success": true,
  "payment": {
    "id": "1234567890",
    "status": "pending",
    "status_detail": "pending_waiting_payment",
    "payment_method_id": "pix",
    "transaction_amount": 0.30,
    "pix": {
      "qr_code": "00020126330014br.gov.bcb.pix...",
      "qr_code_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
      "ticket_url": "https://www.mercadopago.com/..."
    }
  }
}
```

### Request - Cartão
```json
{
  "teamId": "550e8400-e29b-41d4-a716-446655440000",
  "memberIds": ["660e8400-e29b-41d4-a716-446655440001"],
  "robotIds": [],
  "payment_method_id": "visa",
  "token": "abc123def456token",
  "installments": 1,
  "issuer_id": "123",
  "payer": {
    "email": "maria@example.com",
    "first_name": "Maria",
    "last_name": "Santos"
  }
}
```

### Response - Cartão Aprovado
```json
{
  "success": true,
  "payment": {
    "id": "9876543210",
    "status": "approved",
    "status_detail": "accredited",
    "payment_method_id": "visa",
    "transaction_amount": 0.10,
    "installments": 1
  }
}
```

### Webhook Payload
```json
{
  "id": "12345",
  "live_mode": false,
  "type": "payment",
  "date_created": "2026-01-29T10:00:00Z",
  "user_id": "137390542",
  "api_version": "v1",
  "action": "payment.created",
  "data": {
    "id": "1234567890"
  }
}
```

### Payment Object (do MP)
```json
{
  "id": "1234567890",
  "status": "approved",
  "status_detail": "accredited",
  "payment_method_id": "pix",
  "transaction_amount": 0.30,
  "metadata": {
    "teamId": "550e8400-e29b-41d4-a716-446655440000",
    "memberIds": ["660e8400-...001", "770e8400-...002"],
    "robotIds": ["880e8400-...003"],
    "userId": "990e8400-e29b-41d4-a716-446655440004"
  },
  "external_reference": "550e8400-e29b-41d4-a716-446655440000",
  "payer": {
    "email": "joao@example.com",
    "first_name": "João",
    "last_name": "Silva"
  }
}
```

---

## Estados do Pagamento

```
┌─────────────────────────────────────────────────────────┐
│                  ESTADOS POSSÍVEIS                      │
└─────────────────────────────────────────────────────────┘

PIX:
  pending → approved ✅
  pending → cancelled ❌ (timeout)

Cartão:
  approved ✅ (instantâneo, comum)
  in_process ⏳ (precisa confirmação, vai para webhook)
  rejected ❌ (recusado pelo banco)
  pending ⏳ (aguardando processamento)

Status Detail (exemplos):
  - accredited: Pagamento creditado ✅
  - pending_waiting_payment: Aguardando pagamento PIX
  - cc_rejected_insufficient_amount: Saldo insuficiente
  - cc_rejected_bad_filled_card_number: Número de cartão inválido
  - cc_rejected_bad_filled_date: Data de validade inválida
  - cc_rejected_bad_filled_security_code: CVV inválido
```

---

## Segurança - Fluxo de Dados

```
┌──────────────────────────────────────────────────────────────┐
│               DADOS DO CARTÃO - NUNCA NO SERVIDOR            │
└──────────────────────────────────────────────────────────────┘

Usuário digita:
  Número: 5031 4332 1540 6351
  Nome: APRO
  Validade: 11/25
  CVV: 123
       │
       │ ❌ NÃO vai para seu servidor
       ▼
  MP Brick (JavaScript)
  - Valida localmente
  - Envia via HTTPS para MP
       │
       │ ✅ Dados seguros com MP
       ▼
  Mercado Pago API
  - Processa tokenização
  - Retorna token seguro
       │
       │ Token: "abc123..." (não contém dados sensíveis)
       ▼
  Seu Frontend
  - Recebe token
  - Envia para seu backend
       │
       │ ✅ Apenas token
       ▼
  Seu Backend
  - Usa token para criar pagamento
  - Nunca vê dados do cartão
       │
       │ Token usado para processar
       ▼
  Mercado Pago Payment API
  - Processa pagamento
  - Retorna resultado

┌──────────────────────────────────────────────────────────────┐
│  CONCLUSÃO: Seu servidor NUNCA vê dados sensíveis do cartão │
│  Você está em compliance com PCI-DSS automaticamente        │
└──────────────────────────────────────────────────────────────┘
```

---

## Performance e Timeouts

```
Operação                           Tempo Esperado      Timeout
─────────────────────────────────────────────────────────────────
Abrir modal                         < 100ms            N/A
Gerar QR Code PIX                   1-3s               5s
Carregar Card Payment Brick         1-2s               10s
Tokenizar cartão                    < 500ms            5s
Processar pagamento cartão          1-3s               10s
Webhook receber notificação         1-10s              N/A
Polling detectar pagamento PIX      3-10s              5min
```

---

## Monitoramento Recomendado

```javascript
// Métricas a coletar:

1. Taxa de Conversão
   - Quantos abrem o modal vs completam pagamento
   - PIX vs Cartão (qual converte mais)

2. Tempo Médio
   - Tempo de geração de QR Code
   - Tempo até pagamento PIX ser confirmado
   - Tempo de aprovação de cartão

3. Erros
   - Taxa de erro na geração de PIX
   - Taxa de rejeição de cartão
   - Erros de webhook

4. Abandono
   - Quantos abrem modal mas não pagam
   - Em que etapa abandonam (PIX vs Cartão)

5. Webhook
   - Latência do webhook
   - Falhas de processamento
   - Webhooks duplicados
```

---

Esse fluxo garante:
- ✅ Segurança PCI-DSS
- ✅ Experiência rápida e fluida
- ✅ Confirmação em tempo real
- ✅ Rastreabilidade completa
