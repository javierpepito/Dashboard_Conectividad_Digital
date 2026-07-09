"""Monitor de Conectividad Digital — API REST + Dashboard (Flask).

Sirve el tablero web y expone los 5 endpoints que consume el dashboard. Cada
endpoint ejecuta consultas SQL sobre el Data Warehouse (esquema estrella en
MySQL local, BD `monitor_conectividad_dwh`) y devuelve JSON. Si el DWH no está
disponible, el endpoint responde 503 y el front-end cae automáticamente a sus
datos demo (nunca queda en blanco).

Las consultas usan EXACTAMENTE los nombres del esquema del README:
  fact_conectividad(conectividad_key, id_origen, FK_rango_etario,
      FK_tipo_conexion, FK_genero, FK_fecha_carga, velocidad_subida,
      velocidad_bajada, velocidad_promedio, horas_uso_diario, tiene_acceso)
  dim_rango_etario(rango_etario_key, rango, descripcion)
  dim_tipo_conexion(tipo_conexion_key, tipo_conexion)
  dim_fecha_carga(fecha_carga_key, fecha, dia, mes, nombre_mes, anio)
  puente_conectividad_proposito(FK_conectividad, FK_proposito)
  log_etl(log_etl_key, proceso, tabla_afectada, fecha_inicio, fecha_fin,
      registros_insertados, registros_actualizados, registros_error,
      estado, mensaje_error)
"""
import os

from flask import Flask, jsonify, render_template, send_from_directory

import db

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "K3W$k3!sdi#k29asdk@xw92d2asd@!ad2")

# Umbrales del SLA (sección 3.1 del informe)
UMBRAL_UPTIME = 99.0      # %   (mayor es mejor)
UMBRAL_FRESHNESS = 20     # días (menor es mejor)
UMBRAL_COMPLETITUD = 97.0 # %   (mayor es mejor)
UMBRAL_LATENCIA = 2.0     # min (menor es mejor)
UMBRAL_ERROR = 0.5        # %   (menor es mejor)

# Orden natural de los rangos etarios tal como los siembra el README.
ORDEN_RANGOS = (
    "FIELD(re.rango,'Adolescente','Joven Adulto','Adulto Joven',"
    "'Adulto Medio','Adulto Mayor','Persona Mayor')"
)

# Pentaho escribe UNA fila en log_etl por ejecución completa del ETL y deja
# `registros_actualizados` en NULL, por eso toda la aritmética envuelve las
# columnas en COALESCE(...,0) (si no, `insertados + NULL` daría NULL).

# Una ejecución del ETL se considera "exitosa" (para uptime) si no registró
# errores y su estado no indica fallo. Robusto ante las variantes de Pentaho
# ('EXITOSO', 'OK', 'COMPLETADO', NULL, …).
SQL_ETL_OK = (
    "(COALESCE(registros_error,0) = 0 "
    " AND UPPER(COALESCE(estado,'')) NOT LIKE '%ERROR%' "
    " AND UPPER(COALESCE(estado,'')) NOT LIKE '%FALL%')"
)

# Registros leídos (= insertados + actualizados + error) y cargados sin rechazo.
SQL_ETL_LEIDOS = (
    "(COALESCE(registros_insertados,0) + COALESCE(registros_actualizados,0) "
    " + COALESCE(registros_error,0))"
)
SQL_ETL_CARGADOS = (
    "(COALESCE(registros_insertados,0) + COALESCE(registros_actualizados,0))"
)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
def estado_min(valor, umbral):
    """Semáforo cuando 'más alto es mejor' (uptime, completitud)."""
    if valor >= umbral:
        return "verde"
    if valor >= umbral * 0.95:
        return "amarillo"
    return "rojo"


def estado_max(valor, umbral):
    """Semáforo cuando 'más bajo es mejor' (freshness, latencia, error)."""
    if valor <= umbral:
        return "verde"
    if valor <= umbral * 1.1:
        return "amarillo"
    return "rojo"


def peor_estado(estados):
    """Devuelve el estado más severo del conjunto (rojo > amarillo > verde)."""
    if "rojo" in estados:
        return "rojo"
    if "amarillo" in estados:
        return "amarillo"
    return "verde"


