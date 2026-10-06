-- Schema do Nurai (Oracle 19c+ / 23ai). Idempotente: cada bloco ignora "objeto já existe".
-- Blocos separados por uma linha contendo só "/" (formato SQL*Plus), lidos por server/db/schema.ts.
-- Blocos com '[]' no corpo usam q'{...}' (q'[...]' fecharia no ']').
-- Multi-tenant: todo dado clínico pertence a um paciente e some com ele (ON DELETE CASCADE).
-- "ordem" (identity) preserva a ordem de inserção que o repositório em memória expõe.
-- O schema anterior (single-patient, DEFAULT 'helena') não é migrado no lugar: server/db/schema.ts
-- detecta e pede "pnpm db:setup --recriar", que derruba e recria todas as tabelas (apaga tudo).

BEGIN
  EXECUTE IMMEDIATE q'{
    CREATE TABLE pacientes (
      id              VARCHAR2(40)  CONSTRAINT pacientes_pk PRIMARY KEY,
      nome            VARCHAR2(200) NOT NULL,
      data_nascimento DATE,
      condicoes       CLOB DEFAULT '[]' NOT NULL CONSTRAINT pacientes_condicoes_json CHECK (condicoes IS JSON),
      alergias        CLOB DEFAULT '[]' NOT NULL CONSTRAINT pacientes_alergias_json CHECK (alergias IS JSON),
      cartao_sus      VARCHAR2(40),
      plano           VARCHAR2(200),
      onboarding      VARCHAR2(10) DEFAULT 'pendente' NOT NULL
                      CONSTRAINT pacientes_onboarding_ck CHECK (onboarding IN ('pendente', 'vazio', 'exemplo')),
      convidado       NUMBER(1) DEFAULT 0 NOT NULL CONSTRAINT pacientes_convidado_ck CHECK (convidado IN (0, 1)),
      criado_em       TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
    )}';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- Modo cuidador (o usuário gerencia o histórico de outra pessoa): colunas acrescentadas depois do
-- lançamento. ALTER aditivo e idempotente (ORA-01430: a coluna já existe), sem tocar nos dados.
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE pacientes ADD (responsavel_nome VARCHAR2(200))';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE pacientes ADD (responsavel_relacao VARCHAR2(40))';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF;
END;
/

-- Quando o responsável declarou ter autorização para tratar os dados do paciente (LGPD). NULL numa conta
-- cuidador anterior à declaração: o app pede a declaração no próximo acesso.
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE pacientes ADD (responsavel_autorizado_em TIMESTAMP WITH TIME ZONE)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF;
END;
/

