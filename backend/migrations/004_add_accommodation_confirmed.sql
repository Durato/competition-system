-- Migration: Adicionar campo accommodation_confirmed
-- Alojamento só é confirmado após pagamento da inscrição

-- Adiciona coluna accommodation_confirmed
ALTER TABLE users
ADD COLUMN IF NOT EXISTS accommodation_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- Atualiza usuários que já pagaram E pediram alojamento
-- Define accommodation_confirmed = true para membros pagos com alojamento
UPDATE users
SET accommodation_confirmed = TRUE
WHERE needs_accommodation = TRUE
  AND id IN (
    SELECT user_id
    FROM team_members
    WHERE is_paid = TRUE
  );

-- Índice para melhorar performance nas queries de alojamento
CREATE INDEX IF NOT EXISTS idx_users_accommodation_confirmed
ON users(accommodation_confirmed)
WHERE accommodation_confirmed = TRUE;

-- Comentário na coluna
COMMENT ON COLUMN users.accommodation_confirmed IS 'Alojamento confirmado após pagamento (diferente de needs_accommodation que é apenas solicitação)';
