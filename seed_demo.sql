-- ============================================================================
--  Datos de ejemplo para el DWH (catálogos + ~64 mediciones + logs ETL).
--  Úsalo para probar el dashboard "en vivo" sin ejecutar el ETL real.
--    mysql -u root -p dwh_conectividad < seed_demo.sql
--  Reemplázalo por la carga real de Pentaho cuando esté disponible.
-- ============================================================================
USE dwh_conectividad;

-- Catálogos -------------------------------------------------------------------
INSERT IGNORE INTO DIM_RANGO_ETARIO (rango) VALUES ('14-24'),('25-40'),('41-60'),('60+');

INSERT IGNORE INTO DIM_TIPO_CONEXION (tipo_conexion, categoria) VALUES
  ('Fibra óptica','Fija'),('Banda ancha hogar','Fija'),
  ('Móvil 4G','Móvil'),('Móvil 5G','Móvil'),('Sin acceso','Sin acceso');

INSERT IGNORE INTO DIM_GENERO (genero) VALUES ('Masculino'),('Femenino');

INSERT IGNORE INTO DIM_PROPOSITO_USO (proposito) VALUES
  ('Estudio'),('Trabajo'),('Ocio'),('Comunicación'),('Trámites');

-- Mediciones ------------------------------------------------------------------
-- Velocidades coherentes con el relato: los rangos mayores navegan más lento.
INSERT INTO FACT_CONECTIVIDAD
  (id_rango_etario, id_tipo_conexion, id_genero, id_proposito,
   velocidad_bajada, velocidad_subida, horas_uso, tiene_acceso, cantidad_dispositivos)
SELECT re.id_rango_etario, tc.id_tipo_conexion, g.id_genero, p.id_proposito,
       d.vb, d.vs, d.hu, d.acc, d.disp
