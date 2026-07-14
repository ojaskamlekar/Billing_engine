import queue
import threading
from datetime import datetime, timedelta
import os
import json
from sqlalchemy import Column, Integer, String, DateTime, BigInteger, ForeignKey, text
from database import Base, engine, SessionLocal
import redis_client

# Configurable pricing configuration file loading
CONFIG_FILE = "pricing_config.json"

def get_bandwidth_price_per_gb() -> float:
    """Fetch configurable bandwidth pricing from pricing_config.json."""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                return float(data.get("bandwidth_price_per_gb", 0.20))
        except Exception:
            pass
    # Fallback to default ₹0.20 per GB and create config file
    default_config = {"bandwidth_price_per_gb": 0.20}
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(default_config, f, indent=2)
    except Exception:
        pass
    return 0.20


from models import BandwidthUsage


# Thread-safe queue for asynchronous logging
bandwidth_queue = queue.Queue()

def bandwidth_worker():
    """Worker daemon to process bandwidth entries sequentially to avoid SQLite locking."""
    while True:
        try:
            item = bandwidth_queue.get()
            if item is None:
                break
            
            user_id, file_id, operation, bytes_transferred, ip_address, request_id = item
            
            with SessionLocal() as db:
                entry = BandwidthUsage(
                    user_id=user_id,
                    file_id=file_id,
                    operation=operation,
                    bytes_transferred=bytes_transferred,
                    ip_address=ip_address,
                    request_id=request_id
                )
                db.add(entry)
                db.commit()
                
            # Invalidate Redis caches for this user and admin dashboard
            r_client = redis_client._get_client()
            if r_client:
                try:
                    r_client.delete(f"wecloud:bandwidth:summary:{user_id}")
                    r_client.delete(f"wecloud:bandwidth:timeline:{user_id}:Today")
                    r_client.delete(f"wecloud:bandwidth:timeline:{user_id}:7 Days")
                    r_client.delete(f"wecloud:bandwidth:timeline:{user_id}:30 Days")
                    r_client.delete(f"wecloud:bandwidth:timeline:{user_id}:90 Days")
                    r_client.delete(f"wecloud:bandwidth:timeline:{user_id}:Custom")
                    r_client.delete(f"wecloud:bandwidth:top_files:{user_id}")
                    r_client.delete("wecloud:bandwidth:admin_health")
                    r_client.delete("wecloud:bandwidth:admin_top_users")
                    # Also invalidate invoice query cache
                    r_client.delete(f"wecloud:invoice:{user_id}")
                except Exception:
                    pass
        except Exception as e:
            print(f"Error logging bandwidth in background: {e}")
        finally:
            bandwidth_queue.task_done()

# Start background thread
worker_thread = threading.Thread(target=bandwidth_worker, daemon=True)
worker_thread.start()


