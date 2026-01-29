# Guia de Testes - Checkout Bricks

## Preparação

1. **Verificar que o backend está rodando:**
   ```bash
   cd backend
   npm start
   ```

2. **Verificar credenciais no .env:**
   ```
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-5780407957473382-012913-fa4efcd008ce016afae74d96575c98a2-137390542
   MERCADOPAGO_PUBLIC_KEY=APP_USR-f8bdb89f-01be-4827-baae-e68d3bd7a9fb
   ```

3. **Servir o frontend:**
   - Abra `frontend/app.html` em um navegador
   - Ou use um servidor local (ex: Live Server no VS Code)

## Cenários de Teste

### 1. Teste de Pagamento PIX ✅

**Passos:**
1. Faça login como líder de equipe
2. Vá até a seção "Pagamentos Pendentes"
3. Selecione 1 ou mais membros/robôs não pagos
4. Clique em "Pagar Agora"
5. Modal deve abrir com aba PIX ativa
6. Aguarde geração do QR Code (2-3 segundos)
7. Verifique que o QR Code é exibido
8. Clique em "Copiar" e verifique que o código foi copiado
9. **Para simular pagamento:**
   - Em produção: Use app do banco para escanear QR Code
   - Em teste: Use carteira de teste do Mercado Pago

**Resultado Esperado:**
- ✅ Modal abre corretamente
- ✅ QR Code é gerado e exibido
- ✅ Código copia-e-cola funciona
- ✅ Após pagamento, sistema detecta automaticamente (polling a cada 3s)
- ✅ Membros/robôs são marcados como PAGO
- ✅ Modal fecha automaticamente
- ✅ Toast de sucesso aparece

### 2. Teste de Pagamento com Cartão de Crédito ✅

**Passos:**
1. Faça login como líder de equipe
2. Selecione itens para pagar
3. Clique em "Pagar Agora"
4. Clique na aba "Cartão de Crédito"
5. Aguarde o formulário carregar (Card Payment Brick)
6. Preencha com **cartão de teste aprovado:**
   - **Número:** `5031 4332 1540 6351`
   - **Nome:** `APRO`
   - **Validade:** `11/25`
   - **CVV:** `123`
7. Clique no botão de submeter do formulário

**Resultado Esperado:**
- ✅ Formulário carrega com tema dark
- ✅ Validação de campos funciona
- ✅ Pagamento é aprovado instantaneamente
- ✅ Toast de sucesso aparece
- ✅ Membros/robôs são marcados como PAGO
- ✅ Modal fecha
- ✅ Lista de pagamentos é atualizada

### 3. Teste de Cartão Recusado ❌

**Passos:**
1. Repita teste anterior, mas use:
   - **Nome:** `OTHE` (ao invés de APRO)

**Resultado Esperado:**
- ❌ Pagamento é recusado
- ❌ Mensagem de erro aparece
- ❌ Membros/robôs permanecem PENDENTES
- ✅ Modal permanece aberto para tentar novamente

### 4. Teste de Limite de Inscritos

**Passos:**
1. Verificar contagem atual: `GET /payments/count`
2. Tentar inscrever mais membros do que o limite permite
3. Clicar em "Pagar Agora"

**Resultado Esperado:**
- ❌ Backend retorna erro 400
- ❌ Toast com mensagem "Limite de inscritos atingido!"
- ✅ Indica quantas vagas restam

### 5. Teste de Validação de Equipe

**Passos:**
1. Tentar enviar payload manualmente com membros de outra equipe
2. Usar Postman ou curl:
   ```bash
   curl -X POST http://localhost:3000/payments/process \
     -H "Authorization: Bearer SEU_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "teamId": "equipe-A",
       "memberIds": ["membro-da-equipe-B"],
       "payment_method_id": "pix"
     }'
   ```

**Resultado Esperado:**
- ❌ Backend retorna erro 400
- ❌ Mensagem "Alguns membros não pertencem a esta equipe."

### 6. Teste de Webhook

**Passos:**
1. Configurar ngrok ou similar para expor backend
2. Atualizar `BACKEND_URL` no .env
3. Fazer pagamento real
4. Verificar logs do backend
5. Consultar webhook logs: `GET /webhook/mercadopago/logs`

**Resultado Esperado:**
- ✅ Webhook recebe notificação do MP
- ✅ Log é salvo em `webhook_logs`
- ✅ Pagamento é processado
- ✅ Membros/robôs são marcados como pagos
- ✅ `pending_payments` é atualizado para "completed"

### 7. Teste de Polling PIX

**Passos:**
1. Fazer pagamento PIX
2. Deixar modal aberto
3. Pagar via app do banco
4. Aguardar até 3 segundos

**Resultado Esperado:**
- ✅ Sistema detecta pagamento sem precisar recarregar
- ✅ Toast de confirmação aparece
- ✅ Modal fecha automaticamente
- ✅ UI atualiza

### 8. Teste de Timeout de Polling

**Passos:**
1. Fazer pagamento PIX
2. **NÃO** pagar
3. Deixar modal aberto por 5 minutos

**Resultado Esperado:**
- ⏱️ Após 100 tentativas (5 minutos), polling para
- ⚠️ Toast aparece: "Tempo de espera excedido..."
- ✅ Modal permanece aberto
- ✅ Usuário pode recarregar página para verificar

## Testes de UI/UX

### Modal
- ✅ Modal abre suavemente com animação
- ✅ Backdrop escurece a tela
- ✅ Botão X fecha o modal
- ✅ Total é exibido corretamente
- ✅ Tabs mudam corretamente
- ✅ Modal é responsivo (mobile/desktop)