FROM (
  -- 14-24 (rápidos)
  SELECT '14-24' rango,'Fibra óptica' con,'Masculino' gen,'Estudio' pro,135.0 vb,42.0 vs,7.5 hu,1 acc,4 disp UNION ALL
  SELECT '14-24','Fibra óptica','Femenino','Ocio',128.4,40.1,8.1,1,3 UNION ALL
  SELECT '14-24','Móvil 5G','Masculino','Ocio',118.0,30.5,6.9,1,2 UNION ALL
  SELECT '14-24','Móvil 5G','Femenino','Comunicación',112.3,28.7,7.8,1,2 UNION ALL
  SELECT '14-24','Banda ancha hogar','Masculino','Estudio',98.6,22.0,6.4,1,3 UNION ALL
  SELECT '14-24','Fibra óptica','Femenino','Estudio',141.2,45.3,8.6,1,4 UNION ALL
  SELECT '14-24','Móvil 4G','Masculino','Ocio',86.1,18.2,7.1,1,2 UNION ALL
  SELECT '14-24','Fibra óptica','Femenino','Trabajo',132.0,41.0,6.7,1,3 UNION ALL
  SELECT '14-24','Móvil 5G','Masculino','Estudio',120.5,31.2,7.9,1,2 UNION ALL
  SELECT '14-24','Banda ancha hogar','Femenino','Comunicación',101.4,24.6,8.3,1,3 UNION ALL
  SELECT '14-24','Fibra óptica','Masculino','Ocio',137.8,43.9,7.2,1,4 UNION ALL
  SELECT '14-24','Móvil 4G','Femenino','Comunicación',79.3,16.5,6.8,1,2 UNION ALL
  SELECT '14-24','Fibra óptica','Masculino','Estudio',144.6,46.0,8.9,1,3 UNION ALL
  SELECT '14-24','Móvil 5G','Femenino','Ocio',115.7,29.8,7.4,1,2 UNION ALL
  SELECT '14-24','Banda ancha hogar','Masculino','Trabajo',95.2,21.3,5.9,1,3 UNION ALL
  SELECT '14-24','Fibra óptica','Femenino','Estudio',129.9,41.7,8.0,1,4 UNION ALL
  -- 25-40 (rápidos, algo menos)
  SELECT '25-40','Fibra óptica','Masculino','Trabajo',122.0,38.0,6.2,1,4 UNION ALL
  SELECT '25-40','Banda ancha hogar','Femenino','Trabajo',104.5,25.1,5.6,1,3 UNION ALL
  SELECT '25-40','Móvil 5G','Masculino','Trabajo',110.2,27.4,5.1,1,2 UNION ALL
  SELECT '25-40','Fibra óptica','Femenino','Trámites',118.7,36.2,6.0,1,3 UNION ALL
  SELECT '25-40','Móvil 4G','Masculino','Comunicación',83.4,17.9,6.5,1,2 UNION ALL
  SELECT '25-40','Fibra óptica','Femenino','Trabajo',126.3,39.5,5.8,1,4 UNION ALL
  SELECT '25-40','Banda ancha hogar','Masculino','Ocio',99.8,23.2,6.7,1,3 UNION ALL
  SELECT '25-40','Móvil 5G','Femenino','Trabajo',107.1,26.0,5.3,1,2 UNION ALL
  SELECT '25-40','Fibra óptica','Masculino','Trámites',120.9,37.6,6.1,1,3 UNION ALL
  SELECT '25-40','Móvil 4G','Femenino','Comunicación',80.6,16.8,6.9,1,2 UNION ALL
  SELECT '25-40','Banda ancha hogar','Masculino','Trabajo',102.7,24.4,5.5,1,3 UNION ALL
  SELECT '25-40','Fibra óptica','Femenino','Trabajo',124.1,38.8,6.3,1,4 UNION ALL
  SELECT '25-40','Móvil 5G','Masculino','Ocio',109.0,26.7,5.9,1,2 UNION ALL
  SELECT '25-40','Banda ancha hogar','Femenino','Trámites',97.5,22.6,6.6,1,3 UNION ALL
  SELECT '25-40','Fibra óptica','Masculino','Trabajo',128.8,40.3,5.7,1,4 UNION ALL
  SELECT '25-40','Móvil 4G','Femenino','Ocio',84.2,18.0,6.4,1,2 UNION ALL
  -- 41-60 (intermedios)
  SELECT '41-60','Banda ancha hogar','Masculino','Trabajo',82.3,18.4,4.5,1,2 UNION ALL
  SELECT '41-60','Móvil 4G','Femenino','Comunicación',64.8,12.1,4.1,1,2 UNION ALL
  SELECT '41-60','Fibra óptica','Masculino','Trabajo',95.6,22.0,4.8,1,3 UNION ALL
  SELECT '41-60','Banda ancha hogar','Femenino','Trámites',78.9,16.7,3.9,1,2 UNION ALL
  SELECT '41-60','Móvil 4G','Masculino','Ocio',61.2,11.3,4.4,1,1 UNION ALL
  SELECT '41-60','Fibra óptica','Femenino','Trabajo',90.1,20.5,4.6,1,3 UNION ALL
  SELECT '41-60','Banda ancha hogar','Masculino','Comunicación',75.4,15.9,4.0,1,2 UNION ALL
  SELECT '41-60','Móvil 4G','Femenino','Trámites',58.7,10.8,3.7,1,1 UNION ALL
  SELECT '41-60','Banda ancha hogar','Masculino','Trabajo',84.0,19.0,4.3,1,2 UNION ALL
  SELECT '41-60','Fibra óptica','Femenino','Ocio',92.7,21.2,4.9,1,3 UNION ALL
  SELECT '41-60','Móvil 4G','Masculino','Comunicación',62.5,11.7,4.2,1,1 UNION ALL
  SELECT '41-60','Banda ancha hogar','Femenino','Trabajo',77.8,16.3,3.8,1,2 UNION ALL
  SELECT '41-60','Fibra óptica','Masculino','Trabajo',96.9,22.4,4.7,1,3 UNION ALL
  SELECT '41-60','Móvil 4G','Femenino','Ocio',60.3,11.0,4.0,1,1 UNION ALL
  SELECT '41-60','Banda ancha hogar','Masculino','Trámites',79.6,17.1,3.6,1,2 UNION ALL
  SELECT '41-60','Móvil 4G','Femenino','Comunicación',57.4,10.5,3.9,1,1 UNION ALL
  -- 60+ (brecha severa + sin acceso)
  SELECT '60+','Móvil 4G','Masculino','Comunicación',48.2,8.1,2.9,1,1 UNION ALL
  SELECT '60+','Banda ancha hogar','Femenino','Comunicación',58.6,12.0,3.1,1,2 UNION ALL
  SELECT '60+','Móvil 4G','Masculino','Ocio',42.1,7.2,2.4,1,1 UNION ALL
  SELECT '60+','Sin acceso','Femenino','Comunicación',NULL,NULL,0.5,0,1 UNION ALL
  SELECT '60+','Móvil 4G','Femenino','Trámites',45.7,7.8,2.7,1,1 UNION ALL
  SELECT '60+','Banda ancha hogar','Masculino','Comunicación',55.3,10.9,3.0,1,2 UNION ALL
  SELECT '60+','Móvil 4G','Femenino','Comunicación',40.8,6.9,2.2,1,1 UNION ALL
  SELECT '60+','Sin acceso','Masculino','Comunicación',NULL,NULL,0.3,0,1 UNION ALL
  SELECT '60+','Móvil 4G','Masculino','Ocio',47.0,7.6,2.6,1,1 UNION ALL
  SELECT '60+','Banda ancha hogar','Femenino','Trámites',52.9,9.7,2.8,1,2 UNION ALL
  SELECT '60+','Móvil 4G','Femenino','Comunicación',43.5,7.4,2.3,1,1 UNION ALL
  SELECT '60+','Móvil 4G','Masculino','Comunicación',39.6,6.5,2.1,1,1 UNION ALL
  SELECT '60+','Banda ancha hogar','Femenino','Comunicación',57.1,11.5,3.2,1,2 UNION ALL
  SELECT '60+','Móvil 4G','Masculino','Ocio',44.9,7.5,2.5,1,1 UNION ALL
  SELECT '60+','Sin acceso','Femenino','Comunicación',NULL,NULL,0.4,0,1 UNION ALL
  SELECT '60+','Móvil 4G','Femenino','Trámites',46.3,7.9,2.7,1,1
) d
JOIN DIM_RANGO_ETARIO  re ON re.rango = d.rango
JOIN DIM_TIPO_CONEXION tc ON tc.tipo_conexion = d.con
JOIN DIM_GENERO        g  ON g.genero = d.gen
JOIN DIM_PROPOSITO_USO p  ON p.proposito = d.pro;

