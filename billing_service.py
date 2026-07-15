import os
import json
from datetime import datetime, timedelta
from sqlalchemy import text
from database import engine

CONFIG_FILE = "pricing_config.json"

class BillingService:
    @staticmethod
    def get_pricing_config() -> dict:
        """Fetch pricing configurations from pricing_config.json, with default values."""
        defaults = {
            "storage_price_per_mb": 0.05,
            "api_price_per_request": 0.001,
            "bandwidth_price_per_gb": 10.0
        }
        config = dict(defaults)
        
        # Load from file if exists
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as f:
                    data = json.load(f)
                    for key in defaults:
                        if key in data:
                            config[key] = float(data[key])
            except Exception:
                pass
        
        # Save back to file to ensure it exists and has all keys
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump(config, f, indent=2)
        except Exception:
            pass
            
        return config

    @classmethod
    def calculate_bill(cls, user_id: int, total_bytes: int, api_requests: int, bandwidth_bytes: int, plan: str) -> dict:
        """Calculate storage, API, and bandwidth costs, taxes, grand total, and generate insights."""
        config = cls.get_pricing_config()
        
        # Raw metrics conversion
        storage_used_mb = total_bytes / (1024 * 1024)
        bandwidth_used_gb = bandwidth_bytes / (1024 * 1024 * 1024)
        
        # Cost Calculations
        storage_cost = round(storage_used_mb * config["storage_price_per_mb"], 2)
        api_cost = round(api_requests * config["api_price_per_request"], 2)
        bandwidth_cost = round(bandwidth_used_gb * config["bandwidth_price_per_gb"], 2)
        
        subtotal = round(storage_cost + api_cost + bandwidth_cost, 2)
        
        # Taxes: GST (currently 0%)
        taxes = 0.0
        grand_total = round(subtotal + taxes, 2)
        
        # Insights Generation (Deterministic rules)
        insights = []
        
        # Rule 1: Highest cost contributor
        if subtotal > 0:
            contributions = [
                ("storage", storage_cost),
                ("api requests", api_cost),
                ("bandwidth", bandwidth_cost)
            ]
            # Find the max cost contributor
            highest_contrib, highest_val = max(contributions, key=lambda x: x[1])
            highest_pct = (highest_val / subtotal) * 100
            if highest_pct >= 30:
                insights.append(f"{highest_pct:.0f}% of your bill comes from {highest_contrib} usage.")
        
        # Rule 2: Storage growth
        cutoff = datetime.utcnow() - timedelta(days=30)
        try:
            with engine.connect() as conn:
                res = conn.execute(
                    text("SELECT SUM(filesize) FROM usage_logs WHERE user_id = :user_id AND uploaded_at < :cutoff"),
                    {"user_id": user_id, "cutoff": cutoff}
                )
                storage_30d_ago = int(res.scalar() or 0)
        except Exception:
            storage_30d_ago = 0

        if storage_30d_ago > 0:
            growth = ((total_bytes - storage_30d_ago) / storage_30d_ago) * 100
            if growth > 0:
                insights.append(f"Storage increased by {growth:.0f}% this month.")
            elif growth < 0:
                insights.append(f"Storage decreased by {abs(growth):.0f}% this month.")
            else:
                insights.append("Storage usage remained stable this month.")
        else:
            if total_bytes > 0:
                insights.append("Storage increased by 100% this month.")
        
        # Rule 3: API usage limits based on plan
        api_limits = {
            "Free": 1000,
            "Pro": 10000,
            "Enterprise": 100000
        }
        limit = api_limits.get(plan, 10000)
        if api_requests <= limit:
            insights.append("API usage remained within your current plan.")
        else:
            insights.append("API usage exceeded standard plan thresholds.")
            
        # Rule 4: Compression recommendation (if user has files)
        try:
            with engine.connect() as conn:
                res = conn.execute(
                    text("SELECT COUNT(*) FROM usage_logs WHERE user_id = :user_id"),
                    {"user_id": user_id}
                )
                files_count = res.scalar() or 0
        except Exception:
            files_count = 0
            
        if files_count > 0:
            insights.append("Compress old files to reduce storage costs.")
            
        return {
            "storage_cost": storage_cost,
            "api_cost": api_cost,
            "bandwidth_cost": bandwidth_cost,
            "subtotal": subtotal,
            "taxes": taxes,
            "grand_total": grand_total,
            "pricing_config": config,
            "insights": insights
        }
