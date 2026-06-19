from flask import Flask, render_template, request, redirect, url_for, flash

app = Flask(__name__)
app.secret_key = "K3W$k3!sdi#k29asdk@xw92d2asd@!ad2"

# Funciones

# Rutas
@app.route("/", methods=["GET"])
def Inicio():
    return render_template("home.html")

@app.route("/Convertir", methods=["POST"])
def Convertir():
    
    return redirect(url_for("Inicio"))






def status_401(error):
    return redirect(url_for('Inicio'))

def status_404(error):
    return "<h1>Página no encontrada. </h1>", 404

if __name__ == "__main__":
    app.register_error_handler(401, status_401)
    app.register_error_handler(404, status_404)
    app.run(debug=True)