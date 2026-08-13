import os
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

NYC_DATA_API_URL = "https://data.cityofnewyork.us/resource/h9gi-nx95.json"


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    return response


def build_date_where_clause(year):
    if not year or year.upper() == "ALL":
        return "crash_date IS NOT NULL"
    return f"crash_date >= '{year}-01-01T00:00:00' AND crash_date <= '{year}-12-31T23:59:59'"


@app.route("/api/kpi", methods=["GET", "OPTIONS"])
def get_kpi_summary():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    borough = request.args.get("borough", "ALL").upper()
    year = request.args.get("year", "2025")

    date_filter = build_date_where_clause(year)
    where_clause = f"{date_filter} AND contributing_factor_vehicle_1 IS NOT NULL AND contributing_factor_vehicle_1 != 'Unspecified'"

    if borough != "ALL":
        where_clause += f" AND borough = '{borough}'"

    params = {
        "$where": where_clause,
        "$limit": 50000,
        "$select": "contributing_factor_vehicle_1",
    }

    try:
        response = requests.get(NYC_DATA_API_URL, params=params, timeout=12)
        if response.status_code != 200:
            return jsonify({"success": False, "error": f"API HTTP {response.status_code}"}), 200

        data = response.json()
        if not data:
            return jsonify({
                "success": True,
                "total_volume": 0,
                "leading_cause": "N/A",
                "leading_cause_count": 0,
                "primary_cause_share": 0.0,
                "infrastructure_count": 0,
                "enforcement_count": 0,
                "allocation_ratio": 0.0
            })

        factor_counts = {}
        inattention_count = 0
        enforcement_count = 0

        for record in data:
            factor = record.get("contributing_factor_vehicle_1", "Unknown").upper()
            factor_counts[factor] = factor_counts.get(factor, 0) + 1

            if "DRIVER INATTENTION" in factor or "DISTRACTION" in factor:
                inattention_count += 1
            elif "CELL PHONE" in factor or "ALCOHOL" in factor or "UNSAFE SPEED" in factor:
                enforcement_count += 1

        total_volume = len(data)
        sorted_factors = sorted(factor_counts.items(), key=lambda x: x[1], reverse=True)
        top_factor_name, top_factor_count = sorted_factors[0] if sorted_factors else ("N/A", 0)

        primary_share = round((top_factor_count / total_volume) * 100, 1) if total_volume > 0 else 0.0
        ratio = round(inattention_count / enforcement_count, 1) if enforcement_count > 0 else 0.0

        return jsonify({
            "success": True,
            "borough": borough,
            "year": year,
            "kpi": {
                "total_volume": total_volume,
                "leading_cause": top_factor_name.title(),
                "leading_cause_count": top_factor_count,
                "primary_cause_share": primary_share,
                "infrastructure_count": inattention_count,
                "enforcement_count": enforcement_count,
                "allocation_ratio": ratio
            }
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 200


@app.route("/api/collisions/comparison", methods=["GET", "OPTIONS"])
def get_collision_comparison():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    borough = request.args.get("borough", "ALL").upper()
    year = request.args.get("year", "2025")

    date_filter = build_date_where_clause(year)
    where_clause = f"{date_filter} AND contributing_factor_vehicle_1 IS NOT NULL AND contributing_factor_vehicle_1 != 'Unspecified'"

    if borough != "ALL":
        where_clause += f" AND borough = '{borough}'"

    params = {
        "$where": where_clause,
        "$limit": 50000,
        "$select": "contributing_factor_vehicle_1",
    }

    try:
        response = requests.get(NYC_DATA_API_URL, params=params, timeout=12)
        if response.status_code != 200:
            return jsonify({"success": False, "error": f"API HTTP {response.status_code}"}), 200

        data = response.json()
        inattention_count = 0
        alcohol_count = 0
        phone_count = 0

        for record in data:
            factor = record.get("contributing_factor_vehicle_1", "").upper()
            if "DRIVER INATTENTION" in factor or "DISTRACTION" in factor:
                inattention_count += 1
            elif "ALCOHOL" in factor:
                alcohol_count += 1
            elif "CELL PHONE" in factor or "PHONE" in factor:
                phone_count += 1

        enforcement_total = alcohol_count + phone_count
        ratio = round(inattention_count / enforcement_total, 1) if enforcement_total > 0 else 0.0

        return jsonify({
            "success": True,
            "year": year,
            "borough": borough,
            "metrics": {
                "infrastructure_bound": inattention_count,
                "alcohol_count": alcohol_count,
                "phone_count": phone_count,
                "enforceable": enforcement_total,
                "allocation_ratio": ratio
            },
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 200


@app.route("/api/map", methods=["GET", "OPTIONS"])
def get_map_coordinates():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    borough = request.args.get("borough", "ALL").upper()
    year = request.args.get("year", "2025")

    date_filter = build_date_where_clause(year)
    where_clause = f"{date_filter} AND latitude IS NOT NULL AND longitude IS NOT NULL AND latitude != '0' AND longitude != '0'"

    if borough != "ALL":
        where_clause += f" AND borough = '{borough}'"

    params = {
        "$where": where_clause,
        "$limit": 500,
        "$select": "latitude, longitude, contributing_factor_vehicle_1, crash_date, number_of_pedestrians_injured, number_of_cyclist_injured, number_of_motorist_injured",
    }

    try:
        response = requests.get(NYC_DATA_API_URL, params=params, timeout=12)
        if response.status_code != 200:
            return jsonify({"success": False, "error": f"API HTTP {response.status_code}"}), 200

        data = response.json()
        points = []

        for record in data:
            try:
                lat = float(record.get("latitude", 0))
                lng = float(record.get("longitude", 0))
                factor = record.get("contributing_factor_vehicle_1", "Unspecified").title()
                crash_date = str(record.get("crash_date", ""))[:10]

                ped_inj = int(record.get("number_of_pedestrians_injured", 0))
                cyc_inj = int(record.get("number_of_cyclist_injured", 0))
                mot_inj = int(record.get("number_of_motorist_injured", 0))

                user_type = "Multi-Vehicle / Driver"
                if ped_inj > 0:
                    user_type = "🚸 Pedestrian Struck"
                elif cyc_inj > 0:
                    user_type = "🚲 Cyclist Struck"
                elif mot_inj > 0:
                    user_type = "🚘 Driver / Passenger Injured"

                if lat != 0 and lng != 0:
                    points.append({
                        "lat": lat,
                        "lng": lng,
                        "factor": factor,
                        "date": crash_date,
                        "user_type": user_type,
                        "ped_inj": ped_inj,
                        "cyc_inj": cyc_inj,
                        "mot_inj": mot_inj
                    })
            except (ValueError, TypeError):
                continue

        return jsonify({
            "success": True,
            "points": points
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 200


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))