-- Histórico de ejecuciones del ETL (alimenta /historico y SLA) ---------------
INSERT INTO log_etl (fecha, registros_leidos, registros_cargados, registros_rechazados, duracion_segundos, completitud_pct, estado) VALUES
  (NOW() - INTERVAL 9 DAY, 66, 64, 2, 88,  96.8, 'OK'),
  (NOW() - INTERVAL 8 DAY, 66, 65, 1, 84,  97.2, 'OK'),
  (NOW() - INTERVAL 7 DAY, 67, 66, 1, 79,  97.9, 'OK'),
  (NOW() - INTERVAL 6 DAY, 67, 66, 1, 81,  98.1, 'OK'),
  (NOW() - INTERVAL 5 DAY, 66, 64, 2, 90,  97.5, 'OK'),
  (NOW() - INTERVAL 4 DAY, 66, 65, 1, 76,  98.4, 'OK'),
  (NOW() - INTERVAL 3 DAY, 66, 65, 1, 80,  98.0, 'OK'),
  (NOW() - INTERVAL 2 DAY, 66, 65, 1, 78,  98.3, 'OK'),
  (NOW() - INTERVAL 1 DAY, 65, 64, 1, 75,  98.6, 'OK'),
  (NOW(),                  66, 64, 2, 84,  98.2, 'OK');
