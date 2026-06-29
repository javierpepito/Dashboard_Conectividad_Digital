"""Monitor de Conectividad Digital — API REST + Dashboard (Flask).

Sirve el tablero web y expone los 5 endpoints que consume el dashboard. Cada
endpoint ejecuta consultas SQL sobre el Data Warehouse (esquema estrella en
MySQL) y devuelve JSON. Si el DWH no está disponible, el endpoint responde 503
y el front-end cae automáticamente a sus datos demo (nunca queda en blanco).
"""
import os

from flask import Flask, jsonify, render_template

import db

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "K3W$k3!sdi#k29asdk@xw92d2asd@!ad2")

# Umbrales del SLA (sección 3.1 del informe)
UMBRAL_UPTIME = 99.0      # %   (mayor es mejor)
UMBRAL_FRESHNESS = 20     # días (menor es mejor)
UMBRAL_COMPLETITUD = 97.0 # %   (mayor es mejor)
UMBRAL_LATENCIA = 2.0     # min (menor es mejor)
UMBRAL_ERROR = 0.5        # %   (menor es mejor)

ORDEN_RANGOS = "FIELD(re.rango,'14-24','25-40','41-60','60+')"


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
    """Calcula la completitud por campo de FACT_CONECTIVIDAD."""
    fila = db.query_one(
        """
        SELECT
            COUNT(*)                                  AS total,
            SUM(id_rango_etario  IS NOT NULL)         AS edad,
            SUM(id_tipo_conexion IS NOT NULL)         AS tipo_conexion,
            SUM(velocidad_bajada IS NOT NULL)         AS velocidad_bajada,
            SUM(velocidad_subida IS NOT NULL)         AS velocidad_subida,
            SUM(horas_uso        IS NOT NULL)         AS horas_uso,
            SUM(id_proposito     IS NOT NULL)         AS proposito_uso
        FROM FACT_CONECTIVIDAD
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


# ---------------------------------------------------------------------------
# API REST
# ---------------------------------------------------------------------------
@app.route("/kpi_principal")
def kpi_principal():
    """KPI principal (índice de brecha digital) y métricas de dominio."""
    try:
        vel = db.query_all(
            f"""
            SELECT re.rango AS rango, AVG(f.velocidad_bajada) AS download
            FROM FACT_CONECTIVIDAD f
            JOIN DIM_RANGO_ETARIO re ON re.id_rango_etario = f.id_rango_etario
            WHERE f.tiene_acceso = 1 AND f.velocidad_bajada IS NOT NULL
            GROUP BY re.rango ORDER BY {ORDEN_RANGOS}
            """
        )
        horas = db.query_all(
            f"""
            SELECT re.rango AS rango, AVG(f.horas_uso) AS horas
            FROM FACT_CONECTIVIDAD f
            JOIN DIM_RANGO_ETARIO re ON re.id_rango_etario = f.id_rango_etario
            WHERE f.horas_uso IS NOT NULL
            GROUP BY re.rango ORDER BY {ORDEN_RANGOS}
            """
        )
        agg = db.query_one(
            """
            SELECT
                COUNT(*) AS volumen,
                AVG(CASE WHEN tiene_acceso = 1 THEN velocidad_bajada END) AS media,
                AVG(CASE WHEN tiene_acceso = 0 THEN 1.0 ELSE 0.0 END) * 100 AS pct_sin_acceso
            FROM FACT_CONECTIVIDAD
            """
        )

        media = r(agg["media"])
        velocidad_rango = [{"rango": v["rango"], "download": r(v["download"])} for v in vel]
        horas_rango = [{"rango": h["rango"], "horas": r(h["horas"])} for h in horas]

        # Grupo con menor velocidad de bajada = más afectado por la brecha
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
    """Cantidad de registros por tipo de conexión (COUNT + GROUP BY)."""
    try:
        filas = db.query_all(
            """
            SELECT tc.tipo_conexion AS tipo, COUNT(*) AS cantidad
            FROM FACT_CONECTIVIDAD f
            JOIN DIM_TIPO_CONEXION tc ON tc.id_tipo_conexion = f.id_tipo_conexion
            GROUP BY tc.tipo_conexion ORDER BY cantidad DESC
            """
        )
        return jsonify({"tipos": [{"tipo": x["tipo"], "cantidad": x["cantidad"]} for x in filas]})
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@app.route("/completitud")
def completitud():
    """Completitud y nulos por campo (reglas de calidad DMBOK)."""
    try:
        global_pct, campos = _completitud_campos()
        return jsonify({"global_pct": global_pct, "campos": campos})
    except Exception as e:
        return jsonify({"error": str(e)}), 503


@app.route("/historico")
def historico():
    """Histórico de completitud de los últimos 10 ciclos del ETL."""
    try:
        filas = db.query_all(
            """
            SELECT completitud_pct, fecha FROM (
                SELECT completitud_pct, fecha FROM log_etl
                ORDER BY fecha DESC LIMIT 10
            ) t ORDER BY fecha ASC
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
    """Estado de las 5 dimensiones del SLA + semáforo global."""
    try:
        # Freshness: días desde la última carga
        fresh = db.query_one(
            "SELECT DATEDIFF(NOW(), MAX(fecha_carga)) AS dias FROM FACT_CONECTIVIDAD"
        )
        dias = int(fresh["dias"]) if fresh and fresh["dias"] is not None else 0

        # Última ejecución del ETL: latencia y tasa de error
        ult = db.query_one(
            """
            SELECT duracion_segundos, registros_leidos, registros_rechazados
            FROM log_etl ORDER BY fecha DESC LIMIT 1
            """
        )
        if ult:
            latencia_min = r(float(ult["duracion_segundos"]) / 60.0, 1)
            leidos = ult["registros_leidos"] or 0
            tasa_error = r((ult["registros_rechazados"] / leidos * 100) if leidos else 0.0)
        else:
            latencia_min, tasa_error = 0.0, 0.0

        # Uptime: proporción de ejecuciones del ETL sin error
        up = db.query_one(
            """
            SELECT
                COUNT(*) AS total,
                SUM(estado = 'OK') AS ok
            FROM log_etl
            """
        )
        uptime = r((up["ok"] / up["total"] * 100) if up and up["total"] else 100.0)

        # Completitud global
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
