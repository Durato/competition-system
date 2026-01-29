# 🚀 Quick Start - Checkout Bricks

## Para Desenvolvedores - Começar em 5 Minutos

### 1️⃣ Verificar Credenciais (30 segundos)

```bash
# Verifique se o .env tem as credenciais:
cat backend/.env | grep MERCADOPAGO
```

**Deve mostrar:**
```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-5780407957473382-012913-fa4efcd008ce016afae74d96575c98a2-137390542
MERCADOPAGO_PUBLIC_KEY=APP_USR-f8bdb89f-01be-4827-baae-e68d3bd7a9fb
```

✅ **OK?** Continue.
❌ **Não?** Adicione as credenciais ao `.env`

---

### 2️⃣ Iniciar Backend (1 minuto)

```bash
cd backend
npm install  # Se ainda não instalou
npm start
```

**Deve mostrar:**
```
Server running on port 3000
Database connected
```

✅ **Funcionando?** Próximo passo.
❌ **Erro?** Verifique banco de dados está acessível.

---

### 3️⃣ Testar Endpoint de Config (30 segundos)

Abra no navegador ou use curl:

```bash
curl http://localhost:3000/payments/config
```

**Deve retornar:**
```json
{
  "mercadoPagoPublicKey": "APP_USR-f8bdb89f-01be-4827-baae-e68d3bd7a9fb"
}
```

✅ **Retornou?** Ótimo!
❌ **Erro 404?** Verifique se o servidor está rodando.

---

### 4️⃣ Abrir Frontend (30 segundos)

**Opção A: Live Server (recomendado)**
- Instale extensão "Live Server" no VS Code
- Clique direito em `frontend/app.html`
- "Open with Live Server"

**Opção B: Diretamente**
- Abra `frontend/app.html` no navegador
- (Pode ter CORS issues)

---

### 5️⃣ Fazer Login e Testar (2 minutos)

1. **Faça login** como um usuário líder
2. **Selecione sua equipe**
3. **Vá até "Pagamentos Pendentes"**
4. **Selecione 1 membro** (checkbox)
5. **Clique "Pagar Agora"**

**O que deve acontecer:**
- ✅ Modal abre
- ✅ Aba PIX está ativa
- ✅ QR Code aparece (após 2-3s)
- ✅ Código copia-e-cola está preenchido

---

### 6️⃣ Testar Cartão (1 minuto)

1. **Clique na aba "Cartão de Crédito"**
2. **Aguarde formulário carregar**
3. **Preencha:**
   - Número: `5031 4332 1540 6351`
   - Nome: `APRO`
   - Validade: `11/25`
   - CVV: `123`
4. **Clique "Pagar"**

**O que deve acontecer:**
- ✅ Pagamento é aprovado
- ✅ Toast verde "Pagamento aprovado!"
- ✅ Modal fecha
- ✅ Membro aparece como "PAGO"

---

## ✅ Pronto!

Se tudo acima funcionou, **a migração está completa e funcional!**

---

## 🐛 Troubleshooting Rápido

### ❌ Modal não abre
```javascript
// Abra DevTools (F12) → Console
// Deve ver:
[Payment] Mercado Pago SDK initialized
```

**Não vê?**
- Verifique `frontend/payment.js` está carregado
- Verifique CSP não bloqueou SDK
- Olhe erros no console

---

### ❌ QR Code não aparece
```javascript
// DevTools → Network
// Procure: POST /payments/process
// Veja response
```

**Status 500?**
- Verifique logs do backend
- Verifique credenciais do MP

**Status 400?**
- Verifique validações (limite, equipe, etc)

---

### ❌ Formulário de cartão não carrega
```javascript
// DevTools → Console
// Procure erros de CSP
```

**Vê erros?**
- Verifique CSP em `app.html`
- Deve permitir `https://sdk.mercadopago.com`

---

### ❌ Pagamento não confirma
```bash
# Backend logs devem mostrar:
[Webhook MP] Pagamento encontrado: {...}
[Webhook MP] 1 membros marcados como pagos
```

**Não vê?**
- Webhook pode não estar acessível
- Use ngrok para testes locais:
  ```bash
  ngrok http 3000
  # Atualize BACKEND_URL no .env
  ```

---

## 📚 Próximos Passos

Agora que está funcionando:

1. **Leia PAYMENT_MIGRATION.md** - Entenda como funciona
2. **Execute TESTING_GUIDE.md** - Teste todos os cenários
3. **Leia PAYMENT_FLOW.md** - Visualize o fluxo completo
4. **Deploy em staging** - Teste com dados reais
5. **Monitore logs** - Veja como está performando

---

## 🎯 Comandos Úteis

### Backend

```bash
# Iniciar
cd backend && npm start

# Ver logs em tempo real
tail -f backend/logs/*.log  # Se tiver logs em arquivo

# Testar endpoint
curl -X POST http://localhost:3000/payments/process \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"teamId":"uuid","memberIds":["uuid"],"payment_method_id":"pix"}'

# Ver webhook logs
curl http://localhost:3000/webhook/mercadopago/logs \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Frontend

```bash
# Versão dos arquivos (se precisar invalidar cache)
# Altere em app.html:
# <script src="app.js?v=4"></script>  → v=5
# <script src="payment.js?v=4"></script>  → v=5
```

### Database

```sql
-- Ver pagamentos pendentes
SELECT * FROM pending_payments
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;

-- Ver membros pagos
SELECT u.name, tm.is_paid
FROM team_members tm
JOIN users u ON tm.user_id = u.id
WHERE tm.is_paid = true;

-- Ver robôs pagos
SELECT r.name, r.is_paid
FROM robots r
WHERE r.is_paid = true;

-- Ver contagem de inscritos
SELECT COUNT(*) FROM team_members WHERE is_paid = true;
```

---

## 🔍 Verificação de Saúde

Execute esses comandos para verificar se tudo está OK:

```bash
# 1. Backend está rodando?
curl http://localhost:3000/payments/config
# Deve retornar JSON com public key

# 2. Banco está acessível?
curl http://localhost:3000/payments/count
# Deve retornar contagem de inscritos

# 3. Webhook está OK?
curl http://localhost:3000/webhook/mercadopago/health
# Deve retornar: {"status":"ok","service":"Mercado Pago Webhook",...}
```

**Todos funcionaram?** ✅ Sistema saudável!

---

## 📞 Contatos Úteis

- **Documentação Técnica:** `PAYMENT_MIGRATION.md`
- **Guia de Testes:** `TESTING_GUIDE.md`
- **Diagrama de Fluxo:** `PAYMENT_FLOW.md`
- **Mercado Pago Docs:** https://www.mercadopago.com.br/developers
- **Suporte MP:** developers@mercadopago.com

---

## 🎉 Sucesso!

Se chegou até aqui e tudo funcionou, parabéns!

**O sistema está pronto para processar pagamentos sem que os usuários precisem criar conta no Mercado Pago.**

**Próximo passo:** Deploy em produção! 🚀

---

**Última atualização:** 2026-01-29
**Versão:** 4.0.0 (Checkout Bricks)
