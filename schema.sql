-- ============================================================================
--  Data Warehouse - Monitor de Conectividad Digital
--  Modelo en esquema estrella (Star Schema): 1 tabla de hechos + 4 dimensiones
--  + tabla de auditoría log_etl (metadatos DMBOK / SLA de latencia y error).
--  Compatible con el pipeline ETL de Pentaho descrito en el informe.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS dwh_conectividad
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dwh_conectividad;

-- ---------------------------------------------------------------------------
-- Dimensiones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS DIM_RANGO_ETARIO (
  id_rango_etario INT AUTO_INCREMENT PRIMARY KEY,
  rango           VARCHAR(20) NOT NULL UNIQUE   -- 14-24 / 25-40 / 41-60 / 60+
);

CREATE TABLE IF NOT EXISTS DIM_TIPO_CONEXION (
  id_tipo_conexion INT AUTO_INCREMENT PRIMARY KEY,
  tipo_conexion    VARCHAR(60) NOT NULL UNIQUE, -- Fibra óptica, Móvil 4G, ...
  categoria        VARCHAR(40)                  -- Fija / Móvil / Sin acceso
);

CREATE TABLE IF NOT EXISTS DIM_GENERO (
  id_genero INT AUTO_INCREMENT PRIMARY KEY,
  genero    VARCHAR(20) NOT NULL UNIQUE         -- Masculino / Femenino
);

CREATE TABLE IF NOT EXISTS DIM_PROPOSITO_USO (
  id_proposito INT AUTO_INCREMENT PRIMARY KEY,
  proposito    VARCHAR(60) NOT NULL UNIQUE      -- Estudio / Trabajo / Ocio ...
);

-- ---------------------------------------------------------------------------
-- Tabla de hechos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS FACT_CONECTIVIDAD (
  id_medicion           INT AUTO_INCREMENT PRIMARY KEY,
  id_rango_etario       INT NOT NULL,
  id_tipo_conexion      INT NOT NULL,
  id_genero             INT NULL,
  id_proposito          INT NULL,
  velocidad_bajada      DECIMAL(7,2) NULL,       -- Mbps
  velocidad_subida      DECIMAL(7,2) NULL,       -- Mbps
  horas_uso             DECIMAL(5,2) NULL,       -- horas/día
  tiene_acceso          TINYINT NOT NULL DEFAULT 1,  -- 0 o 1
  cantidad_dispositivos INT NULL,
  fecha_carga           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fact_rango     FOREIGN KEY (id_rango_etario)  REFERENCES DIM_RANGO_ETARIO(id_rango_etario),
  CONSTRAINT fk_fact_conexion  FOREIGN KEY (id_tipo_conexion) REFERENCES DIM_TIPO_CONEXION(id_tipo_conexion),
  CONSTRAINT fk_fact_genero    FOREIGN KEY (id_genero)        REFERENCES DIM_GENERO(id_genero),
  CONSTRAINT fk_fact_proposito FOREIGN KEY (id_proposito)     REFERENCES DIM_PROPOSITO_USO(id_proposito),
  CONSTRAINT chk_acceso CHECK (tiene_acceso IN (0,1))
);

-- ---------------------------------------------------------------------------
-- Auditoría del ETL (alimenta los KPI de SLA: latencia, tasa de error,
-- histórico de completitud y freshness).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS log_etl (
  id_log               INT AUTO_INCREMENT PRIMARY KEY,
  fecha                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registros_leidos     INT NOT NULL DEFAULT 0,
  registros_cargados   INT NOT NULL DEFAULT 0,
  registros_rechazados INT NOT NULL DEFAULT 0,
  duracion_segundos    DECIMAL(7,2) NOT NULL DEFAULT 0,
  completitud_pct      DECIMAL(5,2) NULL,        -- % completitud del ciclo
  estado               VARCHAR(20) NOT NULL DEFAULT 'OK'  -- OK / ERROR
);
