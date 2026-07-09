"""Capa de acceso al Data Warehouse (MySQL) del Monitor de Conectividad Digital.

Centraliza la conexión y la ejecución de consultas. La configuración se toma
de variables de entorno (.env), de modo que las credenciales nunca quedan
escritas en el código.
"""
import os

import pymysql
from pymysql.cursors import DictCursor

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # python-dotenv es opcional
    pass


def _config():
    """Lee la configuración de conexión desde el entorno."""
    return dict(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "monitor_conectividad_dwh"),
        charset="utf8mb4",
        cursorclass=DictCursor,
        connect_timeout=4,
    )


def get_connection():
    """Devuelve una conexión nueva al DWH. Lanza pymysql.MySQLError si falla."""
    return pymysql.connect(**_config())


def query_all(sql, params=None):
    """Ejecuta un SELECT y devuelve todas las filas como lista de dicts."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Sólo se pasan params si existen: así PyMySQL no intenta interpolar
            # y los '%' literales de las cláusulas LIKE no rompen la consulta.
            cur.execute(sql, params) if params else cur.execute(sql)
            return cur.fetchall()
    finally:
        conn.close()


def query_one(sql, params=None):
    """Ejecuta un SELECT y devuelve la primera fila (dict) o None."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params) if params else cur.execute(sql)
            return cur.fetchone()
    finally:
        conn.close()