class BandwidthService:
    @staticmethod
    def log_bandwidth_async(
        user_id: int,
        file_id: int,
        operation: str,
        bytes_transferred: int,
        ip_address: str,
        request_id: str = None
    ):
        """Asynchronously queue a bandwidth log entry."""
        bandwidth_queue.put((user_id, file_id, operation, bytes_transferred, ip_address, request_id))

    @staticmethod
    def get_user_bandwidth_summary(user_id: int) -> dict:
        """Fetch upload, download, and total data transfer for a user (with Redis caching)."""
        cache_key = f"wecloud:bandwidth:summary:{user_id}"
        cached = redis_client.get_cache(cache_key)
        if cached is not None:
            return cached

        with engine.connect() as conn:
            # Upload
            res_up = conn.execute(
                text("SELECT SUM(bytes_transferred) FROM bandwidth_usage WHERE user_id = :uid AND operation = 'UPLOAD'"),
                {"uid": user_id}
            )
            upload_bytes = res_up.scalar() or 0

            # Download
            res_down = conn.execute(
                text("SELECT SUM(bytes_transferred) FROM bandwidth_usage WHERE user_id = :uid AND operation = 'DOWNLOAD'"),
                {"uid": user_id}
            )
            download_bytes = res_down.scalar() or 0

        total_bytes = upload_bytes + download_bytes
        price_per_gb = get_bandwidth_price_per_gb()
        estimated_cost = (total_bytes / (1024 * 1024 * 1024)) * price_per_gb

        summary = {
            "upload_bytes": upload_bytes,
            "download_bytes": download_bytes,
            "total_bytes": total_bytes,
            "estimated_cost": round(estimated_cost, 2),
            "price_per_gb": price_per_gb
        }
        
        redis_client.set_cache(cache_key, summary, ttl=180)
        return summary

    @staticmethod
    def get_user_bandwidth_timeline(user_id: int, timeframe: str, start_date: str = None, end_date: str = None) -> list:
        """Fetch bandwidth logs grouped by day for charts (with Redis caching)."""
        cache_key = f"wecloud:bandwidth:timeline:{user_id}:{timeframe}"
        if timeframe == "Custom" and (start_date or end_date):
            cache_key += f":{start_date}:{end_date}"
            
        cached = redis_client.get_cache(cache_key)
        if cached is not None:
            return cached

        # Determine start date limit
        now = datetime.utcnow()
        start_limit = None
        if timeframe == "Today":
            start_limit = datetime(now.year, now.month, now.day)
        elif timeframe == "7 Days":
            start_limit = now - timedelta(days=7)
        elif timeframe == "30 Days":
            start_limit = now - timedelta(days=30)
        elif timeframe == "90 Days":
            start_limit = now - timedelta(days=90)
        elif timeframe == "Custom" and start_date:
            try:
                start_limit = datetime.strptime(start_date, "%Y-%m-%d")
            except ValueError:
                pass

        end_limit = None
        if timeframe == "Custom" and end_date:
            try:
                end_limit = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            except ValueError:
                pass

        query_str = """
            SELECT DATE(timestamp) as day, operation, SUM(bytes_transferred)
            FROM bandwidth_usage
            WHERE user_id = :uid
        """
        params = {"uid": user_id}

        if start_limit:
            query_str += " AND timestamp >= :start_limit"
            params["start_limit"] = start_limit
        if end_limit:
            query_str += " AND timestamp < :end_limit"
            params["end_limit"] = end_limit

        query_str += " GROUP BY DATE(timestamp), operation ORDER BY DATE(timestamp) ASC"

        with engine.connect() as conn:
            res = conn.execute(text(query_str), params)
            rows = res.fetchall()

        # Format as daily nodes
        daily_data = {}
        for row in rows:
            day_str = str(row[0])
            op = row[1]
            bytes_val = int(row[2] or 0)
            mb_val = round(bytes_val / (1024 * 1024), 2)
            
            if day_str not in daily_data:
                daily_data[day_str] = {"date": day_str, "upload": 0.0, "download": 0.0, "total": 0.0}
            
            if op == "UPLOAD":
                daily_data[day_str]["upload"] = mb_val
            elif op == "DOWNLOAD":
                daily_data[day_str]["download"] = mb_val
            
            daily_data[day_str]["total"] += mb_val

        timeline = sorted(list(daily_data.values()), key=lambda x: x["date"])
        redis_client.set_cache(cache_key, timeline, ttl=180)
        return timeline

    @staticmethod
    def get_top_bandwidth_files(user_id: int, limit: int = 5) -> list:
        """Fetch top files consumed by bandwidth (with Redis caching)."""
        cache_key = f"wecloud:bandwidth:top_files:{user_id}"
        cached = redis_client.get_cache(cache_key)
        if cached is not None:
            return cached

        query_str = """
            SELECT u.filename, COUNT(b.id) as count, SUM(b.bytes_transferred) as size
            FROM bandwidth_usage b
            JOIN usage_logs u ON b.file_id = u.id
            WHERE b.user_id = :uid
            GROUP BY u.filename
            ORDER BY size DESC
            LIMIT :limit
        """
        with engine.connect() as conn:
            res = conn.execute(text(query_str), {"uid": user_id, "limit": limit})
            rows = res.fetchall()

        files_list = []
        for r in rows:
            files_list.append({
                "filename": r[0],
                "transfer_count": r[1],
                "total_mb": round(int(r[2] or 0) / (1024 * 1024), 2)
            })

        redis_client.set_cache(cache_key, files_list, ttl=180)
        return files_list

    @staticmethod
    def get_system_health_bandwidth() -> dict:
        """Fetch admin-only health metrics for bandwidth (Today's transfer, Peak transfer, Avg throughput)."""
        cache_key = "wecloud:bandwidth:admin_health"
        cached = redis_client.get_cache(cache_key)
        if cached is not None:
            return cached

        today = datetime.utcnow().date()
        
        with engine.connect() as conn:
            # Today's Transfer
            res_today = conn.execute(
                text("SELECT SUM(bytes_transferred) FROM bandwidth_usage WHERE DATE(timestamp) = :today"),
                {"today": today}
            )
            today_bytes = res_today.scalar() or 0

            # Peak transfer (max in a single operation today)
            res_peak = conn.execute(
                text("SELECT MAX(bytes_transferred) FROM bandwidth_usage WHERE DATE(timestamp) = :today"),
                {"today": today}
            )
            peak_bytes = res_peak.scalar() or 0

            # Average throughput calculation (linked to api_request_logs execution_time_ms)
            # Query sum of bytes / sum of execution_time_ms in seconds
            res_tp = conn.execute(
                text("""
                    SELECT SUM(b.bytes_transferred), SUM(a.execution_time_ms)
                    FROM bandwidth_usage b
                    JOIN api_request_logs a ON b.request_id = a.request_id
                    WHERE DATE(b.timestamp) = :today
                """),
                {"today": today}
            )
            tp_row = res_tp.fetchone()
            
            bytes_sum = tp_row[0] or 0 if tp_row else 0
            ms_sum = tp_row[1] or 0 if tp_row else 0

        # Calculate throughput in MB/s (fallback if join is empty)
        if bytes_sum > 0 and ms_sum > 0:
            avg_throughput = (bytes_sum / (1024 * 1024)) / (ms_sum / 1000.0)
        else:
            # Fallback based on average size divided by average estimated operations latency of 150ms
            with engine.connect() as conn:
                res_count = conn.execute(
                    text("SELECT COUNT(*), SUM(bytes_transferred) FROM bandwidth_usage WHERE DATE(timestamp) = :today"),
                    {"today": today}
                )
                ops, sum_b = res_count.fetchone() or (0, 0)
            if ops > 0 and sum_b:
                avg_throughput = (int(sum_b) / (1024 * 1024)) / (ops * 0.15)
            else:
                avg_throughput = 0.0

        health = {
            "today_transfer_mb": round(today_bytes / (1024 * 1024), 2),
            "peak_transfer_mb": round(peak_bytes / (1024 * 1024), 2),
            "avg_throughput_mbs": round(avg_throughput, 2)
        }

        redis_client.set_cache(cache_key, health, ttl=60)
        return health

    @staticmethod
    def get_admin_top_users_bandwidth(limit: int = 5) -> list:
        """Fetch top bandwidth consumers for admin view."""
        cache_key = "wecloud:bandwidth:admin_top_users"
        cached = redis_client.get_cache(cache_key)
        if cached is not None:
            return cached

        query_str = """
            SELECT u.email, SUM(b.bytes_transferred) as total_bytes
            FROM bandwidth_usage b
            JOIN users u ON b.user_id = u.id
            GROUP BY u.email
            ORDER BY total_bytes DESC
            LIMIT :limit
        """
        with engine.connect() as conn:
            res = conn.execute(text(query_str), {"limit": limit})
            rows = res.fetchall()

        users_list = []
        for r in rows:
            users_list.append({
                "email": r[0],
                "total_mb": round(int(r[1] or 0) / (1024 * 1024), 2)
            })

        redis_client.set_cache(cache_key, users_list, ttl=60)
        return users_list
