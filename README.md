# Arquitectura de Data Vault (Dentro de la misma BD que dim/fact)
CREATE TABLE hub_conectividad (
  id_origen     INT         NOT NULL,
  load_dts      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_source VARCHAR(50) NOT NULL DEFAULT 'CSV_CONECTIVIDAD',
  PRIMARY KEY (id_origen)
);
CREATE TABLE hub_dispositivo_uso (
  nombre_dispositivo VARCHAR(50) NOT NULL,
  load_dts      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_source VARCHAR(50) NOT NULL DEFAULT 'CSV_CONECTIVIDAD',
  PRIMARY KEY (nombre_dispositivo)
);
CREATE TABLE hub_proposito_uso (
  proposito     VARCHAR(150) NOT NULL,
  load_dts      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_source VARCHAR(50) NOT NULL DEFAULT 'CSV_CONECTIVIDAD',
  PRIMARY KEY (proposito)
);

-- ---------------- LINKS (business keys = PK) ----------------
CREATE TABLE link_conectividad (
  id_origen        INT          NOT NULL,
  rango_etario_bk  VARCHAR(50)  NOT NULL,
  genero_bk        VARCHAR(50)  NOT NULL,
  tipo_conexion_bk VARCHAR(50)  NOT NULL,
  fecha_carga      DATE         NOT NULL,
  load_dts      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_source VARCHAR(50) NOT NULL DEFAULT 'CSV_CONECTIVIDAD',
  PRIMARY KEY (id_origen)
);
CREATE TABLE link_conectividad_dispositivo (
  id_origen          INT         NOT NULL,
  nombre_dispositivo VARCHAR(50) NOT NULL,
  load_dts      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_source VARCHAR(50) NOT NULL DEFAULT 'CSV_CONECTIVIDAD',
  PRIMARY KEY (id_origen, nombre_dispositivo)
);
CREATE TABLE link_conectividad_proposito (
  id_origen INT          NOT NULL,
  proposito VARCHAR(150) NOT NULL,
  load_dts      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_source VARCHAR(50) NOT NULL DEFAULT 'CSV_CONECTIVIDAD',
  PRIMARY KEY (id_origen, proposito)
);

-- ---------------- SATELLITE ----------------
CREATE TABLE sat_conectividad_medidas (
  id_origen          INT          NOT NULL,
  velocidad_subida   DECIMAL(6,2) NOT NULL,
  velocidad_bajada   DECIMAL(6,2) NOT NULL,
  velocidad_promedio DECIMAL(6,2) NOT NULL,
  horas_uso_diario   DECIMAL(3,1) NOT NULL,
  tiene_acceso       BOOLEAN      NOT NULL,
  load_dts      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_source VARCHAR(50) NOT NULL DEFAULT 'CSV_CONECTIVIDAD',
  PRIMARY KEY (id_origen, load_dts)
);

# Arquitectura de dim/fact esquema estrella (misma BD que data vault)
CREATE DATABASE monitor_conectividad_dwh;
USE monitor_conectividad_dwh;

CREATE TABLE dim_rango_etario(
rango_etario_key INT PRIMARY KEY AUTO_INCREMENT,
rango VARCHAR(50) NOT NULL,
descripcion VARCHAR(50)
);

CREATE TABLE dim_genero(
genero_key INT PRIMARY KEY AUTO_INCREMENT,
genero VARCHAR(50) NOT NULL
);

CREATE TABLE dim_tipo_conexion(
tipo_conexion_key INT PRIMARY KEY AUTO_INCREMENT,
tipo_conexion VARCHAR(50) NOT NULL
);

CREATE TABLE dim_proposito_uso(
proposito_uso_key INT PRIMARY KEY AUTO_INCREMENT,
proposito VARCHAR(150) NOT NULL
);	

CREATE TABLE dim_dispositivo_uso(
dispositivo_uso_key INT PRIMARY KEY AUTO_INCREMENT,
dispositivo VARCHAR(50) NOT NULL
);