def r(valor, dec=1):
    """Redondea de forma segura, tolerando None."""
    return round(float(valor), dec) if valor is not None else 0.0


def _completitud_campos():
    """Completitud por campo de fact_conectividad (esquema estrella real).

    Como las columnas del hecho son NOT NULL, la 'completitud' aquí mide que
    cada campo tenga un valor *usable*:
      - edad / tipo_conexion : que la FK resuelva a una fila real de su dimensión.
      - velocidades / horas  : valor presente y no negativo.
      - proposito_uso        : que el registro exista en el puente de propósitos
                               (relación N:M que sí puede faltar).
    """
    fila = db.query_one(
        """
        SELECT
            COUNT(*)                                              AS total,
            SUM(re.rango_etario_key   IS NOT NULL)                AS edad,
            SUM(tc.tipo_conexion_key  IS NOT NULL)                AS tipo_conexion,
            SUM(f.velocidad_bajada IS NOT NULL AND f.velocidad_bajada >= 0) AS velocidad_bajada,
            SUM(f.velocidad_subida IS NOT NULL AND f.velocidad_subida >= 0) AS velocidad_subida,
            SUM(f.horas_uso_diario IS NOT NULL AND f.horas_uso_diario >= 0) AS horas_uso,
            SUM(pp.FK_conectividad    IS NOT NULL)                AS proposito_uso
        FROM fact_conectividad f
        LEFT JOIN dim_rango_etario  re ON re.rango_etario_key  = f.FK_rango_etario
        LEFT JOIN dim_tipo_conexion tc ON tc.tipo_conexion_key = f.FK_tipo_conexion
        LEFT JOIN (
            SELECT DISTINCT FK_conectividad FROM puente_conectividad_proposito
        ) pp ON pp.FK_conectividad = f.conectividad_key
        """
    )
    total = fila["total"] or 0
    campos_def = [
        "edad", "tipo_conexion", "velocidad_bajada",
        "velocidad_subida", "horas_uso", "proposito_uso",
    ]
    campos = []
    for nombre in campos_def:
        pct = (float(fila[nombre]) / total * 100) if total else 0.0
        campos.append({
            "campo": nombre,
            "completitud": r(pct),
            "nulos": r(100 - pct),
        })
    global_pct = sum(c["completitud"] for c in campos) / len(campos) if campos else 0.0
    return r(global_pct), campos


# ---------------------------------------------------------------------------
# Rutas de páginas
# ---------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def inicio():
    return render_template("home.html")


@app.route("/dashboard.js")
def dashboard_js():
    """Sirve el JS del tablero, que vive en la raíz del proyecto (fuera de static/)."""
    return send_from_directory(
        app.root_path, "dashboard.js", mimetype="application/javascript"
    )