-- Um usuário por paciente; email guardado em minúsculas.
BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE usuarios (
      id          VARCHAR2(40) CONSTRAINT usuarios_pk PRIMARY KEY,
      paciente_id VARCHAR2(40) NOT NULL
                  CONSTRAINT usuarios_paciente_fk REFERENCES pacientes (id) ON DELETE CASCADE
                  CONSTRAINT usuarios_paciente_uk UNIQUE,
      email       VARCHAR2(254) NOT NULL CONSTRAINT usuarios_email_uk UNIQUE,
      senha_hash  VARCHAR2(400),
      criado_em   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT usuarios_email_minusculo CHECK (email = LOWER(email))
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- Só o sha256 do token do cookie fica no banco.
BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE sessoes (
      token_hash VARCHAR2(64) CONSTRAINT sessoes_pk PRIMARY KEY,
      usuario_id VARCHAR2(40) NOT NULL CONSTRAINT sessoes_usuario_fk REFERENCES usuarios (id) ON DELETE CASCADE,
      expira_em  TIMESTAMP WITH TIME ZONE NOT NULL,
      criado_em  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX sessoes_usuario_ix ON sessoes (usuario_id)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;
END;
/

-- Rate limit: a chave é um sha256 (de IP + email no login, de IP na demo), sem dado pessoal em claro.
BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE tentativas (
      chave  VARCHAR2(64) NOT NULL,
      quando TIMESTAMP WITH TIME ZONE NOT NULL
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX tentativas_chave_quando_ix ON tentativas (chave, quando)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE eventos (
      paciente_id   VARCHAR2(40) NOT NULL CONSTRAINT eventos_paciente_fk REFERENCES pacientes (id) ON DELETE CASCADE,
      id            VARCHAR2(64) NOT NULL,
      ordem         NUMBER GENERATED ALWAYS AS IDENTITY,
      data          DATE NOT NULL,
      tipo          VARCHAR2(20) NOT NULL,
      titulo        VARCHAR2(400) NOT NULL,
      instituicao   VARCHAR2(400) NOT NULL,
      fonte         VARCHAR2(20) NOT NULL,
      especialidade VARCHAR2(200),
      resumo        CLOB,
      sinal         VARCHAR2(20) NOT NULL,
      medidas       CLOB CONSTRAINT eventos_medidas_json CHECK (medidas IS JSON),
      tags          CLOB NOT NULL CONSTRAINT eventos_tags_json CHECK (tags IS JSON),
      origem        VARCHAR2(40) NOT NULL,
      confianca     NUMBER,
      documento     VARCHAR2(400),
      novo          NUMBER(1) CHECK (novo IN (0, 1)),
      CONSTRAINT eventos_pk PRIMARY KEY (paciente_id, id)
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX eventos_paciente_data_ix ON eventos (paciente_id, data)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE consentimentos (
      paciente_id VARCHAR2(40) NOT NULL CONSTRAINT consentimentos_paciente_fk REFERENCES pacientes (id) ON DELETE CASCADE,
      id          VARCHAR2(64) NOT NULL,
      ordem       NUMBER GENERATED ALWAYS AS IDENTITY,
      instituicao VARCHAR2(400) NOT NULL,
      fonte       VARCHAR2(20) NOT NULL,
      escopo      VARCHAR2(400),
      ativo       NUMBER(1) NOT NULL CHECK (ativo IN (0, 1)),
      desde       DATE NOT NULL,
      CONSTRAINT consentimentos_pk PRIMARY KEY (paciente_id, id)
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- O histórico de exemplo copia os mesmos ids de acesso (a1...) para cada paciente.
BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE acessos (
      paciente_id VARCHAR2(40) NOT NULL CONSTRAINT acessos_paciente_fk REFERENCES pacientes (id) ON DELETE CASCADE,
      id          VARCHAR2(64) NOT NULL,
      ordem       NUMBER GENERATED ALWAYS AS IDENTITY,
      quando      TIMESTAMP WITH TIME ZONE NOT NULL,
      quem        VARCHAR2(200),
      papel       VARCHAR2(200),
      acao        VARCHAR2(400),
      itens       VARCHAR2(1000),
      CONSTRAINT acessos_pk PRIMARY KEY (paciente_id, id)
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX acessos_paciente_quando_ix ON acessos (paciente_id, quando)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;
END;
/

-- Trilha de auditoria: linhas nunca são alteradas (DELETE só no reinício ou na exclusão do paciente).
CREATE OR REPLACE TRIGGER acessos_append_only
  BEFORE UPDATE ON acessos
BEGIN
  RAISE_APPLICATION_ERROR(-20001, 'acessos é append-only');
END;
/

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE passos (
      paciente_id VARCHAR2(40) NOT NULL CONSTRAINT passos_paciente_fk REFERENCES pacientes (id) ON DELETE CASCADE,
      id          VARCHAR2(64) NOT NULL,
      ordem       NUMBER GENERATED ALWAYS AS IDENTITY,
      titulo      VARCHAR2(400) NOT NULL,
      porque      CLOB,
      ancoras     CLOB NOT NULL CONSTRAINT passos_ancoras_json CHECK (ancoras IS JSON),
      prazo       VARCHAR2(200),
      prioridade  VARCHAR2(10) NOT NULL,
      feito       NUMBER(1) NOT NULL CHECK (feito IN (0, 1)),
      CONSTRAINT passos_pk PRIMARY KEY (paciente_id, id)
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE fontes (
      paciente_id VARCHAR2(40) NOT NULL CONSTRAINT fontes_paciente_fk REFERENCES pacientes (id) ON DELETE CASCADE,
      id          VARCHAR2(64) NOT NULL,
      ordem       NUMBER GENERATED ALWAYS AS IDENTITY,
      nome        VARCHAR2(200) NOT NULL,
      fonte       VARCHAR2(20) NOT NULL,
      estado      VARCHAR2(20) NOT NULL,
      registros   NUMBER NOT NULL,
      ultima      VARCHAR2(20) NOT NULL,
      CONSTRAINT fontes_pk PRIMARY KEY (paciente_id, id)
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

-- O código é a chave global: quem recebe o acesso digita só ele.
BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE compartilhamentos (
      codigo      VARCHAR2(6) CONSTRAINT compartilhamentos_pk PRIMARY KEY,
      paciente_id VARCHAR2(40) NOT NULL
                  CONSTRAINT compartilhamentos_paciente_fk REFERENCES pacientes (id) ON DELETE CASCADE,
      ordem       NUMBER GENERATED ALWAYS AS IDENTITY,
      criado_em   TIMESTAMP WITH TIME ZONE NOT NULL,
      para        VARCHAR2(400) NOT NULL,
      expira_em   TIMESTAMP WITH TIME ZONE NOT NULL,
      revogado    NUMBER(1) DEFAULT 0 NOT NULL CONSTRAINT compartilhamentos_revogado_ck CHECK (revogado IN (0, 1))
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX compartilhamentos_paciente_ix ON compartilhamentos (paciente_id)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;
END;
/