### Tema Dark
- ✅ Formulário do MP usa tema dark
- ✅ Cores consistentes com o resto do site
- ✅ Contraste adequado para leitura

### Feedback Visual
- ✅ Loading spinner aparece durante processamento
- ✅ Toasts aparecem com cores corretas (verde/vermelho/amarelo)
- ✅ Botão "Copiar" dá feedback visual

## Testes de Segurança

### 1. Content Security Policy
- ✅ SDK do MP carrega corretamente
- ✅ Nenhum erro de CSP no console
- ✅ Apenas domínios MP são permitidos

### 2. Autenticação
- ❌ Tentar acessar `/payments/process` sem token
  - Resultado: 401 Unauthorized
- ❌ Tentar pagar como membro não-líder
  - Resultado: 403 Forbidden

### 3. Validação de Dados
- ❌ Enviar `transaction_amount` negativo
  - Resultado: 400 Bad Request
- ❌ Enviar cartão sem token
  - Resultado: 400 Bad Request
- ❌ Enviar PIX com memberIds vazio
  - Resultado: 400 Bad Request

## Checklist Completo

### Backend
- [ ] Rota `/payments/config` retorna public key
- [ ] Rota `/payments/process` cria pagamento PIX
- [ ] Rota `/payments/process` cria pagamento com cartão
- [ ] Webhook recebe e processa notificações
- [ ] Membros são marcados como pagos
- [ ] Robôs são marcados como pagos
- [ ] `pending_payments` é atualizado
- [ ] Validações de limite funcionam
- [ ] Validações de equipe funcionam

### Frontend
- [ ] SDK do MP carrega
- [ ] Modal abre ao clicar "Pagar Agora"
- [ ] Aba PIX funciona
- [ ] QR Code é gerado
- [ ] Código copia-e-cola funciona
- [ ] Botão "Copiar" funciona
- [ ] Aba Cartão funciona
- [ ] Card Payment Brick carrega
- [ ] Formulário valida campos
- [ ] Pagamento é processado
- [ ] Polling detecta confirmação
- [ ] UI atualiza após pagamento
- [ ] Toasts aparecem corretamente
- [ ] Modal fecha após sucesso
- [ ] Tema dark está consistente

### Integração
- [ ] PIX end-to-end funciona
- [ ] Cartão end-to-end funciona
- [ ] Webhook confirma pagamentos
- [ ] Dados persistem no banco
- [ ] Não há race conditions
- [ ] Não há vazamento de memória (polling limpa)

## Ferramentas Úteis

### Cartões de Teste Mercado Pago

| Cartão | Número | Nome | Resultado |
|--------|--------|------|-----------|
| Mastercard | 5031 4332 1540 6351 | APRO | ✅ Aprovado |
| Visa | 4509 9535 6623 3704 | APRO | ✅ Aprovado |
| Mastercard | 5031 4332 1540 6351 | OTHE | ❌ Recusado |

**CVV:** Qualquer (ex: 123)
**Validade:** Qualquer data futura (ex: 11/25)

### Endpoints para Testes Manuais

```bash
# Obter public key
curl http://localhost:3000/payments/config

# Verificar contagem de inscritos
curl http://localhost:3000/payments/count

# Criar pagamento PIX (precisa de token)
curl -X POST http://localhost:3000/payments/process \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "uuid",
    "memberIds": ["uuid"],
    "robotIds": [],
    "payment_method_id": "pix",
    "payer": {"email": "test@test.com", "name": "Test"}
  }'

# Consultar logs de webhook
curl http://localhost:3000/webhook/mercadopago/logs \
  -H "Authorization: Bearer TOKEN"
```

## Troubleshooting

### Modal não abre
- ✅ Verificar console do navegador
- ✅ Verificar se `payment.js` foi carregado
- ✅ Verificar se função `openPaymentModal` existe

### QR Code não aparece
- ✅ Verificar resposta do backend no Network tab
- ✅ Verificar se `pix.qr_code_base64` existe
- ✅ Verificar logs do backend

### Card Payment Brick não carrega
- ✅ Verificar CSP no console
- ✅ Verificar se SDK do MP foi carregado
- ✅ Verificar public key está correta
- ✅ Verificar Network tab para chamadas bloqueadas

### Webhook não recebe notificações
- ✅ Verificar `BACKEND_URL` no .env
- ✅ Verificar se backend está acessível externamente
- ✅ Usar ngrok para expor localmente
- ✅ Verificar logs em `/webhook/mercadopago/logs`

### Polling não detecta pagamento
- ✅ Verificar se interval está rodando (console.log)
- ✅ Verificar se webhook foi chamado
- ✅ Verificar se membros foram marcados como pagos no banco
- ✅ Aumentar timeout do polling se necessário

## Logs Úteis

### Backend
```javascript
// Ver quando pagamento é criado
console.log('[Payment Process] Processando pagamento:', { ... });

// Ver quando webhook recebe notificação
console.log('[Webhook MP] Pagamento encontrado:', { ... });

// Ver quando membros são marcados como pagos
console.log('[Webhook MP] ${count} membros marcados como pagos');
```

### Frontend
```javascript
// Ver quando MP SDK é inicializado
console.log('[Payment] Mercado Pago SDK initialized');

// Ver quando PIX é processado
console.log('[Payment] Processing PIX payment');

// Ver quando cartão é processado
console.log('[Payment] Processing card payment');
```

## Conclusão

Após completar todos os testes, o sistema estará pronto para produção! 🚀

Para qualquer dúvida, consulte:
- `PAYMENT_MIGRATION.md` - Documentação técnica completa
- Documentação oficial do Mercado Pago
- Logs do backend e frontend