# ---------------------------------------------------------------------------
# API REST
# ---------------------------------------------------------------------------
@app.route("/kpi_principal")
def kpi_principal():
    """KPI principal (índice de brecha digital) + métricas de dominio.

    Cubre 4 de los KPI del tablero:
      - Índice de brecha digital (AVG con subconsulta)
      - Velocidad por rango etario (AVG + GROUP BY)  -> velocidad_rango
      - % sin acceso a internet   (AVG sobre tiene_acceso)
      - Volumen                   (COUNT(*))
      - Horas de uso por rango    (AVG + GROUP BY)   -> horas_rango
    """
    try:
        vel = db.query_all(
            f"""
            SELECT re.rango AS rango,
                   AVG(f.velocidad_bajada) AS download,
                   AVG(f.velocidad_subida) AS upload
            FROM fact_conectividad f
            JOIN dim_rango_etario re ON re.rango_etario_key = f.FK_rango_etario
            WHERE f.tiene_acceso = 1
            GROUP BY re.rango
            ORDER BY {ORDEN_RANGOS}
            """
        )
        horas = db.query_all(
            f"""
            SELECT re.rango AS rango, AVG(f.horas_uso_diario) AS horas
            FROM fact_conectividad f
            JOIN dim_rango_etario re ON re.rango_etario_key = f.FK_rango_etario
            GROUP BY re.rango
            ORDER BY {ORDEN_RANGOS}
            """
        )
        agg = db.query_one(
            """
            SELECT
                COUNT(*) AS volumen,
                AVG(CASE WHEN tiene_acceso = 1 THEN velocidad_bajada END) AS media,
                AVG(CASE WHEN tiene_acceso = 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_sin_acceso
            FROM fact_conectividad
            """
        )

        media = r(agg["media"])
        velocidad_rango = [
            {"rango": v["rango"], "download": r(v["download"]), "upload": r(v["upload"])}
            for v in vel
        ]
        horas_rango = [{"rango": h["rango"], "horas": r(h["horas"])} for h in horas]

        # Grupo con menor velocidad de bajada = más afectado por la brecha.
        if velocidad_rango:
            peor = min(velocidad_rango, key=lambda x: x["download"])
            grupo, vel_grupo = peor["rango"], peor["download"]
        else:
            grupo, vel_grupo = "—", 0.0

        brecha = ((media - vel_grupo) / media * 100) if media else 0.0
        if brecha >= 40:
            estado = "rojo"
        elif brecha >= 20:
            estado = "amarillo"
        else:
            estado = "verde"

        return jsonify({
            "indice_brecha": r(brecha),
            "estado": estado,
            "grupo_afectado": grupo,
            "media_general_mbps": media,
            "vel_grupo_mbps": vel_grupo,
            "pct_sin_acceso": r(agg["pct_sin_acceso"]),
            "volumen": agg["volumen"] or 0,
            "velocidad_rango": velocidad_rango,
            "horas_rango": horas_rango,
        })
    except Exception as e:  # DWH no disponible -> el front usa datos demo
        return jsonify({"error": str(e)}), 503