CREATE TABLE dim_fecha_carga(
fecha_carga_key INT PRIMARY KEY AUTO_INCREMENT,
fecha DATE NOT NULL,
dia INT,
mes INT,
nombre_mes VARCHAR(20),
anio INT
);

CREATE TABLE fact_conectividad(
conectividad_key INT PRIMARY KEY AUTO_INCREMENT,
id_origen INT NOT NULL UNIQUE, -- Comprobar si no da problemas el unique
FK_rango_etario INT NOT NULL,
FK_tipo_conexion INT NOT NULL,
FK_genero INT NOT NULL,
FK_fecha_carga INT NOT NULL,
velocidad_subida DECIMAL(6,2) NOT NULL,
velocidad_bajada DECIMAL(6,2) NOT NULL,
velocidad_promedio DECIMAL(6,2) NOT NULL,
horas_uso_diario DECIMAL(3,1) NOT NULL,
tiene_acceso BOOLEAN NOT NULL, 
FOREIGN KEY (FK_rango_etario) REFERENCES dim_rango_etario(rango_etario_key),
FOREIGN KEY (FK_tipo_conexion) REFERENCES dim_tipo_conexion(tipo_conexion_key),
FOREIGN KEY (FK_genero) REFERENCES dim_genero(genero_key),
FOREIGN KEY (FK_fecha_carga) REFERENCES dim_fecha_carga(fecha_carga_key)
);

CREATE TABLE puente_conectividad_dispositivo(
FK_conectividad INT NOT NULL,
FK_dispositivo_uso INT NOT NULL,
PRIMARY KEY (FK_conectividad, FK_dispositivo_uso),
FOREIGN KEY (FK_conectividad) REFERENCES fact_conectividad(conectividad_key),
FOREIGN KEY (FK_dispositivo_uso) REFERENCES dim_dispositivo_uso(dispositivo_uso_key)
);

CREATE TABLE puente_conectividad_proposito(
FK_conectividad INT NOT NULL,
FK_proposito INT NOT NULL,
PRIMARY KEY (FK_conectividad, FK_proposito),
FOREIGN KEY (FK_conectividad) REFERENCES fact_conectividad(conectividad_key),
FOREIGN KEY (FK_proposito) REFERENCES dim_proposito_uso(proposito_uso_key)
);

CREATE TABLE log_etl(
log_etl_key INT PRIMARY KEY AUTO_INCREMENT,
proceso VARCHAR(100),
tabla_afectada VARCHAR(100),
fecha_inicio DATETIME,
fecha_fin DATETIME,
registros_insertados INT,
registros_actualizados INT,
registros_error INT,
estado VARCHAR(50),
mensaje_error TEXT
);

-- Inserciones Predefinidas como referencias
insert into dim_rango_etario(rango,descripcion) values("Adolescente","Rango entre 13-17 años");
insert into dim_rango_etario(rango,descripcion) values("Joven Adulto","Rango entre 18-24 años");
insert into dim_rango_etario(rango,descripcion) values("Adulto Joven","Rango entre 25-34 años");
insert into dim_rango_etario(rango,descripcion) values("Adulto Medio","Rango entre 35-54 años");
insert into dim_rango_etario(rango,descripcion) values("Adulto Mayor","Rango entre 55-64 años");
insert into dim_rango_etario(rango,descripcion) values("Persona Mayor","Rango entre 65+ años");

insert into dim_genero(genero) values("masculino");
insert into dim_genero(genero) values("femenino");
insert into dim_genero(genero) values("otro");

insert into dim_tipo_conexion(tipo_conexion) values("internet fibra optica");
insert into dim_tipo_conexion(tipo_conexion) values("internet fijo");
insert into dim_tipo_conexion(tipo_conexion) values("internet movil 4g");
insert into dim_tipo_conexion(tipo_conexion) values("internet movil 5g");
insert into dim_tipo_conexion(tipo_conexion) values("sin internet");