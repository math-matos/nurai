-- Schema do Nurai (Oracle 19c+ / 23ai). Idempotente: cada bloco ignora "objeto já existe".
-- Blocos separados por uma linha contendo só "/" (formato SQL*Plus), lidos por server/db/schema.ts.
-- paciente_id fixo em 'helena' no MVP; as chaves já são por paciente para o multi-tenant.
-- "ordem" (identity) preserva a ordem de inserção que o repositório em memória expõe.

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE pacientes (
      id         VARCHAR2(40)  PRIMARY KEY,
      nome       VARCHAR2(200) NOT NULL,
      criado_em  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE eventos (
      paciente_id   VARCHAR2(40) DEFAULT 'helena' NOT NULL REFERENCES pacientes (id),
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
      paciente_id VARCHAR2(40) DEFAULT 'helena' NOT NULL REFERENCES pacientes (id),
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

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE acessos (
      id          VARCHAR2(64) PRIMARY KEY,
      paciente_id VARCHAR2(40) DEFAULT 'helena' NOT NULL REFERENCES pacientes (id),
      ordem       NUMBER GENERATED ALWAYS AS IDENTITY,
      quando      TIMESTAMP WITH TIME ZONE NOT NULL,
      quem        VARCHAR2(200),
      papel       VARCHAR2(200),
      acao        VARCHAR2(400),
      itens       VARCHAR2(1000)
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE 'CREATE INDEX acessos_paciente_quando_ix ON acessos (paciente_id, quando)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-955, -1408) THEN RAISE; END IF;
END;
/

-- Trilha de auditoria: linhas nunca são alteradas (DELETE só no reinício da demonstração).
CREATE OR REPLACE TRIGGER acessos_append_only
  BEFORE UPDATE ON acessos
BEGIN
  RAISE_APPLICATION_ERROR(-20001, 'acessos é append-only');
END;
/

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE passos (
      paciente_id VARCHAR2(40) DEFAULT 'helena' NOT NULL REFERENCES pacientes (id),
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
      paciente_id VARCHAR2(40) DEFAULT 'helena' NOT NULL REFERENCES pacientes (id),
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

BEGIN
  EXECUTE IMMEDIATE q'[
    CREATE TABLE compartilhamentos (
      codigo      VARCHAR2(6) PRIMARY KEY,
      paciente_id VARCHAR2(40) DEFAULT 'helena' NOT NULL REFERENCES pacientes (id),
      ordem       NUMBER GENERATED ALWAYS AS IDENTITY,
      criado_em   TIMESTAMP WITH TIME ZONE NOT NULL,
      para        VARCHAR2(400) NOT NULL,
      expira_em   TIMESTAMP WITH TIME ZONE NOT NULL
    )]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
END;
/