@app.route("/distribucion")
def distribucion():
    """Distribución por tipo de conexión (COUNT + GROUP BY)."""
    try:
        filas = db.query_all(
            """
            SELECT tc.tipo_conexion AS tipo, COUNT(*) AS cantidad
            FROM fact_conectividad f
            JOIN dim_tipo_conexion tc ON tc.tipo_conexion_key = f.FK_tipo_conexion
            GROUP BY tc.tipo_conexion
            ORDER BY cantidad DESC
            """
        )
        return jsonify({"tipos": [{"tipo": x["tipo"], "cantidad": x["cantidad"]} for x in filas]})
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@app.route("/completitud")
def completitud():
    """Completitud y nulos por campo del hecho."""
    try:
        global_pct, campos = _completitud_campos()
        return jsonify({"global_pct": global_pct, "campos": campos})
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@app.route("/historico")
def historico():
    """Histórico de completitud de carga de los últimos 10 lotes del ETL.

    log_etl no guarda una completitud precalculada, así que se deriva por
    ejecución: % de registros que se cargaron sin ser rechazados =
    (insertados + actualizados) / leídos * 100. Cada fila de log_etl es una
    ejecución del ETL; se muestran las últimas 10.
    """
    try:
        filas = db.query_all(
            f"""
            SELECT completitud_pct FROM (
                SELECT
                    log_etl_key,
                    ({SQL_ETL_CARGADOS} / NULLIF({SQL_ETL_LEIDOS}, 0)) * 100
                        AS completitud_pct
                FROM log_etl
                WHERE fecha_fin IS NOT NULL
                ORDER BY fecha_fin DESC, log_etl_key DESC
                LIMIT 10
            ) t
            ORDER BY log_etl_key ASC
            """
        )
        n = len(filas)
        ciclos = []
        for i, f in enumerate(filas):
            etiqueta = "ahora" if i == n - 1 else f"c-{n - 1 - i}"
            ciclos.append({"etiqueta": etiqueta, "valor": r(f["completitud_pct"])})
        return jsonify({"umbral": UMBRAL_COMPLETITUD, "ciclos": ciclos})
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@app.route("/sla")
def sla():
    """Estado de las 5 dimensiones del SLA + semáforo global.

    Cómo se calcula cada una a partir de las tablas reales:

    * uptime (%)      : disponibilidad del ETL = % de ejecuciones registradas en
                        log_etl que terminaron sin error.
                        100 * SUM(paso_ok) / COUNT(*).
    * freshness (días): antigüedad del dato más reciente en el hecho
                        = DATEDIFF(hoy, MAX(dim_fecha_carga.fecha)).
    * completitud (%) : promedio de completitud por campo (ver /completitud).
    * latencia (min)  : duración de extremo a extremo del último lote ETL
                        = (MAX(fecha_fin) - MIN(fecha_inicio)) del lote más
                        reciente, en minutos.
    * error (%)       : tasa de error del último lote
                        = 100 * SUM(registros_error) / SUM(leídos).
    """
    try:
        # --- Freshness: días desde el dato más reciente cargado en el hecho ---
        fresh = db.query_one(
            """
            SELECT DATEDIFF(NOW(), MAX(dc.fecha)) AS dias
            FROM fact_conectividad f
            JOIN dim_fecha_carga dc ON dc.fecha_carga_key = f.FK_fecha_carga
            """
        )
        dias = int(fresh["dias"]) if fresh and fresh["dias"] is not None else 0

        # --- Latencia y tasa de error de la ÚLTIMA ejecución del ETL ---
        # Cada fila de log_etl es una corrida completa; se toma la más reciente.
        lote = db.query_one(
            f"""
            SELECT
                TIMESTAMPDIFF(SECOND, fecha_inicio, fecha_fin) AS segundos,
                COALESCE(registros_error,0)  AS errores,
                {SQL_ETL_LEIDOS}             AS leidos
            FROM log_etl
            WHERE fecha_fin IS NOT NULL
            ORDER BY fecha_fin DESC, log_etl_key DESC
            LIMIT 1
            """
        )
        if lote and lote["segundos"] is not None:
            latencia_min = r(float(lote["segundos"]) / 60.0, 1)
            leidos = lote["leidos"] or 0
            tasa_error = r((float(lote["errores"] or 0) / leidos * 100) if leidos else 0.0)
        else:
            latencia_min, tasa_error = 0.0, 0.0

        # --- Uptime: % de ejecuciones del ETL sin error (sobre todo el historial) ---
        up = db.query_one(
            f"""
            SELECT COUNT(*) AS total, SUM({SQL_ETL_OK}) AS ok
            FROM log_etl
            """
        )
        uptime = r((float(up["ok"] or 0) / up["total"] * 100) if up and up["total"] else 100.0)

        # --- Completitud global (promedio por campo) ---
        global_pct, _ = _completitud_campos()

        dims = {
            "uptime": {"valor": uptime, "umbral": UMBRAL_UPTIME, "unidad": "%",
                       "dir": "min", "estado": estado_min(uptime, UMBRAL_UPTIME)},
            "freshness": {"valor": dias, "umbral": UMBRAL_FRESHNESS, "unidad": " días",
                          "dir": "max", "estado": estado_max(dias, UMBRAL_FRESHNESS)},
            "completitud": {"valor": global_pct, "umbral": UMBRAL_COMPLETITUD, "unidad": "%",
                            "dir": "min", "estado": estado_min(global_pct, UMBRAL_COMPLETITUD)},
            "latencia": {"valor": latencia_min, "umbral": UMBRAL_LATENCIA, "unidad": " min",
                         "dir": "max", "estado": estado_max(latencia_min, UMBRAL_LATENCIA)},
            "error": {"valor": tasa_error, "umbral": UMBRAL_ERROR, "unidad": "%",
                      "dir": "max", "estado": estado_max(tasa_error, UMBRAL_ERROR)},
        }
        dims["global"] = peor_estado([d["estado"] for d in dims.values()])
        return jsonify(dims)
    except Exception as e:
        return jsonify({"error": str(e)}), 503


# ---------------------------------------------------------------------------
# Manejo de errores
# ---------------------------------------------------------------------------
def status_404(error):
    return "<h1>Página no encontrada.</h1>", 404


if __name__ == "__main__":
    app.register_error_handler(404, status_404)
    app.run(debug=True)
