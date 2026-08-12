import os
import requests
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")

NYC_DATA_API_URL = "https://data.cityofnewyork.us/resource/h9gi-nx95.json"


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    return response


@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")


def build_date_where_clause(year):
    """Builds SoQL date query filter for a specific year or all available historical years."""
    if not year or year.upper() == "ALL":
        return "crash_date IS NOT NULL"
    return f"crash_date >= '{year}-01-01T00:00:00' AND crash_date <= '{year}-12-31T23:59:59'"


@app.route("/api/collisions/comparison", methods=["GET"])
def get_collision_comparison():
    borough = request.args.get("borough", "ALL").upper()
    year = request.args.get("year", "2025")

    # Build date query clause dynamically
    date_filter = build_date_where_clause(year)
    where_clause = date_filter

    if borough != "ALL":
        where_clause += f" AND borough = '{borough}'"

    params = {
        "$where": where_clause,
        "$limit": 50000,
        "$select": "contributing_factor_vehicle_1",
    }

    try:
        response = requests.get(
            NYC_DATA_API_URL, params=params, timeout=12
        )

        if response.status_code != 200:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": f"NYC Open Data API returned status code {response.status_code}",
                    }
                ),
                500,
            )

        data = response.json()

        inattention_count = 0
        enforcement_count = 0

        for record in data:
            factor = record.get(
                "contributing_factor_vehicle_1", ""
            ).upper()

            # Infrastructure-Bound: Cognitive distraction / inattention
            if "DRIVER INATTENTION" in factor or "DISTRACTION" in factor:
                inattention_count += 1
            # Ticketable/Enforceable: Active illegal driving behaviors
            elif (
                "CELL PHONE" in factor
                or "ALCOHOL" in factor
                or "UNSAFE SPEED" in factor
            ):
                enforcement_count += 1

        return jsonify(
            {
                "success": True,
                "year": year,
                "borough": borough,
                "metrics": {
                    "infrastructure_bound": inattention_count,
                    "enforceable": enforcement_count,
                },
            }
        )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# Serverless entry point handler for Vercel / local testing
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))